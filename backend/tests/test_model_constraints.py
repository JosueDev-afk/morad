"""
Task 2.3 — Tests de modelos e integridad de constraints
Verifies:
  1. UNIQUE(therapist_id, start_time) on availability_slots  (Requirement 5.1)
  2. Partial UNIQUE on appointments(slot_id) WHERE status='confirmed'
     — one slot cannot have two confirmed appointments        (Requirement 3.3)
  3. Cancelled/completed appointments do NOT block a new confirmed booking
     on the same slot                                         (Requirement 3.3)
  4. FK constraint: slot_id on appointments references a real slot (Requirement 3.3)
"""
from datetime import datetime, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from tests.conftest import make_appointment, make_slot, make_therapist, make_user


# ── 1. Unique slot per therapist + start_time ─────────────────────────────────

class TestSlotUniqueConstraint:
    def test_duplicate_slot_raises(self, db):
        """Two slots for the same therapist at the same start_time must be rejected."""
        therapist = make_therapist(db)
        start = datetime(2030, 2, 1, 9, 0, tzinfo=timezone.utc)

        make_slot(db, therapist.user_id, start=start)

        with pytest.raises(IntegrityError):
            make_slot(db, therapist.user_id, start=start)

    def test_same_start_different_therapist_allowed(self, db):
        """Two different therapists can have slots at the same start_time."""
        t1 = make_therapist(db)
        t2 = make_therapist(db)
        start = datetime(2030, 2, 1, 9, 0, tzinfo=timezone.utc)

        s1 = make_slot(db, t1.user_id, start=start)
        s2 = make_slot(db, t2.user_id, start=start)

        assert s1.id != s2.id

    def test_same_therapist_different_start_allowed(self, db):
        """Same therapist can have slots at different start times."""
        therapist = make_therapist(db)
        s1 = make_slot(db, therapist.user_id, start=datetime(2030, 2, 1, 9, 0, tzinfo=timezone.utc))
        s2 = make_slot(db, therapist.user_id, start=datetime(2030, 2, 1, 10, 0, tzinfo=timezone.utc))

        assert s1.id != s2.id


# ── 2. Partial unique index: one confirmed appointment per slot ───────────────

class TestAppointmentSlotConfirmedConstraint:
    def test_double_booking_same_slot_raises(self, db):
        """Two confirmed appointments on the same slot must be rejected."""
        therapist = make_therapist(db)
        patient1 = make_user(db, role="patient")
        patient2 = make_user(db, role="patient")
        slot = make_slot(db, therapist.user_id)

        make_appointment(db, patient_id=patient1.id, therapist_id=therapist.user_id, slot_id=slot.id)

        with pytest.raises(IntegrityError):
            make_appointment(db, patient_id=patient2.id, therapist_id=therapist.user_id, slot_id=slot.id)

    def test_cancelled_then_rebook_allowed(self, db):
        """A slot with a cancelled appointment can be booked again (confirmed)."""
        therapist = make_therapist(db)
        patient1 = make_user(db, role="patient")
        patient2 = make_user(db, role="patient")
        slot = make_slot(db, therapist.user_id)

        make_appointment(
            db,
            patient_id=patient1.id,
            therapist_id=therapist.user_id,
            slot_id=slot.id,
            status="cancelled",
        )

        # A new confirmed appointment on the same slot must succeed
        new_appt = make_appointment(
            db,
            patient_id=patient2.id,
            therapist_id=therapist.user_id,
            slot_id=slot.id,
            status="confirmed",
        )
        assert new_appt.id is not None

    def test_completed_then_rebook_allowed(self, db):
        """A slot with a completed appointment can receive a second confirmed booking."""
        therapist = make_therapist(db)
        patient1 = make_user(db, role="patient")
        patient2 = make_user(db, role="patient")
        slot = make_slot(db, therapist.user_id)

        make_appointment(
            db,
            patient_id=patient1.id,
            therapist_id=therapist.user_id,
            slot_id=slot.id,
            status="completed",
        )

        new_appt = make_appointment(
            db,
            patient_id=patient2.id,
            therapist_id=therapist.user_id,
            slot_id=slot.id,
            status="confirmed",
        )
        assert new_appt.id is not None

    def test_no_show_then_rebook_allowed(self, db):
        """A slot with a no_show appointment can receive a new confirmed booking."""
        therapist = make_therapist(db)
        patient1 = make_user(db, role="patient")
        patient2 = make_user(db, role="patient")
        slot = make_slot(db, therapist.user_id)

        make_appointment(
            db,
            patient_id=patient1.id,
            therapist_id=therapist.user_id,
            slot_id=slot.id,
            status="no_show",
        )

        new_appt = make_appointment(
            db,
            patient_id=patient2.id,
            therapist_id=therapist.user_id,
            slot_id=slot.id,
            status="confirmed",
        )
        assert new_appt.id is not None


# ── 3. FK constraint: slot_id must reference an existing slot ─────────────────

class TestAppointmentForeignKeyConstraint:
    def test_appointment_with_nonexistent_slot_raises(self, db):
        """Creating an appointment with a non-existent slot_id must raise IntegrityError."""
        import uuid

        therapist = make_therapist(db)
        patient = make_user(db, role="patient")

        with pytest.raises(IntegrityError):
            make_appointment(
                db,
                patient_id=patient.id,
                therapist_id=therapist.user_id,
                slot_id=uuid.uuid4(),  # random UUID — no matching slot
            )
