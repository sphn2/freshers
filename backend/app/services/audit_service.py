import uuid
import logging
from datetime import datetime, timezone
import json
from app.db import db

logger = logging.getLogger(__name__)

def _clean_audit_user_id(user_id: str):
    if not user_id:
        return None
    profile = db.execute_one("SELECT id FROM profiles WHERE id = %s", (str(user_id),))
    return profile["id"] if profile else None

class AuditService:
    @staticmethod
    def log(action: str, entity_type: str, entity_id: str = None, user_id: str = None, details: dict = None, ip_address: str = None):
        try:
            audit_id = str(uuid.uuid4())
            details_json = json.dumps(details, default=str) if details else None
            clean_uid = _clean_audit_user_id(user_id)
            db.execute_write(
                """INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    audit_id,
                    clean_uid,
                    action,
                    entity_type,
                    entity_id,
                    details_json,
                    ip_address,
                    datetime.now(timezone.utc).isoformat()
                )
            )
        except Exception:
            logger.exception("Failed to write audit event action=%s entity=%s.", action, entity_type)

audit_service = AuditService()
