from datetime import datetime, timezone
import pytest
from fastapi import HTTPException
from app.schemas.slots import SlotCreate
from app.services import slots as slot_service
from tests.conftest import make_appointment, make_slot, make_therapist, make_user


class TestSlotService:
    def test_create_slot_overlapping_raises(self, db):
        """Creating an overlapping slot for the same therapist must raise 422."""
        therapist = make_therapist(db)
        
        # Original slot: 10:00 - 11:00
        start1 = datetime(2030, 5, 10, 10, 0, tzinfo=timezone.utc)
        end1 = datetime(2030, 5, 10, 11, 0, tzinfo=timezone.utc)
        make_slot(db, therapist.user_id, start=start1, end=end1)

        # Overlapping slot: 10:30 - 11:30
        start2 = datetime(2030, 5, 10, 10, 30, tzinfo=timezone.utc)
        end2 = datetime(2030, 5, 10, 11, 30, tzinfo=timezone.utc)
        
        data = SlotCreate(
            therapist_id=therapist.user_id,
            start_time=start2,
            end_time=end2,
        )

        with pytest.raises(HTTPException) as exc_info:
            slot_service.create_slot(db, data)
        
        assert exc_info.value.status_code == 422
        assert "se solapa" in exc_info.value.detail

    def test_delete_slot_with_confirmed_appointment_raises(self, db):
        """Deleting a slot that has a confirmed appointment must raise 422."""
        therapist = make_therapist(db)
        patient = make_user(db, role="patient")
        
        start = datetime(2030, 5, 10, 10, 0, tzinfo=timezone.utc)
        end = datetime(2030, 5, 10, 11, 0, tzinfo=timezone.utc)
        slot = make_slot(db, therapist.user_id, start=start, end=end)
        
        # Confirmed appointment
        make_appointment(
            db,
            patient_id=patient.id,
            therapist_id=therapist.user_id,
            slot_id=slot.id,
            status="confirmed",
        )

        with pytest.raises(HTTPException) as exc_info:
            slot_service.delete_slot(db, slot.id)
            
        assert exc_info.value.status_code == 422
        assert "No se puede eliminar" in exc_info.value.detail
