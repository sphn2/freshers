from flask import current_app, jsonify


def internal_error(operation: str):
    current_app.logger.exception("API request failed while %s.", operation)
    return jsonify({"error": "Internal server error."}), 500


def format_validation_error(e):
    messages = []
    for err in e.errors():
        field = err.get("loc", [])[-1] if err.get("loc") else "field"
        msg = err.get("msg", "invalid")
        messages.append(f"{field}: {msg}")
    return f"Validation error: {'; '.join(messages)}"

