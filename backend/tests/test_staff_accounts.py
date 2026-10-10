import uuid

import pytest

from app import create_app
from app.config import config
from app.db import db


class AuthAdminResponse:
    status_code = 200

    def __init__(self, user_id):
        self.user_id = user_id

    def json(self):
        return {"id": self.user_id}


@pytest.mark.parametrize(
    "secret_key",
    [
        "eyJ.legacy-service-role-test-key",
        "sb_secret_test-key",
    ],
)
def test_admin_creates_auth_user_and_assigns_staff_role(
    monkeypatch, secret_key
):
    app = create_app()
    user_id = str(uuid.uuid4())
    requests = []

    def create_auth_user(url, headers, json, timeout):
        requests.append((url, headers, json, timeout))
        return AuthAdminResponse(user_id)

    monkeypatch.setattr(config, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(config, "SUPABASE_SECRET_KEY", secret_key)
    monkeypatch.setattr(
        "app.services.staff_account_service.requests.post",
        create_auth_user,
    )

    with app.test_client() as client:
        response = client.post(
            "/api/v1/admin/staff-accounts",
            headers={"Authorization": "Bearer test-token-admin"},
            json={
                "email": "gate.operator@example.com",
                "full_name": "Gate Operator",
                "password": "Unique-Test-Password-2026",
                "role": "GATE_STAFF",
            },
        )

    assert response.status_code == 201
    assert response.json["account"]["id"] == user_id
    assert len(requests) == 1
    assert requests[0][0] == "https://example.supabase.co/auth/v1/admin/users"
    assert requests[0][1]["apikey"] == secret_key
    assert requests[0][1]["Authorization"] == f"Bearer {secret_key}"
    assert requests[0][2]["email_confirm"] is True
    profile = db.execute_one("SELECT email, full_name FROM profiles WHERE id = %s", (user_id,))
    assert profile == {"email": "gate.operator@example.com", "full_name": "Gate Operator"}
    role = db.execute_one(
        """SELECT r.name FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = %s""",
        (user_id,),
    )
    assert role["name"] == "GATE_STAFF"
    db.execute_write("DELETE FROM user_roles WHERE user_id = %s", (user_id,))
    db.execute_write("DELETE FROM profiles WHERE id = %s", (user_id,))


def test_event_manager_account_is_assigned_to_selected_event(monkeypatch):
    app = create_app()
    user_id = str(uuid.uuid4())
    event = db.execute_one("SELECT id FROM events WHERE slug = %s", ("freshers-2k26",))
    monkeypatch.setattr(config, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(config, "SUPABASE_SECRET_KEY", "server-only-test-secret")
    monkeypatch.setattr(
        "app.services.staff_account_service.requests.post",
        lambda *args, **kwargs: AuthAdminResponse(user_id),
    )

    with app.test_client() as client:
        response = client.post(
            "/api/v1/admin/staff-accounts",
            headers={"Authorization": "Bearer test-token-admin"},
            json={
                "email": "organizer@example.com",
                "full_name": "Event Organizer",
                "password": "Unique-Test-Password-2026",
                "role": "EVENT_MANAGER",
                "event_id": event["id"],
            },
        )

    assert response.status_code == 201
    assignment = db.execute_one(
        "SELECT event_id FROM event_managers WHERE user_id = %s",
        (user_id,),
    )
    assert assignment["event_id"] == event["id"]
    db.execute_write("DELETE FROM event_managers WHERE user_id = %s", (user_id,))
    db.execute_write("DELETE FROM user_roles WHERE user_id = %s", (user_id,))
    db.execute_write("DELETE FROM profiles WHERE id = %s", (user_id,))


def test_non_admin_cannot_create_staff_accounts():
    app = create_app()
    with app.test_client() as client:
        response = client.post(
            "/api/v1/admin/staff-accounts",
            headers={"Authorization": "Bearer test-token-event-manager"},
            json={
                "email": "unauthorized@example.com",
                "full_name": "Unauthorized User",
                "password": "Unique-Test-Password-2026",
                "role": "GATE_STAFF",
            },
        )
    assert response.status_code == 403


def test_staff_account_reports_rejected_supabase_admin_key(monkeypatch):
    class RejectedAuthResponse:
        status_code = 401

        @staticmethod
        def json():
            return {"message": "Invalid API key"}

    monkeypatch.setattr(config, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(config, "SUPABASE_SECRET_KEY", "server-only-test-secret")
    monkeypatch.setattr(
        "app.services.staff_account_service.requests.post",
        lambda *args, **kwargs: RejectedAuthResponse(),
    )

    with create_app().test_client() as client:
        response = client.post(
            "/api/v1/admin/staff-accounts",
            headers={"X-Test-User-Role": "ADMIN"},
            json={
                "email": "staff.operator@example.com",
                "full_name": "Staff Operator",
                "password": "Unique-Test-Password-2026",
                "role": "GATE_STAFF",
            },
        )

    assert response.status_code == 503
    assert "SUPABASE_SECRET_KEY" in response.json["error"]


def test_failed_role_assignment_removes_new_supabase_auth_user(monkeypatch):
    app = create_app()
    user_id = str(uuid.uuid4())
    deleted_users = []
    original_execute_write = db.execute_write

    def fail_profile_insert(query, params=()):
        if "INSERT INTO profiles" in query:
            raise RuntimeError("database unavailable")
        return original_execute_write(query, params)

    class DeleteResponse:
        status_code = 204

    monkeypatch.setattr(config, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(config, "SUPABASE_SECRET_KEY", "server-only-test-secret")
    monkeypatch.setattr(
        "app.services.staff_account_service.requests.post",
        lambda *args, **kwargs: AuthAdminResponse(user_id),
    )

    def delete_auth_user(url, headers, timeout):
        deleted_users.append(url)
        return DeleteResponse()

    monkeypatch.setattr(
        "app.services.staff_account_service.requests.delete",
        delete_auth_user,
    )
    monkeypatch.setattr(db, "execute_write", fail_profile_insert)

    with app.test_client() as client:
        response = client.post(
            "/api/v1/admin/staff-accounts",
            headers={"Authorization": "Bearer test-token-admin"},
            json={
                "email": "rollback.operator@example.com",
                "full_name": "Rollback Operator",
                "password": "Unique-Test-Password-2026",
                "role": "FOOD_STAFF",
            },
        )

    assert response.status_code == 500
    assert deleted_users == [
        f"https://example.supabase.co/auth/v1/admin/users/{user_id}"
    ]
    assert db.execute_one("SELECT id FROM profiles WHERE id = %s", (user_id,)) is None
