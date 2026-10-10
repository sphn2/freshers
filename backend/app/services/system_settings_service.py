from datetime import datetime, timezone
from app.db import db

class SystemSettingsService:
    @staticmethod
    def get_convenience_fee_settings() -> dict:
        try:
            enabled_row = db.execute_one("SELECT value FROM system_settings WHERE key = 'convenience_fee_enabled'")
            amount_row = db.execute_one("SELECT value FROM system_settings WHERE key = 'convenience_fee_amount'")
            
            enabled = (enabled_row["value"].lower() == "true") if enabled_row and enabled_row.get("value") else True
            try:
                amount = float(amount_row["value"]) if amount_row and amount_row.get("value") else 3.79
            except (ValueError, TypeError):
                amount = 3.79

            return {
                "enabled": enabled,
                "amount": amount,
            }
        except Exception:
            return {
                "enabled": True,
                "amount": 3.79,
            }

    @staticmethod
    def update_convenience_fee_settings(enabled: bool | None, amount: float | None, roles: list[str]) -> dict:
        current = SystemSettingsService.get_convenience_fee_settings()
        is_super = "SUPER_ADMIN" in roles

        if not is_super:
            raise PermissionError("Access denied. Only Super Admin can manage GST & Convenience fee settings.")

        now = datetime.now(timezone.utc).isoformat()

        if amount is not None:
            new_amount = round(float(amount), 2)
            if new_amount != round(float(current["amount"]), 2):
                if not is_super:
                    raise PermissionError("Only Super Admin can modify the GST & Convenience fee amount.")
                db.execute_write(
                    """INSERT INTO system_settings (key, value, updated_at)
                       VALUES ('convenience_fee_amount', %s, %s)
                       ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at""",
                    (str(new_amount), now)
                )

        if enabled is not None:
            db.execute_write(
                """INSERT INTO system_settings (key, value, updated_at)
                   VALUES ('convenience_fee_enabled', %s, %s)
                   ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at""",
                ("true" if enabled else "false", now)
            )

        return SystemSettingsService.get_convenience_fee_settings()

system_settings_service = SystemSettingsService()
