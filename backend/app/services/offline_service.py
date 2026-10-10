import uuid
from datetime import datetime, timezone
from werkzeug.security import check_password_hash
from app.db import db
from app.schemas.offline import OfflineRegistrationRequest, OfflineRegistrationResponse
from app.services.ticket_service import ticket_service
from app.services.audit_service import audit_service
from app.services.registration_rules import ensure_event_capacity_available, ensure_registration_window_open
from app.services.pricing_service import ticket_price_for_roll

class OfflineService:
    @staticmethod
    def register_offline_cash(req: OfflineRegistrationRequest, collector_user_id: str) -> OfflineRegistrationResponse:
        collector = db.execute_one("SELECT full_name, pin_hash FROM profiles WHERE id = %s", (collector_user_id,))
        if not collector or not collector.get("pin_hash"):
            raise ValueError("Your account does not have a 6-digit PIN configured. Contact an Admin or Super Admin to assign your PIN.")
        if not check_password_hash(collector["pin_hash"], req.pin.strip()):
            raise ValueError("Invalid 6-digit authorization PIN.")

        reg_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        receipt = req.receipt_number or f"CASH-{uuid.uuid4().hex[:6].upper()}"
        event_query = "SELECT * FROM events WHERE id = %s"
        if not db.is_sqlite:
            event_query += " FOR UPDATE"

        coll_id = str(uuid.uuid4())
        with db.transaction():
            event = db.execute_one(event_query, (req.event_id,))
            if not event:
                raise ValueError("Event not found.")
            ensure_registration_window_open(event, datetime.now(timezone.utc))
            if not event.get("allow_offline"):
                raise ValueError("Offline cash registration is disabled for this event.")
            expected_amount = ticket_price_for_roll(event, req.roll_number)
            if round(float(req.amount_paid), 2) != expected_amount:
                raise ValueError(f"Cash amount must match the event fee of ₹{expected_amount:.2f}.")
            ensure_event_capacity_available(event)

            dup = db.execute_one(
                "SELECT id FROM registrations WHERE event_id = %s AND (LOWER(email) = LOWER(%s) OR LOWER(roll_number) = LOWER(%s))",
                (req.event_id, req.email.strip(), req.roll_number.strip()),
            )
            if dup:
                raise ValueError("Registration already exists for this student in this event.")

            db.execute_write(
                """INSERT INTO registrations (
                    id, event_id, user_id, full_name, roll_number, email, phone,
                    department, college, ticket_price, status, payment_method, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )""",
                (
                    reg_id, req.event_id, None, req.full_name.strip(),
                    req.roll_number.strip().upper(), req.email.strip().lower(),
                    req.phone.strip(), req.department.strip(), req.college.strip(),
                    req.amount_paid, "OFFLINE_PAID", "CASH", now, now,
                ),
            )
            db.execute_write(
                """INSERT INTO offline_collections (
                    id, collector_id, event_id, registration_id, amount, payment_method, receipt_number, notes, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (coll_id, collector_user_id, req.event_id, reg_id, req.amount_paid, "CASH", receipt, req.notes, now),
            )

            ticket = ticket_service.issue_ticket(reg_id, send_notification=False)
            audit_service.log("OFFLINE_CASH_REGISTRATION", "registration", reg_id, collector_user_id, {
                "amount": req.amount_paid,
                "receipt": receipt,
                "ticket_code": ticket["ticket_code"],
            })

        ticket_service.send_ticket_email(ticket)

        return OfflineRegistrationResponse(
            registration_id=reg_id,
            ticket_id=ticket["id"],
            ticket_code=ticket["ticket_code"],
            student_name=req.full_name,
            amount_paid=req.amount_paid,
            collector_id=collector_user_id,
            created_at=now
        )

    @staticmethod
    def get_collector_summary(collector_user_id: str, event_id: str = None):
        if event_id:
            query = """SELECT oc.*, r.full_name, r.roll_number, r.department, e.title as event_title
                       FROM offline_collections oc
                       JOIN registrations r ON oc.registration_id = r.id
                       JOIN events e ON oc.event_id = e.id
                       WHERE oc.collector_id = %s AND oc.event_id = %s
                       ORDER BY oc.created_at DESC"""
            params = (collector_user_id, event_id)
        else:
            query = """SELECT oc.*, r.full_name, r.roll_number, r.department, e.title as event_title
                       FROM offline_collections oc
                       JOIN registrations r ON oc.registration_id = r.id
                       JOIN events e ON oc.event_id = e.id
                       WHERE oc.collector_id = %s
                       ORDER BY oc.created_at DESC"""
            params = (collector_user_id,)
        
        collections = db.execute_query(query, params)
        total_cash = sum(float(c["amount"]) for c in collections)
        return {
            "collector_id": collector_user_id,
            "total_count": len(collections),
            "total_cash": total_cash,
            "collections": collections
        }

offline_service = OfflineService()
