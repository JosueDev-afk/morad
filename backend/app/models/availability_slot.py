import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AvailabilitySlot(Base):
    __tablename__ = "availability_slots"
    __table_args__ = (
        # Prevents overlapping slots per therapist at the same start time
        UniqueConstraint("therapist_id", "start_time", name="uq_slot_therapist_start"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    therapist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("therapists.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    therapist: Mapped["Therapist"] = relationship("Therapist", back_populates="availability_slots")
    appointment: Mapped[Optional["Appointment"]] = relationship(
        "Appointment", back_populates="slot", uselist=False
    )
