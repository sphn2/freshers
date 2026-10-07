import uuid
from urllib.parse import quote
from datetime import datetime, timezone
from app.db import db
from app.schemas.registration import RegistrationCreate, AutoFillResponse
from app.services.event_service import event_service
from app.services.audit_service import audit_service
from app.services.email_service import email_service
from app.services.registration_rules import ensure_event_capacity_available, ensure_registration_window_open
from app.services.pricing_service import ticket_price_for_roll
from app.utils.payment_access import create_access_token
from app.config import config

class RegistrationService:
    @staticmethod
    def autofill_student_lookup(
        event_id: str, roll_number: str, user_email: str = None
    ) -> AutoFillResponse:
        event = event_service.get_event_by_id(event_id)
        if not event:
            raise ValueError("Event not found.")
        if not event.get("allow_autofill"):
            raise ValueError("Auto-fill is not enabled for this event.")
        
        student = db.execute_one(
            "SELECT * FROM student_directory WHERE LOWER(roll_number) = LOWER(%s)",
            (roll_number.strip(),)
        )
        if not student:
            raise ValueError("Student record was not found.")
        if not user_email or student["email"].casefold() != user_email.casefold():
            raise ValueError("Student record is not linked to this account.")
            
        return AutoFillResponse(
            roll_number=student["roll_number"],
            full_name=student["full_name"],
            email=student["email"],
            phone=student.get("phone"),
            department=student["department"],
            college=student.get("college_name", "Sphoorthy Engineering College")
        )

    @staticmethod
    def register_student(data: RegistrationCreate, user_id: str = None):
        now = datetime.now(timezone.utc)
        reg_id = str(uuid.uuid4())
        created_at = now.isoformat()
        ticket = None
        payment_token, token_hash = create_access_token()
        existing_pending = False
        reused_registration = False
        event_query = "SELECT * FROM events WHERE id = %s"
        if not db.is_sqlite:
            event_query += " FOR UPDATE"

        with db.transaction():
            event = db.execute_one(event_query, (data.event_id,))
            if not event:
                raise ValueError("Event not found.")
            ensure_registration_window_open(event, now)
            if not event.get("allow_online"):
                raise ValueError("Online registration is disabled for this event.")

            matching_query = """SELECT * FROM registrations
                                WHERE event_id = %s AND
                                (LOWER(email) = LOWER(%s) OR LOWER(roll_number) = LOWER(%s))"""
            if not db.is_sqlite:
                matching_query += " FOR UPDATE"
            matching = db.execute_query(
                matching_query,
                (data.event_id, data.email.strip(), data.roll_number.strip()),
            )
            if matching:
                previous = matching[0]
                same_email = previous["email"].casefold() == data.email.strip().casefold()
                same_roll = previous["roll_number"].casefold() == data.roll_number.strip().casefold()
                if len(matching) != 1 or not (same_email and same_roll):
                    raise ValueError("A registration already exists with this email address or roll number for this event.")
                if previous["status"] not in ("PENDING_PAYMENT", "CANCELLED"):
                    raise ValueError("A confirmed ticket already exists for this student in this event.")
                existing_ticket = db.execute_one(
                    "SELECT id FROM tickets WHERE registration_id = %s",
                    (previous["id"],),
                )
                if existing_ticket:
                    raise ValueError("A ticket has already been issued for this registration.")
                payment = db.execute_one(
                    "SELECT id FROM payments WHERE registration_id = %s AND status = 'PAID'",
                    (previous["id"],),
                )
                if payment:
                    raise ValueError("Payment was already received for this registration. Contact the event desk if your ticket is missing.")
                ticket_price = ticket_price_for_roll(event, data.roll_number)
                if previous["status"] == "CANCELLED":
                    ensure_event_capacity_available(event)
                if round(float(previous["ticket_price"]), 2) != ticket_price:
                    db.execute_write(
                        """UPDATE payments SET status = 'FAILED', updated_at = %s
                           WHERE registration_id = %s AND status = 'CREATED'""",
                        (now.isoformat(), previous["id"]),
                    )
                db.execute_write(
                    """UPDATE registrations
                       SET status = %s, ticket_price = %s,
                           payment_access_token_hash = %s, updated_at = %s
                       WHERE id = %s""",
                    (
                        "PAID" if ticket_price == 0 else "PENDING_PAYMENT",
                        ticket_price,
                        token_hash,
                        now.isoformat(),
                        previous["id"],
                    ),
                )
                reg_id = previous["id"]
                reused_registration = True
                existing_pending = ticket_price > 0
            else:
                ensure_event_capacity_available(event)

                ticket_price = ticket_price_for_roll(event, data.roll_number)
            initial_status = "PAID" if ticket_price == 0 else "PENDING_PAYMENT"
            if not reused_registration:
                db.execute_write(
                    """INSERT INTO registrations (
                        id, event_id, user_id, full_name, roll_number, email, phone,
                        department, college, ticket_price, status, payment_method,
                        payment_access_token_hash, created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )""",
                    (
                        reg_id, data.event_id, user_id, data.full_name.strip(),
                        data.roll_number.strip().upper(), data.email.strip().lower(),
                        data.phone.strip(), data.department.strip(), data.college.strip(),
                        ticket_price, initial_status, "ONLINE",
                        token_hash, created_at, created_at,
                    ),
                )

            audit_service.log("REGISTER_STUDENT", "registration", reg_id, user_id, {
                "event_id": data.event_id,
            })

            if ticket_price == 0:
                from app.services.ticket_service import ticket_service
                ticket = ticket_service.issue_ticket(reg_id, send_notification=False)

            registration = db.execute_one("SELECT * FROM registrations WHERE id = %s", (reg_id,))
            registration["ticket_id"] = ticket["id"] if ticket else None

        # The notification is intentionally best-effort. A mail delivery issue
        # must never reverse a committed registration.
        checkout_url = f"{config.APP_URL.rstrip('/')}/checkout/{quote(reg_id)}#access_token={quote(payment_token)}"
        email_sent = email_service.send_email(
            recipient=data.email,
            subject=(
                f"Complete your payment — {event['title']}"
                if ticket_price > 0
                else f"Registration Confirmed — {event['title']}"
            ),
            template_name="emails/registration_confirmed.html",
            context={
                "student_name": data.full_name,
                "event_title": event["title"],
                "ticket_price": ticket_price,
                "is_free": ticket_price == 0,
                "ticket_code": ticket["ticket_code"] if ticket else None,
                "roll_number": data.roll_number,
                "department": data.department,
                "venue": event["venue"],
                "event_time": event["start_time"],
                "checkout_url": checkout_url,
                "existing_pending": existing_pending,
            },
        )
        if existing_pending and not email_sent:
            db.execute_write(
                "UPDATE registrations SET payment_access_token_hash = %s WHERE id = %s",
                (previous["payment_access_token_hash"], reg_id),
            )
        if ticket:
            from app.services.ticket_service import ticket_service
            ticket_service.send_ticket_email(ticket)

        registration.pop("payment_access_token_hash", None)
        registration["payment_token"] = None if existing_pending else payment_token
        registration["existing_pending"] = existing_pending
        registration["payment_link_sent"] = email_sent
        return registration

registration_service = RegistrationService()
