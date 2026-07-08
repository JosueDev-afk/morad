import uuid
from typing import List, Optional, Union

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User
from app.schemas.appointments import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentStatusUpdate,
    RescheduleRequest,
    AppointmentDetailOut,
    TherapistAgendaResponse,
)
from app.services.appointments import (
    AppointmentService,
    CancellationService,
    RescheduleService,
)

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


@router.get("", response_model=Union[List[AppointmentOut], TherapistAgendaResponse])
def list_appointments(
    date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return appointments filtered by role (req 3.4, 7.1):
    - patient → own appointments only
    - therapist → their appointments only (returned with free slots as TherapistAgendaResponse)
    - admin → all appointments
    """
    if current_user.role == "therapist":
        return AppointmentService.get_therapist_agenda(db, current_user.id, date)
    
    # For patient or admin, return a list of appointments
    from app.models.appointment import Appointment
    query = db.query(Appointment)
    
    if current_user.role == "patient":
        query = query.filter(Appointment.patient_id == current_user.id)
    elif current_user.role == "therapist":
        query = query.filter(Appointment.therapist_id == current_user.id)
        
    if date:
        from app.models.availability_slot import AvailabilitySlot
        from sqlalchemy import cast, Date as SADate
        query = query.join(AvailabilitySlot, Appointment.slot_id == AvailabilitySlot.id).filter(
            cast(AvailabilitySlot.start_time, SADate) == date
        )
        
    return query.order_by(Appointment.created_at.desc()).all()


@router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment(
    body: AppointmentCreate,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    """Book a slot for the authenticated patient (req 3.1, 3.2, 3.3)."""
    return AppointmentService.create(
        db,
        patient_id=current_user.id,
        slot_id=body.slot_id,
        service_type=body.service_type,
        notes=body.notes,
    )


@router.get("/{appointment_id}", response_model=AppointmentDetailOut)
def get_appointment(
    appointment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return AppointmentService.get_detail_by_id(db, appointment_id, current_user)


@router.post("/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(
    appointment_id: uuid.UUID,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    """Cancel an appointment and apply the cancellation fee policy (req 4.1–4.6)."""
    return CancellationService.cancel(db, appointment_id, current_user.id)


@router.post("/{appointment_id}/reschedule", response_model=AppointmentOut)
def reschedule_appointment(
    appointment_id: uuid.UUID,
    body: RescheduleRequest,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db),
):
    """Atomically cancel original appointment and book a new slot (req 4.7)."""
    return RescheduleService.reschedule(
        db,
        appointment_id=appointment_id,
        new_slot_id=body.new_slot_id,
        requesting_patient_id=current_user.id,
        service_type=body.service_type,
        notes=body.notes,
    )


@router.patch("/{appointment_id}/status", response_model=AppointmentOut)
def update_appointment_status(
    appointment_id: uuid.UUID,
    body: AppointmentStatusUpdate,
    current_user: User = Depends(require_role(["therapist", "admin"])),
    db: Session = Depends(get_db),
):
    """Mark appointment as completed or no_show (req 7.1)."""
    return AppointmentService.update_status(
        db,
        appointment_id=appointment_id,
        new_status=body.status,
        requesting_user_id=current_user.id,
        role=current_user.role,
    )
