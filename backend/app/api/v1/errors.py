from flask import current_app, jsonify


def internal_error(operation: str):
    current_app.logger.exception("API request failed while %s.", operation)
    return jsonify({"error": "Internal server error."}), 500
