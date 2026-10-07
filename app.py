from flask import Flask, jsonify

app = Flask(__name__)


@app.get("/")
def index():
    return jsonify({"message": "Sphoorthy Events API. Start the frontend from the frontend directory."}), 404


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
