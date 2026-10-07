import logging
import uuid
from datetime import datetime, timezone

import requests

from app.config import config
from app.db import db
from app.schemas.staff_account import StaffAccountCreate
from app.services.audit_service import audit_service

logger = logging.getLogger(__name__)


class StaffAccountError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


class StaffAccountService:
    @staticmethod
    def create_account(data: StaffAccountCreate, created_by: str) -> dict:
        if not config.SUPABASE_URL or not config.SUPABASE_SECRET_KEY:
            raise StaffAccountError(
                "Staff account provisioning is not configured on the backend.",
                503,
            )
        if data.role == "EVENT_MANAGER":
            if not data.event_id:
                raise StaffAccountError("Choose an event for the event manager.")
            if not db.execute_one("SELECT id FROM events WHERE id = %s", (data.event_id,)):
                raise StaffAccountError("The selected event does not exist.", 404)
        elif data.event_id:
            raise StaffAccountError("Only event managers can be assigned to an event.")

        auth_url = f"{config.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users"
        headers = {
            "apikey": config.SUPABASE_SECRET_KEY,
            "Authorization": f"Bearer {config.SUPABASE_SECRET_KEY}",
            "Content-Type": "application/json",
        }
        try:
            response = requests.post(
                auth_url,
                headers=headers,
                json={
                    "email": data.email,
                    "password": data.password,
                    "email_confirm": True,
                    "user_metadata": {"full_name": data.full_name},
                },
                timeout=10,
            )
        except requests.RequestException as exc:
            logger.warning("Supabase Auth user creation request failed: %s", type(exc).__name__)
            raise StaffAccountError("Could not reach Supabase Auth. Try again.", 502) from exc

        if response.status_code not in (200, 201):
            try:
                details = response.json()
            except ValueError:
                details = {}
            if not isinstance(details, dict):
                details = {}
            message = details.get("msg") or details.get("message") or details.get("error_description")
            if response.status_code in (400, 409, 422) and isinstance(message, str):
                raise StaffAccountError(message[:240], 409 if response.status_code == 409 else 400)
            logger.error("Supabase Auth user creation returned HTTP %s.", response.status_code)
            raise StaffAccountError("Supabase Auth could not create this account.", 502)

        try:
            auth_user = response.json()
        except ValueError as exc:
            raise StaffAccountError("Supabase Auth returned an invalid response.", 502) from exc
        user_id = auth_user.get("id")
        if not isinstance(user_id, str) or not user_id:
            raise StaffAccountError("Supabase Auth did not return the new user ID.", 502)

        now = datetime.now(timezone.utc).isoformat()
        try:
            with db.transaction():
                role = db.execute_one("SELECT id FROM roles WHERE name = %s", (data.role,))
                if not role:
                    raise RuntimeError(f"Required staff role is missing: {data.role}")

                db.execute_write(
                    """INSERT INTO profiles (id, email, full_name, created_at, updated_at)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (user_id, data.email, data.full_name, now, now),
                )
                db.execute_write(
                    """INSERT INTO user_roles (id, user_id, role_id, created_at)
                       VALUES (%s, %s, %s, %s)""",
                    (str(uuid.uuid4()), user_id, role["id"], now),
                )
                if data.role == "EVENT_MANAGER":
                    db.execute_write(
                        """INSERT INTO event_managers (id, event_id, user_id, created_at)
                           VALUES (%s, %s, %s, %s)""",
                        (str(uuid.uuid4()), data.event_id, user_id, now),
                    )
        except Exception as exc:
            delete_response = None
            try:
                delete_response = requests.delete(
                    f"{auth_url}/{user_id}",
                    headers=headers,
                    timeout=10,
                )
            except requests.RequestException:
                logger.exception("Could not roll back orphaned Supabase Auth user.")
            rollback_succeeded = (
                delete_response is not None
                and delete_response.status_code in (200, 204)
            )
            if not rollback_succeeded:
                logger.error(
                    "Supabase Auth rollback failed for user %s (HTTP %s).",
                    user_id,
                    delete_response.status_code if delete_response is not None else "no response",
                )
            raise StaffAccountError(
                "The app role could not be assigned. "
                + (
                    "The unassigned Auth user was removed."
                    if rollback_succeeded
                    else "The Auth user may still exist; remove it in Supabase Auth and contact an administrator."
                ),
                500,
            ) from exc

        audit_service.log(
            "CREATE_STAFF_ACCOUNT",
            "profile",
            user_id,
            created_by,
            {"email": data.email, "role": data.role, "event_id": data.event_id},
        )
        return {"id": user_id, "email": data.email, "full_name": data.full_name, "role": data.role}


staff_account_service = StaffAccountService()
