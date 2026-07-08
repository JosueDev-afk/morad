import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db
from app.services.auth import create_access_token
from tests.conftest import make_user


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


class TestAuthRouter:
    def test_register_duplicate_email(self, client, db):
        """Registering with an already registered email should raise 409."""
        make_user(db, email="duplicate@example.com")

        response = client.post(
            "/api/auth/register",
            json={
                "email": "duplicate@example.com",
                "password": "password123",
                "password_confirm": "password123",
                "first_name": "Test",
                "last_name": "User",
            },
        )
        assert response.status_code == 409
        assert "email ya está registrado" in response.json()["detail"]

    def test_login_invalid_credentials(self, client, db):
        """Login with wrong password or email should raise 401."""
        response = client.post(
            "/api/auth/login",
            json={"email": "nonexistent@example.com", "password": "wrongpassword"},
        )
        assert response.status_code == 401
        assert "Credenciales inválidas" in response.json()["detail"]

    def test_access_protected_with_invalid_token(self, client):
        """Accessing a protected endpoint with an invalid or expired token should raise 401."""
        response = client.get(
            "/api/appointments",
            headers={"Authorization": "Bearer invalid_token_here"},
        )
        assert response.status_code == 401
        assert "Token inválido o expirado" in response.json()["detail"]

    def test_access_role_restricted_endpoint(self, client, db):
        """Accessing admin-restricted slot creation with patient credentials should raise 403."""
        patient = make_user(db, role="patient")
        token = create_access_token(str(patient.id), patient.role, patient.email)

        response = client.post(
            "/api/slots",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "therapist_id": str(patient.id),
                "start_time": "2030-01-01T10:00:00Z",
                "end_time": "2030-01-01T11:00:00Z",
            },
        )
        assert response.status_code == 403
        assert "No tienes permiso" in response.json()["detail"]
