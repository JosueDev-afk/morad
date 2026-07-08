import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.availability_slot import AvailabilitySlot
from app.schemas.slots import SlotCreate, SlotUpdate


def _has_confirmed_appointment(db: Session, slot_id: uuid.UUID) -> bool:
    return (
        db.query(Appointment)
        .filter(Appointment.slot_id == slot_id, Appointment.status == "confirmed")
        .first()
        is not None
    )


def _has_any_appointment(db: Session, slot_id: uuid.UUID) -> bool:
    return (
        db.query(Appointment)
        .filter(Appointment.slot_id == slot_id)
        .first()
        is not None
    )


def _check_overlap(
    db: Session,
    therapist_id: uuid.UUID,
    start_time: datetime,
    end_time: datetime,
    exclude_id: Optional[uuid.UUID] = None,
) -> None:
    """Raise 422 if a slot for the same therapist overlaps the given time range (req 5.1, 5.2)."""
    query = db.query(AvailabilitySlot).filter(
        AvailabilitySlot.therapist_id == therapist_id,
        AvailabilitySlot.is_active == True,
        AvailabilitySlot.start_time < end_time,
        AvailabilitySlot.end_time > start_time,
    )
    if exclude_id:
        query = query.filter(AvailabilitySlot.id != exclude_id)

    if query.first():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El slot se solapa con uno existente para este terapeuta",
        )


def get_slots(
    db: Session,
    date: Optional[str] = None,
    therapist_id: Optional[uuid.UUID] = None,
    include_inactive: bool = False,
    include_past: bool = False,
) -> list[AvailabilitySlot]:
    """Return slots optionally filtered by date and therapist (req 2.1, 2.2)."""
    query = db.query(AvailabilitySlot)
    
    if not include_inactive:
        query = query.filter(AvailabilitySlot.is_active == True)
        
    if not include_past:
        now = datetime.now(timezone.utc)
        query = query.filter(AvailabilitySlot.start_time > now)

    if therapist_id:
        query = query.filter(AvailabilitySlot.therapist_id == therapist_id)
    if date:
        # Filter by calendar date (YYYY-MM-DD) matching start_time date
        from sqlalchemy import cast, Date as SADate
        query = query.filter(cast(AvailabilitySlot.start_time, SADate) == date)

    return query.order_by(AvailabilitySlot.start_time).all()


def create_slot(db: Session, data: SlotCreate) -> AvailabilitySlot:
    """Create a new availability slot after overlap check (req 5.1, 5.2)."""
    _check_overlap(db, data.therapist_id, data.start_time, data.end_time)
    slot = AvailabilitySlot(
        therapist_id=data.therapist_id,
        start_time=data.start_time,
        end_time=data.end_time,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


def update_slot(db: Session, slot_id: uuid.UUID, data: SlotUpdate) -> AvailabilitySlot:
    """Update a slot; reject if it has a confirmed appointment (req 5.3, 5.5)."""
    slot = db.get(AvailabilitySlot, slot_id)
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slot no encontrado")

    if _has_confirmed_appointment(db, slot_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No se puede editar un slot con una cita confirmada",
        )

    new_start = data.start_time if data.start_time is not None else slot.start_time
    new_end = data.end_time if data.end_time is not None else slot.end_time
    _check_overlap(db, slot.therapist_id, new_start, new_end, exclude_id=slot_id)

    if data.start_time is not None:
        slot.start_time = data.start_time
    if data.end_time is not None:
        slot.end_time = data.end_time
    if data.is_active is not None:
        slot.is_active = data.is_active

    db.commit()
    db.refresh(slot)
    return slot


def delete_slot(db: Session, slot_id: uuid.UUID) -> None:
    """Delete a slot; reject if it has any associated appointment (req 5.3, 5.5)."""
    slot = db.get(AvailabilitySlot, slot_id)
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slot no encontrado")

    if _has_any_appointment(db, slot_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No se puede eliminar un slot que tiene una cita asociada",
        )

    db.delete(slot)
    db.commit()
