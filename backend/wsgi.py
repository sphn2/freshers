import os
import sys
import logging
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from app import create_app
    app = create_app()
except Exception as exc:
    import traceback
    logging.exception("Failed to initialize Sphoorthy Events backend application")
    _init_error = str(exc)
    _init_trace = traceback.format_exc()

    from flask import Flask, jsonify
    app = Flask(__name__)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    def initialization_failure(path):
        return jsonify({
            "error": "Backend initialization failed",
            "message": _init_error,
            "status": 500,
            "path": path,
        }), 500

if __name__ == "__main__":
    print("[SERVER] Starting Sphoorthy Events Backend on http://127.0.0.1:5000...", flush=True)
    app.run(host="127.0.0.1", port=5000, debug=False)
