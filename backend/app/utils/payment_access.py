import hashlib
import hmac
import secrets

from app.db import db


def create_access_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    return token, hash_access_token(token)


def hash_access_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def registration_token_matches(registration_id: str, token: str | None) -> bool:
    if not token or len(token) > 256:
        return False
    row = db.execute_one(
        "SELECT payment_access_token_hash FROM registrations WHERE id = %s",
        (registration_id,),
    )
    expected = row.get("payment_access_token_hash") if row else None
    if not expected:
        return False
    token_hash = hash_access_token(token)
    expected_hashes = [h.strip() for h in expected.split(",") if h.strip()]
    return any(hmac.compare_digest(h, token_hash) for h in expected_hashes)


def ticket_token_matches(ticket_id: str, token: str | None) -> bool:
    if not token or len(token) > 256:
        return False
    row = db.execute_one(
        "SELECT public_access_token_hash FROM tickets WHERE id = %s",
        (ticket_id,),
    )
    expected = row.get("public_access_token_hash") if row else None
    return bool(expected and hmac.compare_digest(expected, hash_access_token(token)))
