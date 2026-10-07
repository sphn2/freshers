import hmac

from flask import Blueprint, current_app, jsonify, request

from app.config import config
from app.services.email_service import email_service

email_outbox_bp = Blueprint("email_outbox", __name__, url_prefix="/api/v1/internal")


@email_outbox_bp.route("/email-outbox/process", methods=["POST"])
def process_email_outbox():
    expected_secret = config.EMAIL_OUTBOX_WORKER_SECRET
    if len(expected_secret) < 32:
        current_app.logger.error("Email outbox worker secret is not configured.")
        return jsonify({"error": "Email outbox worker is not configured."}), 503

    authorization = request.headers.get("Authorization", "")
    scheme, separator, supplied_secret = authorization.partition(" ")
    if (
        not separator
        or scheme.lower() != "bearer"
        or not hmac.compare_digest(supplied_secret, expected_secret)
    ):
        return jsonify({"error": "Unauthorized."}), 401

    try:
        return jsonify(email_service.process_next_queued_email()), 200
    except Exception:
        current_app.logger.exception("Email outbox worker failed to process a queued email.")
        return jsonify({"error": "Email outbox processing failed."}), 500
