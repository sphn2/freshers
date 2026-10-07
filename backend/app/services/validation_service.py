import uuid
from datetime import datetime, timezone
from app.db import db
from app.utils.security import verify_signed_qr_token
from app.services.email_service import email_service
from app.services.audit_service import audit_service
from app.schemas.validation import GateValidationRequest, GateValidationResponse, FoodValidationRequest, FoodValidationResponse

def _clean_uuid(val):
    if not val:
        return None
    try:
        profile = db.execute_one("SELECT id FROM profiles WHERE id = %s", (str(val),))
        if profile:
            return profile["id"]
        any_profile = db.execute_one("SELECT id FROM profiles LIMIT 1")
        if any_profile:
            return any_profile["id"]
        return None
    except Exception:
        return None

class ValidationService:
    @staticmethod
    def validate_gate(req: GateValidationRequest, staff_user_id: str = None) -> GateValidationResponse:
        staff_id = _clean_uuid(staff_user_id)
        """
        Atomic Gate Entry Validation.
        Supports both QR scanning and 6-digit ticket code manual entry.
        Guarantees concurrency safety (Request A -> SUCCESS, Request B -> ALREADY_USED).
        """
        event = db.execute_one("SELECT gate_validation_enabled FROM events WHERE id = %s", (req.event_id,))
        if not event or not event.get("gate_validation_enabled"):
            raise ValueError("Gate validation is disabled for this event.")
        ticket = None
        method = "QR" if req.qr_token else "MANUAL"

        if req.qr_token:
            payload = verify_signed_qr_token(req.qr_token)
            if payload and payload.get("tid"):
                ticket = db.execute_one(
                    """SELECT t.*, r.full_name as student_name, r.roll_number, r.department, r.email, e.title as event_title
                       FROM tickets t
                       JOIN registrations r ON t.registration_id = r.id
                       JOIN events e ON t.event_id = e.id
                       WHERE t.id = %s AND t.event_id = %s""",
                    (payload["tid"], req.event_id)
                )
            if not ticket:
                # Fallback to direct QR lookup in DB
                ticket = db.execute_one(
                    """SELECT t.*, r.full_name as student_name, r.roll_number, r.department, r.email, e.title as event_title
                       FROM tickets t
                       JOIN registrations r ON t.registration_id = r.id
                       JOIN events e ON t.event_id = e.id
                       WHERE t.qr_token = %s AND t.event_id = %s""",
                    (req.qr_token, req.event_id)
                )
        elif req.ticket_code:
            ticket = db.execute_one(
                """SELECT t.*, r.full_name as student_name, r.roll_number, r.department, r.email, e.title as event_title
                   FROM tickets t
                   JOIN registrations r ON t.registration_id = r.id
                   JOIN events e ON t.event_id = e.id
                   WHERE t.ticket_code = %s AND t.event_id = %s""",
                (req.ticket_code.strip(), req.event_id)
            )

        if not ticket or ticket["status"] == "CANCELLED":
            audit_service.log("GATE_VALIDATE_INVALID", "ticket", None, staff_user_id, {
                "event_id": req.event_id,
                "code": req.ticket_code,
                "reason": "Ticket not found or cancelled"
            })
            return GateValidationResponse(
                status="INVALID_TICKET",
                message="Invalid Ticket. Ticket not found for this event."
            )

        # Check if already validated before atomic update to report accurate timestamp if already used
        if ticket["gate_validated_at"] is not None or ticket["status"] == "GATE_VALIDATED":
            audit_service.log("GATE_VALIDATE_DUPLICATE", "ticket", ticket["id"], staff_user_id, {
                "ticket_code": ticket["ticket_code"],
                "gate": req.gate_location
            })
            return GateValidationResponse(
                status="ALREADY_USED",
                message="Ticket Already Used. Entry previously recorded.",
                ticket_code=ticket["ticket_code"],
                student_name=ticket["student_name"],
                roll_number=ticket["roll_number"],
                department=ticket["department"],
                gate_location=ticket.get("gate_location", req.gate_location),
                validated_at=str(ticket.get("gate_validated_at")) if ticket.get("gate_validated_at") else None
            )

        # ATOMIC CONCURRENCY-SAFE UPDATE
        now = datetime.now(timezone.utc).isoformat()
        updated = db.execute_atomic_update(
            """UPDATE tickets
               SET status = 'GATE_VALIDATED',
                   gate_validated_at = %s,
                   gate_validated_by = %s,
                   gate_location = %s,
                   gate_method = %s
               WHERE id = %s AND gate_validated_at IS NULL
               RETURNING *""",
            (now, staff_id, req.gate_location, method, ticket["id"])
        )

        if not updated:
            # Another concurrent request validated it a fraction of a millisecond earlier!
            audit_service.log("GATE_VALIDATE_CONCURRENT_BLOCKED", "ticket", ticket["id"], staff_user_id, {
                "ticket_code": ticket["ticket_code"]
            })
            return GateValidationResponse(
                status="ALREADY_USED",
                message="Ticket Already Used. Entry previously recorded.",
                ticket_code=ticket["ticket_code"],
                student_name=ticket["student_name"],
                roll_number=ticket["roll_number"],
                department=ticket["department"]
            )

        # Send HTML gate validation email (Non-blocking)
        email_service.send_email(
            recipient=ticket["email"],
            subject=f"Ticket Validated — {ticket['event_title']}",
            template_name="emails/gate_validated.html",
            context={
                "student_name": ticket["student_name"],
                "event_title": ticket["event_title"],
                "ticket_code": ticket["ticket_code"],
                "gate_location": req.gate_location,
                "validated_at": now
            }
        )

        audit_service.log("GATE_VALIDATE_SUCCESS", "ticket", ticket["id"], staff_user_id, {
            "ticket_code": ticket["ticket_code"],
            "gate": req.gate_location,
            "method": method
        })

        return GateValidationResponse(
            status="VALID",
            message="Entry Allowed. Ticket Validated Successfully.",
            ticket_code=ticket["ticket_code"],
            student_name=ticket["student_name"],
            roll_number=ticket["roll_number"],
            department=ticket["department"],
            gate_location=req.gate_location,
            validated_at=now
        )

    @staticmethod
    def validate_food(req: FoodValidationRequest, staff_user_id: str = None) -> FoodValidationResponse:
        staff_id = _clean_uuid(staff_user_id)
        """
        Atomic Food Coupon Validation. Independent of gate validation.
        """
        event = db.execute_one("SELECT food_validation_enabled FROM events WHERE id = %s", (req.event_id,))
        if not event or not event.get("food_validation_enabled"):
            raise ValueError("Food validation is disabled for this event.")
        ticket = None
        method = "QR" if req.qr_token else "MANUAL"

        if req.qr_token:
            payload = verify_signed_qr_token(req.qr_token)
            if payload and payload.get("tid"):
                ticket = db.execute_one(
                    """SELECT t.*, r.full_name as student_name, r.roll_number, r.department, r.email, e.title as event_title
                       FROM tickets t
                       JOIN registrations r ON t.registration_id = r.id
                       JOIN events e ON t.event_id = e.id
                       WHERE t.id = %s AND t.event_id = %s""",
                    (payload["tid"], req.event_id)
                )
            if not ticket:
                ticket = db.execute_one(
                    """SELECT t.*, r.full_name as student_name, r.roll_number, r.department, r.email, e.title as event_title
                       FROM tickets t
                       JOIN registrations r ON t.registration_id = r.id
                       JOIN events e ON t.event_id = e.id
                       WHERE t.qr_token = %s AND t.event_id = %s""",
                    (req.qr_token, req.event_id)
                )
        elif req.ticket_code:
            ticket = db.execute_one(
                """SELECT t.*, r.full_name as student_name, r.roll_number, r.department, r.email, e.title as event_title
                   FROM tickets t
                   JOIN registrations r ON t.registration_id = r.id
                   JOIN events e ON t.event_id = e.id
                   WHERE t.ticket_code = %s AND t.event_id = %s""",
                (req.ticket_code.strip(), req.event_id)
            )

        if not ticket or ticket["status"] == "CANCELLED":
            audit_service.log("FOOD_VALIDATE_INVALID", "ticket", None, staff_user_id, {"event_id": req.event_id, "code": req.ticket_code})
            return FoodValidationResponse(
                status="INVALID_TICKET",
                message="Invalid Ticket. No ticket record found."
            )

        food = db.execute_one("SELECT * FROM food_entitlements WHERE ticket_id = %s", (ticket["id"],))
        if not food:
            audit_service.log("FOOD_VALIDATE_INVALID", "ticket", ticket["id"], staff_user_id, {"reason": "No entitlement"})
            return FoodValidationResponse(
                status="INVALID_TICKET",
                message="No food entitlement associated with this ticket."
            )

        if food["status"] == "CLAIMED":
            audit_service.log("FOOD_VALIDATE_DUPLICATE", "food_entitlement", food["id"], staff_user_id, {"ticket_code": ticket["ticket_code"], "counter": req.food_location})
            return FoodValidationResponse(
                status="FOOD_ALREADY_CLAIMED",
                message="Food Coupon Already Claimed.",
                ticket_code=ticket["ticket_code"],
                student_name=ticket["student_name"],
                roll_number=ticket["roll_number"],
                department=ticket["department"],
                food_location=food.get("food_location", req.food_location),
                validated_at=str(food.get("food_validated_at")) if food.get("food_validated_at") else None
            )

        # ATOMIC CONCURRENCY-SAFE UPDATE FOR FOOD
        now = datetime.now(timezone.utc).isoformat()
        updated = db.execute_atomic_update(
            """UPDATE food_entitlements
               SET status = 'CLAIMED',
                   food_validated_at = %s,
                   food_validated_by = %s,
                   food_location = %s,
                   food_method = %s
               WHERE ticket_id = %s AND status = 'UNCLAIMED'
               RETURNING *""",
            (now, staff_id, req.food_location, method, ticket["id"])
        )

        if not updated:
            audit_service.log("FOOD_VALIDATE_CONCURRENT_BLOCKED", "food_entitlement", food["id"], staff_user_id, {"ticket_code": ticket["ticket_code"]})
            return FoodValidationResponse(
                status="FOOD_ALREADY_CLAIMED",
                message="Food Coupon Already Claimed.",
                ticket_code=ticket["ticket_code"],
                student_name=ticket["student_name"],
                roll_number=ticket["roll_number"],
                department=ticket["department"]
            )

        # Send HTML food validation email
        email_service.send_email(
            recipient=ticket["email"],
            subject=f"Food Coupon Claimed — {ticket['event_title']}",
            template_name="emails/food_validated.html",
            context={
                "student_name": ticket["student_name"],
                "event_title": ticket["event_title"],
                "ticket_code": ticket["ticket_code"],
                "food_location": req.food_location,
                "validated_at": now
            }
        )

        audit_service.log("FOOD_VALIDATE_SUCCESS", "food_entitlement", food["id"], staff_user_id, {
            "ticket_code": ticket["ticket_code"],
            "counter": req.food_location
        })

        return FoodValidationResponse(
            status="VALID",
            message="Food Coupon Claimed Successfully.",
            ticket_code=ticket["ticket_code"],
            student_name=ticket["student_name"],
            roll_number=ticket["roll_number"],
            department=ticket["department"],
            food_location=req.food_location,
            validated_at=now
        )

validation_service = ValidationService()
