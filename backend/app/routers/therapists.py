import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.appointment import Appointment
from app.models.availability_slot import AvailabilitySlot
from app.models.therapist import Therapist
from app.models.user import User
from app.services.appointments import _calculate_fee

router = APIRouter(tags=["therapists"])


class TherapistOut(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    specialty: Optional[str] = None

    model_config = {"from_attributes": True}


class CancellationFeePreview(BaseModel):
    cancellation_fee_pct: int


@router.get("/api/therapists", response_model=List[TherapistOut])
def list_therapists(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return all therapist profiles (req 2.2)."""
    rows = (
        db.query(Therapist)
        .join(User, User.id == Therapist.user_id)
        .all()
    )
    return [
        TherapistOut(
            id=t.user_id,
            first_name=t.user.first_name,
            last_name=t.user.last_name,
            specialty=t.specialty,
        )
        for t in rows
    ]


@router.get(
    "/api/appointments/{appointment_id}/cancellation-fee",
    response_model=CancellationFeePreview,
)
def get_cancellation_fee(
    appointment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Preview the cancellation fee without committing the cancellation (req 4.1–4.4)."""
    appt = db.get(Appointment, appointment_id)
    if not appt:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")

    now = datetime.now(timezone.utc)
    fee = _calculate_fee(appt, now)

    # Check courtesy waiver (first-ever cancellation)
    has_prior = (
        db.query(Appointment)
        .filter(
            Appointment.patient_id == current_user.id,
            Appointment.status == "cancelled",
        )
        .first()
        is not None
    )
    if not has_prior:
        fee = 0

    return CancellationFeePreview(cancellation_fee_pct=fee)
