"""
Rating business logic (req 8.1–8.5):
- Only completed appointments can be rated.
- Each appointment can only be rated once.
"""
import uuid
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.rating import Rating
from app.models.appointment import Appointment


class RatingService:
    @staticmethod
    def create(
        db: Session,
        patient_id: uuid.UUID,
        appointment_id: uuid.UUID,
        stars: int,
        comment: Optional[str],
    ) -> Rating:
        appt = db.get(Appointment, appointment_id)
        if not appt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")

        # Only the patient who owns the appointment can rate it
        if appt.patient_id != patient_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a esta cita")

        # Must be completed (req 8.4)
        if appt.status != "completed":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Solo se pueden calificar citas completadas",
            )

        # Must not already have a rating (req 8.3)
        if appt.rating is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Esta cita ya fue calificada",
            )

        rating = Rating(
            appointment_id=appointment_id,
            patient_id=patient_id,
            stars=stars,
            comment=comment,
        )
        db.add(rating)
        db.commit()
        db.refresh(rating)
        return rating

    @staticmethod
    def list_all(db: Session) -> List[Rating]:
        """Return all ratings for admin view (req 8.5)."""
        return db.query(Rating).order_by(Rating.created_at.desc()).all()
