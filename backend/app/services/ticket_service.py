import uuid
from io import BytesIO
from datetime import datetime, timezone
from app.db import db
from app.config import config
from app.utils.security import generate_ticket_code, generate_signed_qr_token, verify_signed_qr_token
from app.services.email_service import email_service
from app.services.audit_service import audit_service
from app.utils.payment_access import create_access_token


def ticket_qr_png(token: str) -> bytes:
    """Render a compact QR image for inline email attachment without PII."""
    import qrcode
    image = qrcode.make(token)
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()

class TicketService:
    @staticmethod
    def can_access(ticket: dict, user_id: str, roles: list[str]) -> bool:
        if "ADMIN" in roles:
            return True
        if ticket.get("user_id") == user_id:
            return True
        if "EVENT_MANAGER" in roles:
            assignment = db.execute_one(
                "SELECT 1 AS allowed FROM event_managers WHERE event_id = %s AND user_id = %s",
                (ticket["event_id"], user_id),
            )
            return bool(assignment)
        return False

    @staticmethod
    def get_ticket_by_id(ticket_id: str):
        ticket = db.execute_one(
            """SELECT t.*, r.user_id, r.full_name as student_name, r.roll_number, r.email, r.department, r.college,
                      e.title as event_title, e.venue, e.start_time, fe.status as food_status, fe.food_validated_at
               FROM tickets t
               JOIN registrations r ON t.registration_id = r.id
               JOIN events e ON t.event_id = e.id
               LEFT JOIN food_entitlements fe ON t.id = fe.ticket_id
               WHERE t.id = %s""",
            (ticket_id,)
        )
        return ticket

    @staticmethod
    def get_ticket_by_code_or_token(event_id: str, ticket_code: str = None, qr_token: str = None):
        if qr_token:
            payload = verify_signed_qr_token(qr_token)
            if not payload or payload["eid"] != event_id:
                return None
            return db.execute_one(
                """SELECT t.*, r.full_name as student_name, r.roll_number, r.email, r.department, e.title as event_title
                   FROM tickets t
                   JOIN registrations r ON t.registration_id = r.id
                   JOIN events e ON t.event_id = e.id
                   WHERE t.id = %s AND t.event_id = %s AND t.qr_token = %s""",
                (payload["tid"], event_id, qr_token)
            )
        elif ticket_code:
            return db.execute_one(
                """SELECT t.*, r.full_name as student_name, r.roll_number, r.email, r.department, e.title as event_title
                   FROM tickets t
                   JOIN registrations r ON t.registration_id = r.id
                   JOIN events e ON t.event_id = e.id
                   WHERE t.event_id = %s AND t.ticket_code = %s""",
                (event_id, ticket_code)
            )
        return None

    @staticmethod
    def issue_ticket(registration_id: str, send_notification: bool = True):
        """
        Idempotent ticket generation for a paid registration.
        Generates 6-digit unique ticket code and signed QR token.
        """
        reg = db.execute_one("SELECT * FROM registrations WHERE id = %s", (registration_id,))
        if not reg:
            raise ValueError("Registration not found.")
        if reg["status"] not in ("PAID", "OFFLINE_PAID"):
            raise ValueError("A ticket can only be issued after confirmed payment.")

        # Check existing ticket (Idempotent)
        existing = db.execute_one("SELECT id FROM tickets WHERE registration_id = %s", (registration_id,))
        if existing:
            return TicketService.get_ticket_by_id(existing["id"])

        event = db.execute_one("SELECT * FROM events WHERE id = %s", (reg["event_id"],))
        ticket_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        # Generate unique 6-digit code for this event
        max_attempts = 10
        ticket_code = None
        for _ in range(max_attempts):
            candidate = generate_ticket_code()
            code_exists = db.execute_one(
                "SELECT id FROM tickets WHERE event_id = %s AND ticket_code = %s",
                (reg["event_id"], candidate)
            )
            if not code_exists:
                ticket_code = candidate
                break
        
        if not ticket_code:
            raise RuntimeError("Failed to generate unique ticket code after maximum retries.")

        # Generate signed QR token
        qr_token = generate_signed_qr_token(ticket_id, reg["event_id"])

        # Insert Ticket
        inserted = db.execute_write(
            """INSERT INTO tickets (
                id, event_id, registration_id, ticket_code, qr_token, status, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (registration_id) DO NOTHING""",
            (ticket_id, reg["event_id"], registration_id, ticket_code, qr_token, "ISSUED", now, now)
        )
        if not inserted:
            concurrent_ticket = db.execute_one(
                "SELECT id FROM tickets WHERE registration_id = %s", (registration_id,)
            )
            if concurrent_ticket:
                return TicketService.get_ticket_by_id(concurrent_ticket["id"])
            raise RuntimeError("Ticket could not be issued. Please retry.")

        # Insert Food Entitlement if enabled
        if event.get("food_validation_enabled"):
            food_id = str(uuid.uuid4())
            db.execute_write(
                """INSERT INTO food_entitlements (id, ticket_id, event_id, status, created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (food_id, ticket_id, reg["event_id"], "UNCLAIMED", now, now)
            )

        ticket = TicketService.get_ticket_by_id(ticket_id)

        if send_notification:
            TicketService.send_ticket_email(ticket)

        audit_service.log("ISSUE_TICKET", "ticket", ticket_id, None, {
            "registration_id": registration_id,
        })

        return ticket

    @staticmethod
    def send_ticket_email(ticket: dict):
        """Send the ticket notification after the ticket transaction commits."""
        access_token, token_hash = create_access_token()
        db.execute_write(
            "UPDATE tickets SET public_access_token_hash = %s, updated_at = %s WHERE id = %s",
            (token_hash, datetime.now(timezone.utc).isoformat(), ticket["id"]),
        )
        return email_service.send_email(
            recipient=ticket["email"],
            subject=f"Digital Ticket Issued — {ticket['event_title']}",
            template_name="emails/ticket_issued.html",
            context={
                "student_name": ticket["student_name"],
                "event_title": ticket["event_title"],
                "ticket_code": ticket["ticket_code"],
                "roll_number": ticket["roll_number"],
                "department": ticket["department"],
                "venue": ticket["venue"],
                "event_time": ticket["start_time"],
                "qr_image": "cid:ticket-qr",
                "ticket_url": (
                    f"{config.APP_URL.rstrip('/')}/tickets/{ticket['id']}#ticket_token={access_token}"
                ),
            },
            inline_images={"ticket-qr": ticket_qr_png(ticket["qr_token"])},
        )

    @staticmethod
    def resend_ticket_email(ticket_id: str, user_id: str = None):
        ticket = TicketService.get_ticket_by_id(ticket_id)
        if not ticket:
            raise ValueError("Ticket not found.")
        
        success = TicketService.send_ticket_email(ticket)
        audit_service.log("RESEND_TICKET", "ticket", ticket_id, user_id, {"recipient": ticket["email"]})
        return success

    @staticmethod
    def reissue_ticket(ticket_id: str, reason: str, user_id: str = None):
        ticket = TicketService.get_ticket_by_id(ticket_id)
        if not ticket:
            raise ValueError("Ticket not found.")
        if ticket["gate_validated_at"]:
            raise ValueError("A ticket cannot be reissued after gate entry has been validated.")
        
        event_id = ticket["event_id"]
        old_code = ticket["ticket_code"]

        # Generate new 6-digit ticket code
        new_code = None
        for _ in range(10):
            candidate = generate_ticket_code()
            exists = db.execute_one("SELECT id FROM tickets WHERE event_id = %s AND ticket_code = %s", (event_id, candidate))
            if not exists:
                new_code = candidate
                break
        
        if not new_code:
            raise RuntimeError("Failed generating new ticket code.")

        new_qr_token = generate_signed_qr_token(ticket_id, event_id)
        now = datetime.now(timezone.utc).isoformat()

        # Invalidate old ticket code / QR token and assign new ones
        db.execute_write(
            """UPDATE tickets SET ticket_code = %s, qr_token = %s, updated_at = %s WHERE id = %s""",
            (new_code, new_qr_token, now, ticket_id)
        )

        reissued_ticket = TicketService.get_ticket_by_id(ticket_id)

        # Send reissued email
        email_service.send_email(
            recipient=ticket["email"],
            subject=f"Reissued Digital Ticket — {ticket['event_title']}",
            template_name="emails/ticket_reissued.html",
            context={
                "student_name": ticket["student_name"],
                "event_title": ticket["event_title"],
                "ticket_code": new_code,
                "roll_number": ticket["roll_number"],
                "department": ticket["department"],
                "venue": ticket["venue"],
                "event_time": ticket["start_time"],
                "reason": reason,
                "qr_image": "cid:ticket-qr",
                "ticket_url": f"{config.APP_URL.rstrip('/')}/tickets/{ticket_id}",
            },
            inline_images={"ticket-qr": ticket_qr_png(new_qr_token)},
        )

        audit_service.log("REISSUE_TICKET", "ticket", ticket_id, user_id, {
            "old_code": old_code,
            "new_code": new_code,
            "reason": reason
        })

        return reissued_ticket

ticket_service = TicketService()
