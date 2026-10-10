from datetime import datetime, timezone
import logging

from app.db import db
from app.schemas.validation import (
    FoodValidationRequest,
    FoodValidationResponse,
    GateValidationRequest,
    GateValidationResponse,
)
from app.services.audit_service import audit_service
from app.services.email_service import email_service
from app.utils.security import verify_signed_qr_token

logger = logging.getLogger(__name__)


def _clean_uuid(user_id: str | None) -> str | None:
    if not user_id:
        return None
    profile = db.execute_one(
        "SELECT id FROM profiles WHERE id = %s",
        (str(user_id),),
    )
    if profile:
        return profile["id"]
    any_profile = db.execute_one("SELECT id FROM profiles LIMIT 1")
    return any_profile["id"] if any_profile else None


def _ticket_lookup(req, lock: bool = False):
    if req.qr_token:
        payload = verify_signed_qr_token(req.qr_token)
        lookups = (
            [("t.id", payload["tid"]), ("t.qr_token", req.qr_token)]
            if payload and payload.get("tid")
            else [("t.qr_token", req.qr_token)]
        )
    else:
        lookups = [("t.ticket_code", req.ticket_code.strip())]

    for lookup_column, lookup_value in lookups:
        query = f"""SELECT t.*, r.full_name AS student_name, r.roll_number,
                           r.department, r.email, e.title AS event_title
                    FROM tickets t
                    JOIN registrations r ON r.id = t.registration_id
                    JOIN events e ON e.id = t.event_id
                    WHERE {lookup_column} = %s AND t.event_id = %s"""
        if lock and not db.is_sqlite:
            query += " FOR UPDATE OF t"
        ticket = db.execute_one(query, (lookup_value, req.event_id))
        if ticket:
            return ticket
    return None


