"""
Appointment business logic:
- AppointmentService.create()    — booking with race-condition protection (req 3.1, 3.2, 3.3)
- CancellationService.cancel()   — fee policy + courtesy waiver (req 4.1–4.6)
- RescheduleService.reschedule() — atomic cancel + rebook (req 4.7)
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.availability_slot import AvailabilitySlot

ACTIVE_STATUSES = ("confirmed",)
MAX_ACTIVE_APPOINTMENTS = 2


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_slot_for_update(db: Session, slot_id: uuid.UUID) -> AvailabilitySlot:
    """Lock the slot row for the duration of the transaction (prevents double-booking)."""
    slot = (
        db.execute(
            select(AvailabilitySlot)
            .where(AvailabilitySlot.id == slot_id)
            .with_for_update()
        )
        .scalars()
        .first()
    )
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slot no encontrado")
    return slot


def _count_active_appointments(db: Session, patient_id: uuid.UUID) -> int:
    now = datetime.now(timezone.utc)
    return (
        db.query(Appointment)
        .join(AvailabilitySlot, Appointment.slot_id == AvailabilitySlot.id)
        .filter(
            Appointment.patient_id == patient_id,
            Appointment.status.in_(ACTIVE_STATUSES),
            AvailabilitySlot.start_time > now,
        )
        .count()
    )


def _slot_already_booked(db: Session, slot_id: uuid.UUID) -> bool:
    return (
        db.query(Appointment)
        .filter(
            Appointment.slot_id == slot_id,
            Appointment.status.in_(ACTIVE_STATUSES),
        )
        .first()
        is not None
    )


# ---------------------------------------------------------------------------
# AppointmentService
# ---------------------------------------------------------------------------

class AppointmentService:
    @staticmethod
    def create(
        db: Session,
        patient_id: uuid.UUID,
        slot_id: uuid.UUID,
        service_type: str,
        notes: Optional[str] = None,
    ) -> Appointment:
        """
        Book a slot for a patient.
        - 422 if patient already has 2 active future appointments (req 3.2)
        - 409 if slot is already taken (req 3.3)
        Uses SELECT … FOR UPDATE to prevent concurrent double-booking.
        """
        # Check patient active appointment limit first (no DB lock needed yet)
        if _count_active_appointments(db, patient_id) >= MAX_ACTIVE_APPOINTMENTS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Ya tienes el máximo de 2 citas activas",
            )

        # Lock the slot row
        slot = _get_slot_for_update(db, slot_id)

        if not slot.is_active:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El slot no está activo",
            )

        slot_start = slot.start_time
        if slot_start.tzinfo is None:
            slot_start = slot_start.replace(tzinfo=timezone.utc)

        if slot_start <= datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No se puede reservar un slot en el pasado",
            )

        if _slot_already_booked(db, slot_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ese horario ya no está disponible",
            )

        appointment = Appointment(
            patient_id=patient_id,
            therapist_id=slot.therapist_id,
            slot_id=slot_id,
            service_type=service_type,
            notes=notes,
            status="confirmed",
            cancellation_fee_pct=0,
        )
        db.add(appointment)
        db.commit()
        db.refresh(appointment)
        return appointment

    @staticmethod
    def list_for_user(
        db: Session,
        user_id: uuid.UUID,
        role: str,
    ) -> List[Appointment]:
        """Return appointments filtered by role (req 7.1, 3.4)."""
        query = db.query(Appointment)
        if role == "patient":
            query = query.filter(Appointment.patient_id == user_id)
        elif role == "therapist":
            query = query.filter(Appointment.therapist_id == user_id)
        # admin sees all
        return query.order_by(Appointment.created_at.desc()).all()

    @staticmethod
    def get_by_id(db: Session, appointment_id: uuid.UUID) -> Appointment:
        appt = db.get(Appointment, appointment_id)
        if not appt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")
        return appt

    @staticmethod
    def update_status(
        db: Session,
        appointment_id: uuid.UUID,
        new_status: str,
        requesting_user_id: uuid.UUID,
        role: str,
    ) -> Appointment:
        """Allow therapist/admin to mark appointment as completed or no_show (req 7.1)."""
        allowed = {"completed", "no_show"}
        if new_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Estado inválido. Permitidos: {allowed}",
            )

        appt = AppointmentService.get_by_id(db, appointment_id)

        if role == "therapist" and appt.therapist_id != requesting_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a esta cita")

        appt.status = new_status
        db.commit()
        db.refresh(appt)
        return appt

    @staticmethod
    def get_therapist_agenda(
        db: Session,
        therapist_id: uuid.UUID,
        date_str: Optional[str] = None,
    ) -> dict:
        """Return the therapist's appointments and free slots for a given date."""
        from sqlalchemy import cast, Date as SADate
        from app.models.availability_slot import AvailabilitySlot
        from app.models.appointment import Appointment

        # Query appointments for the therapist
        appt_query = db.query(Appointment).join(AvailabilitySlot, Appointment.slot_id == AvailabilitySlot.id).filter(
            Appointment.therapist_id == therapist_id
        )
        if date_str:
            appt_query = appt_query.filter(cast(AvailabilitySlot.start_time, SADate) == date_str)
        # Order by slot start_time
        appointments = appt_query.order_by(AvailabilitySlot.start_time).all()

        # Query all active availability slots for the therapist
        slot_query = db.query(AvailabilitySlot).filter(
            AvailabilitySlot.therapist_id == therapist_id,
            AvailabilitySlot.is_active == True,
        )
        if date_str:
            slot_query = slot_query.filter(cast(AvailabilitySlot.start_time, SADate) == date_str)
        else:
            now = datetime.now(timezone.utc)
            slot_query = slot_query.filter(AvailabilitySlot.start_time > now)
        
        all_slots = slot_query.order_by(AvailabilitySlot.start_time).all()

        # Find confirmed slot IDs to filter out
        booked_slot_ids = {
            appt.slot_id for appt in db.query(Appointment.slot_id)
            .filter(Appointment.therapist_id == therapist_id, Appointment.status == "confirmed")
            .all()
        }

        free_slots = [slot for slot in all_slots if slot.id not in booked_slot_ids]

        return {
            "appointments": appointments,
            "free_slots": free_slots,
        }

    @staticmethod
    def get_detail_by_id(db: Session, appointment_id: uuid.UUID, requesting_user) -> dict:
        """Return full appointment details including patient and therapist history for authorized users."""
        from app.models.user import User

        appt = AppointmentService.get_by_id(db, appointment_id)
        
        res = {
            "id": appt.id,
            "patient_id": appt.patient_id,
            "therapist_id": appt.therapist_id,
            "slot_id": appt.slot_id,
            "service_type": appt.service_type,
            "notes": appt.notes,
            "status": appt.status,
            "cancellation_fee_pct": appt.cancellation_fee_pct,
            "created_at": appt.created_at,
            "slot": appt.slot,
            "has_rating": appt.rating is not None,
            "patient": None,
            "patient_history": []
        }
        
        if requesting_user.role in ("therapist", "admin"):
            res["patient"] = {
                "id": appt.patient.id,
                "first_name": appt.patient.first_name,
                "last_name": appt.patient.last_name,
                "email": appt.patient.email,
                "phone": appt.patient.phone
            }
            
            # Get patient history with the same therapist
            history = (
                db.query(Appointment)
                .filter(
                    Appointment.patient_id == appt.patient_id,
                    Appointment.therapist_id == appt.therapist_id,
                    Appointment.id != appt.id,
                )
                .join(AvailabilitySlot, Appointment.slot_id == AvailabilitySlot.id)
                .order_by(AvailabilitySlot.start_time.desc())
                .all()
            )
            
            res["patient_history"] = [
                {
                    "id": a.id,
                    "service_type": a.service_type,
                    "status": a.status,
                    "start_time": a.slot.start_time,
                    "end_time": a.slot.end_time,
                    "notes": a.notes
                }
                for a in history
            ]
            
        return res



