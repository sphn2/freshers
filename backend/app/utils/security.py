import hmac
import hashlib
import base64
import binascii
import json
import time
import secrets
from typing import Optional, Dict, Any
from app.config import config

def generate_ticket_code() -> str:
    """Generates a random 6-digit numeric ticket code (100000-999999)."""
    return str(100000 + secrets.randbelow(900000))

def generate_signed_qr_token(ticket_id: str, event_id: str) -> str:
    """
    Generates a secure, tamper-proof opaque QR token signed with HMAC-SHA256.
    Does NOT contain sensitive student PII.
    """
    payload = {
        "tid": ticket_id,
        "eid": event_id,
        "ts": int(time.time()),
        "n": secrets.token_urlsafe(12),
    }
    payload_bytes = json.dumps(payload, sort_keys=True).encode('utf-8')
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode('utf-8').rstrip('=')
    
    signature = hmac.new(
        config.TICKET_SECRET_KEY.encode('utf-8'),
        payload_b64.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return f"{payload_b64}.{signature}"

def verify_signed_qr_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verifies the HMAC-SHA256 signature of a QR token and returns the payload dictionary if valid.
    """
    try:
        if not isinstance(token, str) or len(token) > 2048:
            return None
        parts = token.split('.')
        if len(parts) != 2:
            return None
        payload_b64, signature = parts
        if len(signature) != 64 or any(ch not in "0123456789abcdef" for ch in signature):
            return None
        expected_sig = hmac.new(
            config.TICKET_SECRET_KEY.encode('utf-8'),
            payload_b64.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_sig):
            return None
        
        padded_b64 = payload_b64 + '=' * (-len(payload_b64) % 4)
        payload_bytes = base64.b64decode(padded_b64, altchars=b"-_", validate=True)
        payload = json.loads(payload_bytes.decode('utf-8'))
        if (
            not isinstance(payload, dict)
            or not isinstance(payload.get("tid"), str)
            or not isinstance(payload.get("eid"), str)
            or not isinstance(payload.get("ts"), int)
            or payload["ts"] > int(time.time()) + 60
            or not isinstance(payload.get("n"), str)
        ):
            return None
        return payload
    except (ValueError, TypeError, UnicodeDecodeError, binascii.Error):
        return None
