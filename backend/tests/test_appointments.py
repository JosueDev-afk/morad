from datetime import datetime, timedelta, timezone
import pytest
from fastapi import HTTPException
from app.services.appointments import AppointmentService, CancellationService, RescheduleService
from tests.conftest import make_appointment, make_slot, make_therapist, make_user


class TestAppointmentService:
    def test_create_appointment_success(self, db):
        """Successfully booking an available slot."""
        therapist = make_therapist(db)
        patient = make_user(db, role="patient")
        
        start = datetime.now(timezone.utc) + timedelta(days=2)
        end = start + timedelta(hours=1)
        slot = make_slot(db, therapist.user_id, start=start, end=end)

        appt = AppointmentService.create(
            db,
            patient_id=patient.id,
            slot_id=slot.id,
            service_type="fisioterapia",
            notes="Dolor de espalda",
        )
        assert appt.id is not None
        assert appt.status == "confirmed"
        assert appt.patient_id == patient.id

    def test_double_booking_raises_conflict(self, db):
        """Booking an already taken slot raises a 409 conflict."""
        therapist = make_therapist(db)
        patient1 = make_user(db, role="patient")
        patient2 = make_user(db, role="patient")
        
        start = datetime.now(timezone.utc) + timedelta(days=2)
        end = start + timedelta(hours=1)
        slot = make_slot(db, therapist.user_id, start=start, end=end)

        # Book first time
        AppointmentService.create(
            db,
            patient_id=patient1.id,
            slot_id=slot.id,
            service_type="fisioterapia",
        )

        # Try to book second time
        with pytest.raises(HTTPException) as exc_info:
            AppointmentService.create(
                db,
                patient_id=patient2.id,
                slot_id=slot.id,
                service_type="fisioterapia",
            )
        assert exc_info.value.status_code == 409
        assert "Ese horario ya no está disponible" in exc_info.value.detail

    def test_cancellation_fee_policy(self, db):
        """Verify fee percentage applied according to cancellation time policy."""
        therapist = make_therapist(db)
        
        # Test case: 25 hours before (>=24h -> 0% fee)
        patient_0 = make_user(db, role="patient")
        slot_0 = make_slot(db, therapist.user_id, start=datetime.now(timezone.utc) + timedelta(hours=25))
        # Ensure we have a prior cancellation so the courtesy waiver is NOT applied
        make_appointment(db, patient_id=patient_0.id, therapist_id=therapist.user_id, slot_id=slot_0.id, status="cancelled")
        
        slot_0_new = make_slot(db, therapist.user_id, start=datetime.now(timezone.utc) + timedelta(hours=25))
        appt_0 = make_appointment(db, patient_id=patient_0.id, therapist_id=therapist.user_id, slot_id=slot_0_new.id)
        cancelled_0 = CancellationService.cancel(db, appt_0.id, patient_0.id)
        assert cancelled_0.cancellation_fee_pct == 0

        # Test case: 12 hours before (6-24h -> 50% fee)
        patient_50 = make_user(db, role="patient")
        # First cancellation to consume courtesy waiver
        slot_c = make_slot(db, therapist.user_id, start=datetime.now(timezone.utc) + timedelta(hours=30))
        make_appointment(db, patient_id=patient_50.id, therapist_id=therapist.user_id, slot_id=slot_c.id, status="cancelled")
        
        slot_50 = make_slot(db, therapist.user_id, start=datetime.now(timezone.utc) + timedelta(hours=12))
        appt_50 = make_appointment(db, patient_id=patient_50.id, therapist_id=therapist.user_id, slot_id=slot_50.id)
        cancelled_50 = CancellationService.cancel(db, appt_50.id, patient_50.id)
        assert cancelled_50.cancellation_fee_pct == 50

        # Test case: 2 hours before (<6h -> 100% fee)
        patient_100 = make_user(db, role="patient")
        # Consume courtesy
        slot_c2 = make_slot(db, therapist.user_id, start=datetime.now(timezone.utc) + timedelta(hours=30))
        make_appointment(db, patient_id=patient_100.id, therapist_id=therapist.user_id, slot_id=slot_c2.id, status="cancelled")
        
        slot_100 = make_slot(db, therapist.user_id, start=datetime.now(timezone.utc) + timedelta(hours=2))
        appt_100 = make_appointment(db, patient_id=patient_100.id, therapist_id=therapist.user_id, slot_id=slot_100.id)
        cancelled_100 = CancellationService.cancel(db, appt_100.id, patient_100.id)
        assert cancelled_100.cancellation_fee_pct == 100

    def test_cancellation_courtesy_waiver(self, db):
        """First cancellation by a patient is free (courtesy waiver), even if it's last minute."""
        therapist = make_therapist(db)
        patient = make_user(db, role="patient")
        
        # 2 hours before -> should be 100% but courtesy makes it 0%
        slot = make_slot(db, therapist.user_id, start=datetime.now(timezone.utc) + timedelta(hours=2))
        appt = make_appointment(db, patient_id=patient.id, therapist_id=therapist.user_id, slot_id=slot.id)
        
        cancelled = CancellationService.cancel(db, appt.id, patient.id)
        assert cancelled.cancellation_fee_pct == 0

    def test_reschedule_atomic_success(self, db):
        """Rescheduling cancels the original appointment and creates a new one atomically."""
        therapist = make_therapist(db)
        patient = make_user(db, role="patient")
        
        start1 = datetime.now(timezone.utc) + timedelta(days=2)
        slot1 = make_slot(db, therapist.user_id, start=start1)
        appt1 = make_appointment(db, patient_id=patient.id, therapist_id=therapist.user_id, slot_id=slot1.id)

        start2 = datetime.now(timezone.utc) + timedelta(days=3)
        slot2 = make_slot(db, therapist.user_id, start=start2)

        new_appt = RescheduleService.reschedule(
            db,
            appointment_id=appt1.id,
            new_slot_id=slot2.id,
            requesting_patient_id=patient.id,
        )

        assert new_appt.id is not None
        assert new_appt.status == "confirmed"
        assert new_appt.slot_id == slot2.id
        
        # Original appointment must be cancelled
        db.refresh(appt1)
        assert appt1.status == "cancelled"
        assert appt1.cancellation_fee_pct == 0
