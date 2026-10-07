import smtplib
import logging
import hashlib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Environment, FileSystemLoader, select_autoescape
import os
import uuid
from datetime import datetime, timezone
import json
from flask import current_app, has_app_context
from app.config import config
from app.db import db

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        template_dir = os.path.join(os.path.dirname(__file__), "..", "templates")
        self.jinja_env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=select_autoescape(("html", "xml")),
        )

    def render_template(self, template_name: str, context: dict) -> str:
        template = self.jinja_env.get_template(template_name)
        return template.render(**context)

    def send_email(self, recipient: str, subject: str, template_name: str, context: dict) -> bool:
        """
        Renders HTML email, sends via SMTP if configured, and records log in database.
        Exceptions are caught so email errors never block DB transactions.
        """
        html_content = ""
        log_id = str(uuid.uuid4())
        try:
            html_content = self.render_template(template_name, context)
            
            # Log pending state
            db.execute_write(
                """INSERT INTO email_logs (id, recipient, subject, template_name, status, metadata, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (log_id, recipient, subject, template_name, "PENDING", json.dumps({"template": template_name}), datetime.now(timezone.utc).isoformat())
            )

            if has_app_context() and current_app.config.get("TESTING"):
                db.execute_write(
                    "UPDATE email_logs SET status = %s WHERE id = %s",
                    ("MOCKED", log_id)
                )
                return True
            if not config.SMTP_USERNAME or not config.SMTP_PASSWORD:
                logger.warning("Email delivery skipped because SMTP is not configured.")
                db.execute_write(
                    "UPDATE email_logs SET status = %s, error_message = %s WHERE id = %s",
                    ("FAILED", "SMTP is not configured.", log_id),
                )
                return False

            # Perform SMTP Send
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{config.SMTP_FROM_NAME} <{config.SMTP_FROM_EMAIL}>"
            msg["To"] = recipient

            part = MIMEText(html_content, "html")
            msg.attach(part)

            with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=10) as server:
                server.starttls()
                server.login(config.SMTP_USERNAME, config.SMTP_PASSWORD)
                server.sendmail(config.SMTP_FROM_EMAIL, recipient, msg.as_string())

            db.execute_write(
                "UPDATE email_logs SET status = %s WHERE id = %s",
                ("SENT", log_id)
            )
            logger.info(
                "Email delivered to recipient_hash=%s",
                hashlib.sha256(recipient.casefold().encode("utf-8")).hexdigest(),
            )
            return True

        except Exception as exc:
            logger.exception(
                "Email delivery failed for recipient_hash=%s",
                hashlib.sha256(recipient.casefold().encode("utf-8")).hexdigest(),
            )
            db.execute_write(
                "UPDATE email_logs SET status = %s, error_message = %s WHERE id = %s",
                ("FAILED", type(exc).__name__, log_id)
            )
            return False

email_service = EmailService()
