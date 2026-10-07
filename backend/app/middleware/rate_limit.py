"""Small dependency-free rate limiter for the Flask API.

Deployments running multiple serverless instances should additionally enforce
limits at the edge; this protects the single-process local and Vercel paths.
"""

from collections import defaultdict, deque
from functools import wraps
import hashlib
from threading import Lock
from time import monotonic

from flask import g, jsonify, request

_requests: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()
_max_buckets = 10000


def rate_limit(limit: int, window_seconds: int = 60):
    def decorator(handler):
        @wraps(handler)
        def wrapped(*args, **kwargs):
            user = getattr(g, "current_user", None)
            identity = user["id"] if user else request.remote_addr or "unknown"
            identity_hash = hashlib.sha256(identity.encode("utf-8")).hexdigest()
            key = f"{request.endpoint}:{identity_hash}"
            now = monotonic()
            with _lock:
                if key not in _requests and len(_requests) >= _max_buckets:
                    _requests.pop(next(iter(_requests)))
                bucket = _requests[key]
                while bucket and bucket[0] <= now - window_seconds:
                    bucket.popleft()
                if len(bucket) >= limit:
                    return jsonify({"error": "Too many requests. Please try again shortly."}), 429
                bucket.append(now)
            return handler(*args, **kwargs)
        return wrapped
    return decorator
