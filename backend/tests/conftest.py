import os


os.environ.update(
    {
        "FLASK_ENV": "test",
        "FLASK_DEBUG": "false",
        "TESTING": "true",
        "USE_SQLITE": "true",
        "SQLITE_DATABASE_PATH": ":memory:",
        "SEED_DEMO_DATA": "true",
        "SECRET_KEY": "test-only-app-secret-key-not-for-production",
        "TICKET_SECRET_KEY": "test-only-ticket-secret-key-not-for-production",
        "SUPABASE_URL": "",
        "SUPABASE_JWKS_URL": "",
        "SUPABASE_JWT_SECRET": "",
        "DATABASE_URL": "",
        "SMTP_USERNAME": "",
        "SMTP_PASSWORD": "",
        "RAZORPAY_KEY_ID": "",
        "RAZORPAY_KEY_SECRET": "",
        "RAZORPAY_WEBHOOK_SECRET": "",
        "APP_URL": "http://localhost:3000",
        "ALLOWED_ORIGINS": "http://localhost:3000",
    }
)
