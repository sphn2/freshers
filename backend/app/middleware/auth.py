import jwt
from functools import wraps
from flask import request, jsonify, g, current_app
from app.config import config
from app.db import db


def parse_auth_header():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    parts = auth_header.strip().split()
    if len(parts) == 2 and parts[0].lower() == "bearer" and len(parts[1]) <= 8192:
        return parts[1]
    return None


def _decode_supabase_token(token: str) -> dict:
    if config.SUPABASE_JWKS_URL:
        if not config.SUPABASE_URL:
            raise ValueError("SUPABASE_URL is required for JWKS validation.")
        key = jwt.PyJWKClient(config.SUPABASE_JWKS_URL, timeout=3).get_signing_key_from_jwt(token).key
        algorithms = ["RS256", "ES256"]
        issuer = f"{config.SUPABASE_URL.rstrip('/')}/auth/v1"
    elif config.SUPABASE_JWT_SECRET:
        key = config.SUPABASE_JWT_SECRET
        algorithms = ["HS256"]
        issuer = ["supabase", f"{config.SUPABASE_URL.rstrip('/')}/auth/v1"] if config.SUPABASE_URL else "supabase"
    else:
        raise ValueError("Supabase JWT verification is not configured.")

    return jwt.decode(
        token,
        key,
        algorithms=algorithms,
        audience="authenticated",
        issuer=issuer,
        options={"require": ["exp", "iat", "sub", "aud", "iss"]},
    )


def _set_test_identity(token: str = None) -> bool:
    if not current_app.config.get("TESTING"):
        return False
    test_role = request.headers.get("X-Test-User-Role")
    if token and token.startswith("test-token-"):
        test_role = token.removeprefix("test-token-").replace("-", "_")
    if not test_role or test_role.upper() not in {
        "ADMIN", "EVENT_MANAGER", "MANAGER", "OFFLINE_COLLECTOR", "COLLECTOR",
        "GATE", "GATE_STAFF", "FOOD", "FOOD_STAFF", "STUDENT"
    }:
        return False
    role_name = {
        "MANAGER": "EVENT_MANAGER",
        "COLLECTOR": "OFFLINE_COLLECTOR",
        "GATE": "GATE_STAFF",
        "FOOD": "FOOD_STAFF",
    }.get(test_role.upper(), test_role.upper())
    g.current_user = {
        "id": request.headers.get("X-Test-User-Id", "00000000-0000-0000-0000-000000000001"),
        "email": request.headers.get("X-Test-User-Email", f"{role_name.lower()}@sphoorthy.ac.in"),
    }
    g.user_roles = [role_name]
    return True


def auth_middleware():
    """Verify Supabase JWTs and load authorization roles from the backend."""
    token = parse_auth_header()
    g.current_user = None
    g.user_roles = []
    g.auth_error = None

    if not token:
        _set_test_identity()
        return
    if token.startswith("test-token-") and _set_test_identity(token):
        return

    try:
        payload = _decode_supabase_token(token)
    except (jwt.PyJWTError, ValueError) as exc:
        current_app.logger.warning("Rejected invalid Supabase access token: %s", type(exc).__name__)
        return

    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id:
        return
    g.current_user = {"id": user_id, "email": payload.get("email")}
    try:
        roles_rows = db.execute_query(
            """SELECT r.name FROM user_roles ur
               JOIN roles r ON ur.role_id = r.id
               WHERE ur.user_id = %s""",
            (user_id,),
        )
    except Exception:
        current_app.logger.exception("Could not load roles for authenticated user.")
        g.current_user = None
        g.auth_error = 503
        return
    g.user_roles = [row["name"] for row in roles_rows] if roles_rows else ["STUDENT"]


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_middleware()
        if g.auth_error:
            return jsonify({"error": "Authorization service is temporarily unavailable."}), g.auth_error
        if not g.current_user:
            return jsonify({"error": "Unauthorized. Missing or invalid authentication."}), 401
        return f(*args, **kwargs)
    return decorated


def require_roles(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            auth_middleware()
            if g.auth_error:
                return jsonify({"error": "Authorization service is temporarily unavailable."}), g.auth_error
            if not g.current_user:
                return jsonify({"error": "Unauthorized. Missing authentication."}), 401
            if not any(role in g.user_roles for role in allowed_roles):
                return jsonify({"error": "Forbidden. Your account does not have permission for this action."}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
