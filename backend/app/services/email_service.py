import smtplib
import logging
import hashlib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from jinja2 import Environment, FileSystemLoader, select_autoescape
import os
import uuid
import json
from datetime import datetime, timedelta, timezone
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

    def enqueue_email(
        self,
        recipient: str,
        subject: str,
        template_name: str,
        context: dict,
    ) -> str:
        job_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        db.execute_write(
            """INSERT INTO email_outbox (
                   id, recipient, subject, template_name, context,
                   status, attempts, available_at, created_at
               ) VALUES (%s, %s, %s, %s, %s, 'PENDING', 0, %s, %s)""",
            (
                job_id,
                recipient,
                subject,
                template_name,
                json.dumps(context),
                now,
                now,
            ),
        )
        return job_id

    def process_next_queued_email(self) -> dict:
        now = datetime.now(timezone.utc)
        now_text = now.isoformat()
        stale_before = (now - timedelta(minutes=15)).isoformat()
        retention_before = (now - timedelta(days=30)).isoformat()
        with db.transaction():
            db.execute_write(
                """DELETE FROM email_outbox
                   WHERE status IN ('SENT', 'FAILED') AND created_at < %s""",
                (retention_before,),
            )
            db.execute_write(
                """UPDATE email_outbox
                   SET status = 'FAILED', claimed_at = NULL,
                       last_error = 'Worker abandoned maximum attempts'
                   WHERE status = 'PROCESSING'
                     AND claimed_at < %s AND attempts >= 8""",
                (stale_before,),
            )
            query = """SELECT * FROM email_outbox
                       WHERE (
                           status = 'PENDING' AND available_at <= %s
                       ) OR (
                           status = 'PROCESSING' AND claimed_at < %s
                           AND attempts < 8
                       )
                       ORDER BY available_at, created_at
                       LIMIT 1"""
            if not db.is_sqlite:
                query += " FOR UPDATE SKIP LOCKED"
            job = db.execute_one(query, (now_text, stale_before))
            if not job:
                return {"processed": False, "status": "EMPTY"}

            attempts = int(job["attempts"]) + 1
            claimed = db.execute_write(
                """UPDATE email_outbox
                   SET status = 'PROCESSING', attempts = %s, claimed_at = %s
                   WHERE id = %s
                     AND (
                         status = 'PENDING'
                         OR (status = 'PROCESSING' AND claimed_at < %s)
                     )""",
                (attempts, now_text, job["id"], stale_before),
            )
            if not claimed:
                return {"processed": False, "status": "BUSY"}

        context = job["context"]
        if isinstance(context, str):
            context = json.loads(context)
        delivered = self.send_email(
            recipient=job["recipient"],
            subject=job["subject"],
            template_name=job["template_name"],
            context=context,
            metadata={"outbox_id": job["id"]},
            smtp_timeout=6,
        )
        if delivered:
            db.execute_write(
                """UPDATE email_outbox
                   SET status = 'SENT', sent_at = %s, claimed_at = NULL,
                       last_error = NULL
                   WHERE id = %s AND status = 'PROCESSING'""",
                (datetime.now(timezone.utc).isoformat(), job["id"]),
            )
            return {"processed": True, "status": "SENT"}

        retry_at = (
            datetime.now(timezone.utc)
            + timedelta(minutes=min(2 ** min(attempts, 6), 60))
        ).isoformat()
        next_status = "PENDING" if attempts < 8 else "FAILED"
        db.execute_write(
            """UPDATE email_outbox
               SET status = %s, available_at = %s, claimed_at = NULL,
                   last_error = 'Email delivery failed'
               WHERE id = %s AND status = 'PROCESSING'""",
            (next_status, retry_at, job["id"]),
        )
        return {"processed": True, "status": next_status}

    def send_email(
        self,
        recipient: str,
        subject: str,
        template_name: str,
        context: dict,
        inline_images: dict[str, bytes] | None = None,
        metadata: dict | None = None,
        smtp_timeout: float = 10,
    ) -> bool:
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
                (
                    log_id,
                    recipient,
                    subject,
                    template_name,
                    "PENDING",
                    json.dumps({"template": template_name, **(metadata or {})}),
                    datetime.now(timezone.utc).isoformat(),
                )
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
            msg = MIMEMultipart("related" if inline_images else "alternative")
            msg["Subject"] = subject
            msg["From"] = f"{config.SMTP_FROM_NAME} <{config.SMTP_FROM_EMAIL}>"
            msg["To"] = recipient

            body = MIMEMultipart("alternative") if inline_images else msg
            if inline_images:
                msg.attach(body)

            part = MIMEText(html_content, "html")
            body.attach(part)

            for content_id, image_data in (inline_images or {}).items():
                image = MIMEImage(image_data, _subtype="png")
                image.add_header("Content-ID", f"<{content_id}>")
                image.add_header(
                    "Content-Disposition",
                    "inline",
                    filename="ticket-qr.png",
                )
                msg.attach(image)
                fallback_image = MIMEImage(image_data, _subtype="png")
                fallback_image.add_header(
                    "Content-Disposition",
                    "attachment",
                    filename="ticket-qr.png",
                )
                msg.attach(fallback_image)

            with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=smtp_timeout) as server:
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