# ---------------------------------------------------------------------------
# CancellationService
# ---------------------------------------------------------------------------

def _calculate_fee(appointment: Appointment, now: datetime) -> int:
    """
    Fee policy (req 4.1–4.3):
      ≥24 h before → 0 %
      6–24 h before → 50 %
      <6 h before   → 100 %
    """
    slot_start = appointment.slot.start_time
    # Make sure we compare tz-aware datetimes
    if slot_start.tzinfo is None:
        slot_start = slot_start.replace(tzinfo=timezone.utc)

    hours_until = (slot_start - now).total_seconds() / 3600

    if hours_until >= 24:
        return 0
    elif hours_until >= 6:
        return 50
    else:
        return 100


def _is_first_cancellation(db: Session, patient_id: uuid.UUID) -> bool:
    """Return True if the patient has never cancelled before (req 4.4)."""
    return (
        db.query(Appointment)
        .filter(
            Appointment.patient_id == patient_id,
            Appointment.status == "cancelled",
        )
        .first()
        is None
    )


class CancellationService:
    @staticmethod
    def cancel(
        db: Session,
        appointment_id: uuid.UUID,
        requesting_patient_id: uuid.UUID,
    ) -> Appointment:
        """
        Cancel an appointment and apply the appropriate fee.
        Frees the slot (no explicit action needed; slot availability is derived from appointment status).
        """
        appt = db.get(Appointment, appointment_id)
        if not appt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")

        if appt.patient_id != requesting_patient_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a esta cita")

        if appt.status == "completed":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No se puede cancelar una cita completada",  # req 4.6
            )

        if appt.status == "cancelled":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La cita ya está cancelada",
            )

        now = datetime.now(timezone.utc)
        fee = _calculate_fee(appt, now)

        # Courtesy waiver for first-ever cancellation (req 4.4)
        if _is_first_cancellation(db, requesting_patient_id):
            fee = 0

        appt.status = "cancelled"
        appt.cancellation_fee_pct = fee
        db.commit()
        db.refresh(appt)
        return appt


