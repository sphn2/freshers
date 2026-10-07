import os
from pathlib import Path
from dotenv import load_dotenv

# Load the workspace .env for local development. Production configuration is
# supplied by the hosting environment.
load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env")
load_dotenv()

class Config:

    # App Config
    ENV: str = os.getenv("FLASK_ENV", "development")
    DEBUG: bool = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    TESTING: bool = os.getenv("TESTING", "false").lower() == "true"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    TICKET_SECRET_KEY: str = os.getenv("TICKET_SECRET_KEY", "")
    SEED_DEMO_DATA: bool = os.getenv("SEED_DEMO_DATA", "false").lower() in ("true", "1")

    # Database & Supabase
    USE_SQLITE: bool = os.getenv(
        "USE_SQLITE", "false" if ENV.lower() == "production" else "true"
    ).lower() in ("true", "1")
    SQLITE_DATABASE_PATH: str = os.getenv(
        "SQLITE_DATABASE_PATH",
        str(Path(__file__).resolve().parents[1] / "sphoorthy_events.db"),
    )
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SECRET_KEY: str = os.getenv(
        "SUPABASE_SECRET_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    )
    SUPABASE_JWKS_URL: str = os.getenv("SUPABASE_JWKS_URL", "")
    # HS256 is retained only for Supabase projects configured for symmetric JWTs.
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")

    # Razorpay Payments
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

    # SMTP Email
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "events@sphoorthy.ac.in")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Sphoorthy Events Desk")
    EMAIL_OUTBOX_WORKER_SECRET: str = os.getenv("EMAIL_OUTBOX_WORKER_SECRET", "")

    # Client Web URL
    APP_URL: str = os.getenv("APP_URL", "http://localhost:3000")
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))

    @property
    def is_production(self) -> bool:
        return self.ENV.lower() == "production"

    @property
    def is_test(self) -> bool:
        return self.TESTING or self.ENV.lower() in {"test", "testing"}

    def validate_production(self) -> None:
        if not self.is_production:
            return

        required = {
            "SECRET_KEY": self.SECRET_KEY,
            "TICKET_SECRET_KEY": self.TICKET_SECRET_KEY,
            "DATABASE_URL": self.DATABASE_URL,
            "SUPABASE_URL": self.SUPABASE_URL,
            "SUPABASE_SECRET_KEY": self.SUPABASE_SECRET_KEY,
            "RAZORPAY_KEY_ID": self.RAZORPAY_KEY_ID,
            "RAZORPAY_KEY_SECRET": self.RAZORPAY_KEY_SECRET,
            "RAZORPAY_WEBHOOK_SECRET": self.RAZORPAY_WEBHOOK_SECRET,
            "SMTP_USERNAME": self.SMTP_USERNAME,
            "SMTP_PASSWORD": self.SMTP_PASSWORD,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise RuntimeError(
                "Missing production configuration: " + ", ".join(missing)
            )
        if self.USE_SQLITE:
            raise RuntimeError("SQLite is not supported in production.")
        if self.DEBUG:
            raise RuntimeError("Flask debug mode is not allowed in production.")
        if self.SEED_DEMO_DATA:
            raise RuntimeError("Demo data seeding is not allowed in production.")
        if len(self.SECRET_KEY.encode("utf-8")) < 32:
            raise RuntimeError("SECRET_KEY must contain at least 32 bytes.")
        if len(self.TICKET_SECRET_KEY.encode("utf-8")) < 32:
            raise RuntimeError("TICKET_SECRET_KEY must contain at least 32 bytes.")
        if not (self.SUPABASE_JWKS_URL or self.SUPABASE_JWT_SECRET):
            raise RuntimeError("Configure Supabase JWT verification before startup.")
        if not self.SUPABASE_URL.startswith("https://"):
            raise RuntimeError("SUPABASE_URL must use HTTPS in production.")
        if self.SUPABASE_JWKS_URL and not self.SUPABASE_JWKS_URL.startswith("https://"):
            raise RuntimeError("SUPABASE_JWKS_URL must use HTTPS in production.")
        if self.SUPABASE_JWT_SECRET and len(self.SUPABASE_JWT_SECRET.encode("utf-8")) < 32:
            raise RuntimeError("SUPABASE_JWT_SECRET must contain at least 32 bytes.")
        if not self.APP_URL.startswith("https://"):
            raise RuntimeError("APP_URL must use HTTPS in production.")
        origins = [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
        if not origins or any(not origin.startswith("https://") for origin in origins):
            raise RuntimeError("ALLOWED_ORIGINS must contain HTTPS origins only in production.")

config = Config()
