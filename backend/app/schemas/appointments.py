import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, model_validator


class AppointmentCreate(BaseModel):
    slot_id: uuid.UUID
    service_type: str
    notes: Optional[str] = None


class AppointmentStatusUpdate(BaseModel):
    status: str  # completed | no_show


class RescheduleRequest(BaseModel):
    new_slot_id: uuid.UUID
    service_type: Optional[str] = None
    notes: Optional[str] = None


class SlotInfo(BaseModel):
    start_time: datetime
    end_time: datetime

    model_config = {"from_attributes": True}


from typing import List
from app.schemas.slots import SlotOut

class AppointmentOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    therapist_id: uuid.UUID
    slot_id: uuid.UUID
    service_type: str
    notes: Optional[str]
    status: str
    cancellation_fee_pct: int
    created_at: datetime
    slot: Optional[SlotInfo] = None
    has_rating: bool = False

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def compute_has_rating(cls, data):
        if not isinstance(data, dict):
            # Convert DB model to dict and check rating relation
            # Check if rating relation exists and is loaded
            has_rating = getattr(data, "rating", None) is not None
            # Return dict for parsing
            return {
                "id": getattr(data, "id"),
                "patient_id": getattr(data, "patient_id"),
                "therapist_id": getattr(data, "therapist_id"),
                "slot_id": getattr(data, "slot_id"),
                "service_type": getattr(data, "service_type"),
                "notes": getattr(data, "notes"),
                "status": getattr(data, "status"),
                "cancellation_fee_pct": getattr(data, "cancellation_fee_pct"),
                "created_at": getattr(data, "created_at"),
                "slot": getattr(data, "slot", None),
                "has_rating": has_rating
            }
        else:
            data["has_rating"] = data.get("rating") is not None
            return data


class PatientInfo(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None

    model_config = {"from_attributes": True}


class PatientHistoryItem(BaseModel):
    id: uuid.UUID
    service_type: str
    status: str
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class AppointmentDetailOut(AppointmentOut):
    patient: Optional[PatientInfo] = None
    patient_history: List[PatientHistoryItem] = []


class TherapistAgendaResponse(BaseModel):
    appointments: List[AppointmentOut]
    free_slots: List[SlotOut]

