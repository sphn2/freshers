import pytest
from app import create_app
from app.middleware.auth import _get_jwks_client


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client


def test_health_check(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json["status"] == "HEALTHY"


def test_jwks_client_is_reused(monkeypatch):
    clients = []

    class FakeJwksClient:
        def __init__(self, url, timeout):
            clients.append((url, timeout))

    _get_jwks_client.cache_clear()
    monkeypatch.setattr("app.middleware.auth.jwt.PyJWKClient", FakeJwksClient)
    try:
        first = _get_jwks_client("https://example.supabase.co/auth/v1/.well-known/jwks.json")
        second = _get_jwks_client("https://example.supabase.co/auth/v1/.well-known/jwks.json")
    finally:
        _get_jwks_client.cache_clear()

    assert first is second
    assert clients == [
        ("https://example.supabase.co/auth/v1/.well-known/jwks.json", 3)
    ]


def test_unauthorized_admin_access(client):
    response = client.get("/api/v1/admin/dashboard")
    assert response.status_code == 401
    assert "Unauthorized" in response.json["error"]


def test_authorized_admin_access(client):
    response = client.get(
        "/api/v1/admin/dashboard",
        headers={"Authorization": "Bearer test-token-admin"},
    )
    assert response.status_code == 200
    assert "total_registrations" in response.json


def test_forbidden_role_access(client):
    response = client.post(
        "/api/v1/validation/gate",
        json={"event_id": "mock-event-id", "ticket_code": "123456"},
        headers={"Authorization": "Bearer test-token-student"},
    )
    assert response.status_code == 403


def test_test_tokens_are_not_accepted_when_testing_is_disabled():
    app = create_app()
    app.config["TESTING"] = False
    with app.test_client() as client:
        response = client.get(
            "/api/v1/admin/dashboard",
            headers={"Authorization": "Bearer test-token-admin"},
        )
    assert response.status_code == 401
