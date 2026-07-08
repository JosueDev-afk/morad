import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        # Ensures a slot can only be booked by one confirmed appointment at a time.
        # Uses a partial unique index (enforced at DB level via migration).
        Index("ix_appointments_slot_confirmed", "slot_id", unique=False),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    therapist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("therapists.user_id", ondelete="RESTRICT"), nullable=False, index=True
    )
    slot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("availability_slots.id", ondelete="RESTRICT"), nullable=False
    )
    service_type: Mapped[str] = mapped_column(String(100), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # status: confirmed | completed | cancelled | no_show
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="confirmed", index=True)
    cancellation_fee_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    patient: Mapped["User"] = relationship(
        "User", foreign_keys=[patient_id], back_populates="patient_appointments"
    )
    therapist: Mapped["Therapist"] = relationship(
        "Therapist", foreign_keys=[therapist_id], back_populates="therapist_appointments"
    )
    slot: Mapped["AvailabilitySlot"] = relationship("AvailabilitySlot", back_populates="appointment")
    rating: Mapped[Optional["Rating"]] = relationship("Rating", back_populates="appointment", uselist=False)
