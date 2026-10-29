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

    @staticmethod
    def get_banner_settings() -> dict:
        default_closed_text = "Online registrations are completely closed. No more registrations will be accepted online."
        default_maint_text = "Website is Under Maintenance. This maintenance is to ensure your seamless experience and proper security. The website will be live within 10-15 minutes."
        default_popup_title = "Hurry up! Registrations closing soon!"
        default_popup_message = "Online registrations will close on the specified date & time. Register online now before passes are sold out!"
        default_offline_contacts = "Contact organizing team for offline registrations: Sai Harsha (8179645560) | Rahul (9876543210) | SPHN Registration Desk @ Main Campus"

        try:
            closed_row = db.execute_one("SELECT value FROM system_settings WHERE key = 'banner_registrations_closed'")
            closed_text_row = db.execute_one("SELECT value FROM system_settings WHERE key = 'banner_registrations_closed_text'")
            maint_row = db.execute_one("SELECT value FROM system_settings WHERE key = 'banner_maintenance_mode'")
            maint_text_row = db.execute_one("SELECT value FROM system_settings WHERE key = 'banner_maintenance_mode_text'")

            popup_enabled_row = db.execute_one("SELECT value FROM system_settings WHERE key = 'popup_enabled'")
            popup_title_row = db.execute_one("SELECT value FROM system_settings WHERE key = 'popup_title'")
            popup_closing_row = db.execute_one("SELECT value FROM system_settings WHERE key = 'popup_closing_time'")
            popup_msg_row = db.execute_one("SELECT value FROM system_settings WHERE key = 'popup_message'")
            offline_contact_row = db.execute_one("SELECT value FROM system_settings WHERE key = 'offline_contact_details'")

            registrations_closed = (closed_row["value"].lower() == "true") if closed_row and closed_row.get("value") else False
            registrations_closed_text = closed_text_row["value"] if closed_text_row and closed_text_row.get("value") else default_closed_text
            maintenance_mode = (maint_row["value"].lower() == "true") if maint_row and maint_row.get("value") else False
            maintenance_mode_text = maint_text_row["value"] if maint_text_row and maint_text_row.get("value") else default_maint_text

            popup_enabled = (popup_enabled_row["value"].lower() == "true") if popup_enabled_row and popup_enabled_row.get("value") else False
            popup_title = popup_title_row["value"] if popup_title_row and popup_title_row.get("value") else default_popup_title
            popup_closing_time = popup_closing_row["value"] if popup_closing_row and popup_closing_row.get("value") else ""
            popup_message = popup_msg_row["value"] if popup_msg_row and popup_msg_row.get("value") else default_popup_message
            offline_contact_details = offline_contact_row["value"] if offline_contact_row and offline_contact_row.get("value") else default_offline_contacts

            return {
                "registrations_closed": registrations_closed,
                "registrations_closed_text": registrations_closed_text,
                "maintenance_mode": maintenance_mode,
                "maintenance_mode_text": maintenance_mode_text,
                "popup_enabled": popup_enabled,
                "popup_title": popup_title,
                "popup_closing_time": popup_closing_time,
                "popup_message": popup_message,
                "offline_contact_details": offline_contact_details,
            }
        except Exception:
            return {
                "registrations_closed": False,
                "registrations_closed_text": default_closed_text,
                "maintenance_mode": False,
                "maintenance_mode_text": default_maint_text,
                "popup_enabled": False,
                "popup_title": default_popup_title,
                "popup_closing_time": "",
                "popup_message": default_popup_message,
                "offline_contact_details": default_offline_contacts,
            }

    @staticmethod
    def update_banner_settings(
        registrations_closed: bool | None,
        registrations_closed_text: str | None,
        maintenance_mode: bool | None,
        maintenance_mode_text: str | None,
        roles: list[str],
        popup_enabled: bool | None = None,
        popup_title: str | None = None,
        popup_closing_time: str | None = None,
        popup_message: str | None = None,
        offline_contact_details: str | None = None,
    ) -> dict:
        is_super = "SUPER_ADMIN" in roles
        is_admin = is_super or "ADMIN" in roles

        if not is_admin:
            raise PermissionError("Access denied. Admin privileges are required to manage announcement banners.")

        # Maintenance mode is restricted to Super Admin only
        if (maintenance_mode is not None or maintenance_mode_text is not None) and not is_super:
            raise PermissionError("Access denied. Only Super Admin can toggle or modify Website Maintenance Mode.")

        now = datetime.now(timezone.utc).isoformat()

        if registrations_closed is not None:
            db.execute_write(
                """INSERT INTO system_settings (key, value, updated_at)
                   VALUES ('banner_registrations_closed', %s, %s)
                   ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at""",
                ("true" if registrations_closed else "false", now)
            )

        if registrations_closed_text is not None:
            clean_text = registrations_closed_text.strip()
            db.execute_write(
                """INSERT INTO system_settings (key, value, updated_at)
                   VALUES ('banner_registrations_closed_text', %s, %s)
                   ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at""",
                (clean_text, now)
            )

        if maintenance_mode is not None:
            db.execute_write(
                """INSERT INTO system_settings (key, value, updated_at)
                   VALUES ('banner_maintenance_mode', %s, %s)
                   ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at""",
                ("true" if maintenance_mode else "false", now)
            )

        if maintenance_mode_text is not None:
            clean_maint_text = maintenance_mode_text.strip()
            db.execute_write(
                """INSERT INTO system_settings (key, value, updated_at)
                   VALUES ('banner_maintenance_mode_text', %s, %s)
                   ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at""",
                (clean_maint_text, now)
            )

        if popup_enabled is not None:
            db.execute_write(
                """INSERT INTO system_settings (key, value, updated_at)
                   VALUES ('popup_enabled', %s, %s)
                   ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at""",
                ("true" if popup_enabled else "false", now)
            )

        if popup_title is not None:
            db.execute_write(
                """INSERT INTO system_settings (key, value, updated_at)
                   VALUES ('popup_title', %s, %s)
                   ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at""",
                (popup_title.strip(), now)
            )

        if popup_closing_time is not None:
            db.execute_write(
                """INSERT INTO system_settings (key, value, updated_at)
                   VALUES ('popup_closing_time', %s, %s)
                   ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at""",
                (popup_closing_time.strip(), now)
            )

        if popup_message is not None:
            db.execute_write(
                """INSERT INTO system_settings (key, value, updated_at)
                   VALUES ('popup_message', %s, %s)
                   ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at""",
                (popup_message.strip(), now)
            )

        if offline_contact_details is not None:
            db.execute_write(
                """INSERT INTO system_settings (key, value, updated_at)
                   VALUES ('offline_contact_details', %s, %s)
                   ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at""",
                (offline_contact_details.strip(), now)
            )

        return SystemSettingsService.get_banner_settings()

system_settings_service = SystemSettingsService()
