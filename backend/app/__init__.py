from flask import Flask, jsonify
from flask_cors import CORS
import uuid
from datetime import datetime, timedelta, timezone

from app.config import config
from app.db import db
from app.api.v1.events import events_bp
from app.api.v1.registrations import registrations_bp
from app.api.v1.payments import payments_bp
from app.api.v1.tickets import tickets_bp
from app.api.v1.validation import validation_bp
from app.api.v1.offline import offline_bp
from app.api.v1.admin import admin_bp
from app.api.v1.auth import auth_bp

def create_app():
    config.validate_production()
    app = Flask(__name__)
    app.config.from_object(config)
    app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024

    origins = [origin.strip() for origin in config.ALLOWED_ORIGINS.split(",") if origin.strip()]
    if not config.is_production and "http://localhost:3000" not in origins:
        origins.append("http://localhost:3000")

    allowed_headers = ["Content-Type", "Authorization"]
    if app.config.get("TESTING"):
        allowed_headers.extend(["X-Test-User-Role", "X-Test-User-Id", "X-Test-User-Email"])

    CORS(app, resources={r"/api/*": {
        "origins": origins,
        "allow_headers": allowed_headers + [
            "X-Razorpay-Signature",
            "X-Registration-Token",
            "X-Ticket-Token",
        ],
        "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    }})

    # Secure HTTP Headers
    @app.after_request
    def add_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        if config.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    # Register Blueprints under /api/v1
    app.register_blueprint(events_bp)
    app.register_blueprint(registrations_bp)
    app.register_blueprint(payments_bp)
    app.register_blueprint(tickets_bp)
    app.register_blueprint(validation_bp)
    app.register_blueprint(offline_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(auth_bp)

    @app.route("/api/v1/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "HEALTHY",
            "system": "SPHOORTHY EVENTS API",
            "version": "1.0.0",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }), 200

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Resource not found."}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error occurred."}), 500

    if config.SEED_DEMO_DATA and not config.is_production:
        seed_default_event()

    return app

def seed_default_event():
    existing = db.execute_one("SELECT id FROM events WHERE slug = 'freshers-2k26'")
    if not existing:
        now = datetime.now(timezone.utc)
        start_time = now + timedelta(days=5)
        end_time = start_time + timedelta(hours=8)
        reg_start = now - timedelta(days=1)
        reg_end = start_time - timedelta(hours=2)

        event_id = str(uuid.uuid4())
        db.execute_write(
                """INSERT INTO events (
                    id, title, slug, description, event_type, logo_url, banner_url, venue,
                    start_time, end_time, registration_start, registration_end, capacity,
                    ticket_price, first_year_ticket_price, second_year_ticket_price,
                    allow_online, allow_offline, allow_autofill,
                    registration_open, gate_validation_enabled, food_validation_enabled,
                    status, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s
                )""",
                (
                    event_id,
                    "Sphoorthy Freshers 2K26",
                    "freshers-2k26",
                    "Official Annual Freshers Celebration & Cultural Fest for First Year Engineering Students.",
                    "CULTURAL",
                    "/logo.png",
                    "/banner.png",
                    "Main Campus Auditorium, Sphoorthy Engineering College",
                    start_time.isoformat(),
                    end_time.isoformat(),
                    reg_start.isoformat(),
                    reg_end.isoformat(),
                    1500,
                    250.00,
                    500.0,
                    600.0,
                    True,
                    True,
                    True,
                    None,
                    True,
                    True,
                    "PUBLISHED",
                    now.isoformat(),
                    now.isoformat()
                )
        )
