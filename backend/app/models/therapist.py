import uuid
from typing import List, Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Therapist(Base):
    __tablename__ = "therapists"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    specialty: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="therapist_profile")
    availability_slots: Mapped[List["AvailabilitySlot"]] = relationship(
        "AvailabilitySlot", back_populates="therapist"
    )
    therapist_appointments: Mapped[List["Appointment"]] = relationship(
        "Appointment", foreign_keys="Appointment.therapist_id", back_populates="therapist"
    )