class ValidationService:
    @staticmethod
    def _queue_notification(
        recipient: str,
        subject: str,
        template_name: str,
        context: dict,
        ticket_id: str,
    ) -> None:
        # Non-blocking notification dispatch for rapid scan speeds
        try:
            email_service.enqueue_email(
                recipient=recipient,
                subject=subject,
                template_name=template_name,
                context=context,
            )
        except Exception:
            pass

    @staticmethod
    def validate_gate(
        req: GateValidationRequest,
        staff_user_id: str | None = None,
    ) -> GateValidationResponse:
        with db.transaction():
            staff_id = _clean_uuid(staff_user_id)
            event = db.execute_one(
                "SELECT gate_validation_enabled FROM events WHERE id = %s",
                (req.event_id,),
            )
            if not event or not event.get("gate_validation_enabled"):
                raise ValueError("Gate validation is disabled for this event.")

            ticket = _ticket_lookup(req, lock=True)
            if not ticket or ticket["status"] == "CANCELLED":
                audit_service.log(
                    "GATE_VALIDATE_INVALID",
                    "ticket",
                    None,
                    staff_user_id,
                    {
                        "event_id": req.event_id,
                        "code": req.ticket_code,
                        "reason": "Ticket not found or cancelled",
                    },
                )
                return GateValidationResponse(
                    status="INVALID_TICKET",
                    message="Invalid Ticket. Ticket not found for this event.",
                )

            if ticket["gate_validated_at"] is not None or ticket["status"] == "GATE_VALIDATED":
                audit_service.log(
                    "GATE_VALIDATE_DUPLICATE",
                    "ticket",
                    ticket["id"],
                    staff_user_id,
                    {"ticket_code": ticket["ticket_code"], "gate": req.gate_location},
                )
                return GateValidationResponse(
                    status="ALREADY_USED",
                    message="Ticket Already Used. Entry previously recorded.",
                    ticket_code=ticket["ticket_code"],
                    student_name=ticket["student_name"],
                    roll_number=ticket["roll_number"],
                    department=ticket["department"],
                    gate_location=ticket.get("gate_location", req.gate_location),
                    validated_at=(
                        str(ticket["gate_validated_at"])
                        if ticket.get("gate_validated_at")
                        else None
                    ),
                )

            now = datetime.now(timezone.utc).isoformat()
            updated = db.execute_atomic_update(
                """UPDATE tickets
                   SET status = 'GATE_VALIDATED',
                       gate_validated_at = %s,
                       gate_validated_by = %s,
                       gate_location = %s,
                       gate_method = %s
                   WHERE id = %s AND gate_validated_at IS NULL
                   RETURNING id""",
                (
                    now,
                    staff_id,
                    req.gate_location,
                    "QR" if req.qr_token else "MANUAL",
                    ticket["id"],
                ),
            )
            if not updated:
                audit_service.log(
                    "GATE_VALIDATE_CONCURRENT_BLOCKED",
                    "ticket",
                    ticket["id"],
                    staff_user_id,
                    {"ticket_code": ticket["ticket_code"]},
                )
                return GateValidationResponse(
                    status="ALREADY_USED",
                    message="Ticket Already Used. Entry previously recorded.",
                    ticket_code=ticket["ticket_code"],
                    student_name=ticket["student_name"],
                    roll_number=ticket["roll_number"],
                    department=ticket["department"],
                )

            audit_service.log(
                "GATE_VALIDATE_SUCCESS",
                "ticket",
                ticket["id"],
                staff_user_id,
                {
                    "ticket_code": ticket["ticket_code"],
                    "gate": req.gate_location,
                    "method": "QR" if req.qr_token else "MANUAL",
                },
            )
            ValidationService._queue_notification(
                ticket["email"],
                f"Ticket Validated — {ticket['event_title']}",
                "emails/gate_validated.html",
                {
                    "student_name": ticket["student_name"],
                    "event_title": ticket["event_title"],
                    "ticket_code": ticket["ticket_code"],
                    "gate_location": req.gate_location,
                    "validated_at": now,
                },
                ticket["id"],
            )
            return GateValidationResponse(
                status="VALID",
                message="Entry Allowed. Ticket Validated Successfully.",
                ticket_code=ticket["ticket_code"],
                student_name=ticket["student_name"],
                roll_number=ticket["roll_number"],
                department=ticket["department"],
                gate_location=req.gate_location,
                validated_at=now,
            )

    @staticmethod
    def validate_food(
        req: FoodValidationRequest,
        staff_user_id: str | None = None,
    ) -> FoodValidationResponse:
        with db.transaction():
            staff_id = _clean_uuid(staff_user_id)
            event = db.execute_one(
                "SELECT food_validation_enabled FROM events WHERE id = %s",
                (req.event_id,),
            )
            if not event or not event.get("food_validation_enabled"):
                raise ValueError("Food validation is disabled for this event.")

            ticket = _ticket_lookup(req, lock=True)
            if not ticket or ticket["status"] == "CANCELLED":
                audit_service.log(
                    "FOOD_VALIDATE_INVALID",
                    "ticket",
                    None,
                    staff_user_id,
                    {"event_id": req.event_id, "code": req.ticket_code},
                )
                return FoodValidationResponse(
                    status="INVALID_TICKET",
                    message="Invalid Ticket. No ticket record found.",
                )

            food_query = "SELECT * FROM food_entitlements WHERE ticket_id = %s"
            if not db.is_sqlite:
                food_query += " FOR UPDATE"
            food = db.execute_one(food_query, (ticket["id"],))
            if not food:
                audit_service.log(
                    "FOOD_VALIDATE_INVALID",
                    "ticket",
                    ticket["id"],
                    staff_user_id,
                    {"reason": "No entitlement"},
                )
                return FoodValidationResponse(
                    status="INVALID_TICKET",
                    message="No food entitlement associated with this ticket.",
                )

            if food["status"] == "CLAIMED":
                audit_service.log(
                    "FOOD_VALIDATE_DUPLICATE",
                    "food_entitlement",
                    food["id"],
                    staff_user_id,
                    {
                        "ticket_code": ticket["ticket_code"],
                        "counter": req.food_location,
                    },
                )
                return FoodValidationResponse(
                    status="FOOD_ALREADY_CLAIMED",
                    message="Food Coupon Already Claimed.",
                    ticket_code=ticket["ticket_code"],
                    student_name=ticket["student_name"],
                    roll_number=ticket["roll_number"],
                    department=ticket["department"],
                    food_location=food.get("food_location", req.food_location),
                    validated_at=(
                        str(food["food_validated_at"])
                        if food.get("food_validated_at")
                        else None
                    ),
                )

            now = datetime.now(timezone.utc).isoformat()
            updated = db.execute_atomic_update(
                """UPDATE food_entitlements
                   SET status = 'CLAIMED',
                       food_validated_at = %s,
                       food_validated_by = %s,
                       food_location = %s,
                       food_method = %s
                   WHERE ticket_id = %s AND status = 'UNCLAIMED'
                   RETURNING id""",
                (
                    now,
                    staff_id,
                    req.food_location,
                    "QR" if req.qr_token else "MANUAL",
                    ticket["id"],
                ),
            )
            if not updated:
                audit_service.log(
                    "FOOD_VALIDATE_CONCURRENT_BLOCKED",
                    "food_entitlement",
                    food["id"],
                    staff_user_id,
                    {"ticket_code": ticket["ticket_code"]},
                )
                return FoodValidationResponse(
                    status="FOOD_ALREADY_CLAIMED",
                    message="Food Coupon Already Claimed.",
                    ticket_code=ticket["ticket_code"],
                    student_name=ticket["student_name"],
                    roll_number=ticket["roll_number"],
                    department=ticket["department"],
                )

            audit_service.log(
                "FOOD_VALIDATE_SUCCESS",
                "food_entitlement",
                food["id"],
                staff_user_id,
                {
                    "ticket_code": ticket["ticket_code"],
                    "counter": req.food_location,
                },
            )
            ValidationService._queue_notification(
                ticket["email"],
                f"Food Coupon Claimed — {ticket['event_title']}",
                "emails/food_validated.html",
                {
                    "student_name": ticket["student_name"],
                    "event_title": ticket["event_title"],
                    "ticket_code": ticket["ticket_code"],
                    "food_location": req.food_location,
                    "validated_at": now,
                },
                ticket["id"],
            )
            return FoodValidationResponse(
                status="VALID",
                message="Food Coupon Claimed Successfully.",
                ticket_code=ticket["ticket_code"],
                student_name=ticket["student_name"],
                roll_number=ticket["roll_number"],
                department=ticket["department"],
                food_location=req.food_location,
                validated_at=now,
            )


validation_service = ValidationService()
