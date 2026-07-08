import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db
from app.services.auth import create_access_token
from tests.conftest import make_appointment, make_slot, make_therapist, make_user


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


class TestReportsRouter:
    def test_reports_admin_access_only(self, client, db):
        """Only users with admin role can access reports."""
        patient = make_user(db, role="patient")
        patient_token = create_access_token(str(patient.id), patient.role, patient.email)
        
        response = client.get(
            "/api/reports/appointments",
            headers={"Authorization": f"Bearer {patient_token}"},
        )
        assert response.status_code == 403

    def test_reports_json_report(self, client, db):
        """Admin fetches JSON appointments report successfully."""
        admin = make_user(db, role="admin")
        admin_token = create_access_token(str(admin.id), admin.role, admin.email)
        
        therapist = make_therapist(db)
        patient = make_user(db, role="patient")
        slot = make_slot(db, therapist.user_id)
        make_appointment(db, patient_id=patient.id, therapist_id=therapist.user_id, slot_id=slot.id, status="confirmed")

        response = client.get(
            "/api/reports/appointments",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert data["summary"]["total"] == 1
        assert data["summary"]["confirmed"] == 1
        assert len(data["appointments"]) == 1
        assert data["appointments"][0]["patient_email"] == patient.email

    def test_reports_csv_export(self, client, db):
        """Admin fetches CSV appointments report successfully."""
        admin = make_user(db, role="admin")
        admin_token = create_access_token(str(admin.id), admin.role, admin.email)
        
        therapist = make_therapist(db)
        patient = make_user(db, role="patient")
        slot = make_slot(db, therapist.user_id)
        make_appointment(db, patient_id=patient.id, therapist_id=therapist.user_id, slot_id=slot.id, status="completed")

        response = client.get(
            "/api/reports/appointments?format=csv",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        content = response.text
        assert "ID Cita" in content
        assert patient.email in content
        assert "completed" in content

    def test_dashboard_metrics(self, client, db):
        """Admin retrieves dashboard metrics successfully."""
        admin = make_user(db, role="admin")
        admin_token = create_access_token(str(admin.id), admin.role, admin.email)
        
        therapist = make_therapist(db)
        patient = make_user(db, role="patient")
        slot = make_slot(db, therapist.user_id)
        make_appointment(db, patient_id=patient.id, therapist_id=therapist.user_id, slot_id=slot.id, status="confirmed")

        response = client.get(
            "/api/metrics/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_patients"] == 1
        assert data["by_status"]["confirmed"] == 1
        assert "18-25" in data["by_age_range"]
