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

    @staticmethod
    def get_payment_gateway_settings() -> dict:
        from app.config import config
        try:
            default_row = db.execute_one("SELECT value FROM system_settings WHERE key = 'default_payment_gateway'")
            rzp_row = db.execute_one("SELECT value FROM system_settings WHERE key = 'razorpay_enabled'")
            cf_row = db.execute_one("SELECT value FROM system_settings WHERE key = 'cashfree_enabled'")
            pe_row = db.execute_one("SELECT value FROM system_settings WHERE key = 'phonepe_enabled'")

            default_gw = default_row["value"].upper() if default_row and default_row.get("value") else "RAZORPAY"
            rzp_enabled = rzp_row["value"].lower() == "true" if rzp_row and rzp_row.get("value") else True
            cf_enabled = cf_row["value"].lower() == "true" if cf_row and cf_row.get("value") else True
            pe_enabled = pe_row["value"].lower() == "true" if pe_row and pe_row.get("value") else True

            return {
                "default_gateway": default_gw,
                "gateways": {
                    "RAZORPAY": {
                        "name": "Razorpay",
                        "enabled": rzp_enabled,
                        "configured": bool(config.RAZORPAY_KEY_ID and config.RAZORPAY_KEY_SECRET),
                    },
                    "CASHFREE": {
                        "name": "Cashfree",
                        "enabled": cf_enabled,
                        "configured": bool(config.CASHFREE_APP_ID and config.CASHFREE_SECRET_KEY),
                        "env": config.CASHFREE_ENV,
                    },
                    "PHONEPE": {
                        "name": "PhonePe",
                        "enabled": pe_enabled,
                        "configured": bool(config.PHONEPE_MERCHANT_ID and config.PHONEPE_SALT_KEY),
                        "env": config.PHONEPE_ENV,
                    },
                },
            }
        except Exception:
            from app.config import config
            return {
                "default_gateway": "RAZORPAY",
                "gateways": {
                    "RAZORPAY": {"name": "Razorpay", "enabled": True, "configured": bool(config.RAZORPAY_KEY_ID)},
                    "CASHFREE": {"name": "Cashfree", "enabled": True, "configured": bool(config.CASHFREE_APP_ID), "env": config.CASHFREE_ENV},
                    "PHONEPE": {"name": "PhonePe", "enabled": True, "configured": bool(config.PHONEPE_MERCHANT_ID), "env": config.PHONEPE_ENV},
                },
            }

    @staticmethod
    def update_payment_gateway_settings(default_gateway: str | None, gateways_enabled: dict | None, roles: list[str]) -> dict:
        if "SUPER_ADMIN" not in roles:
            raise PermissionError("Access denied. Only Super Admin can manage Payment Gateway settings.")

        now = datetime.now(timezone.utc).isoformat()

        if default_gateway:
            norm_default = default_gateway.strip().upper()
            if norm_default not in ("RAZORPAY", "CASHFREE", "PHONEPE"):
                raise ValueError("Invalid default payment gateway.")
            db.execute_write(
                """INSERT INTO system_settings (key, value, updated_at)
                   VALUES ('default_payment_gateway', %s, %s)
                   ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at""",
                (norm_default, now)
            )

        if gateways_enabled and isinstance(gateways_enabled, dict):
            for gw_name, is_enabled in gateways_enabled.items():
                gw_key = f"{gw_name.strip().lower()}_enabled"
                db.execute_write(
                    f"""INSERT INTO system_settings (key, value, updated_at)
                       VALUES (%s, %s, %s)
                       ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at""",
                    (gw_key, "true" if is_enabled else "false", now)
                )

        return SystemSettingsService.get_payment_gateway_settings()

system_settings_service = SystemSettingsService()