# ---------------------------------------------------------------------------
# RescheduleService
# ---------------------------------------------------------------------------

class RescheduleService:
    @staticmethod
    def reschedule(
        db: Session,
        appointment_id: uuid.UUID,
        new_slot_id: uuid.UUID,
        requesting_patient_id: uuid.UUID,
        service_type: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Appointment:
        """
        Atomically cancel the original appointment and create a new one in the chosen slot (req 4.7).
        Both operations happen inside a single transaction.
        """
        appt = db.get(Appointment, appointment_id)
        if not appt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")

        if appt.patient_id != requesting_patient_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a esta cita")

        if appt.status != "confirmed":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Solo se pueden reprogramar citas confirmadas",
            )

        # Lock new slot
        new_slot = _get_slot_for_update(db, new_slot_id)

        if not new_slot.is_active:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El nuevo slot no está activo",
            )

        new_slot_start = new_slot.start_time
        if new_slot_start.tzinfo is None:
            new_slot_start = new_slot_start.replace(tzinfo=timezone.utc)

        if new_slot_start <= datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No se puede reprogramar a un slot en el pasado",
            )

        if _slot_already_booked(db, new_slot_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ese horario ya no está disponible",
            )

        # Cancel original (no fee on reschedule)
        appt.status = "cancelled"
        appt.cancellation_fee_pct = 0

        # Create new appointment
        new_appt = Appointment(
            patient_id=requesting_patient_id,
            therapist_id=new_slot.therapist_id,
            slot_id=new_slot_id,
            service_type=service_type or appt.service_type,
            notes=notes if notes is not None else appt.notes,
            status="confirmed",
            cancellation_fee_pct=0,
        )
        db.add(new_appt)
        db.commit()
        db.refresh(new_appt)
        return new_appt
