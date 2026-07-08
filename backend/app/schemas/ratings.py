import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class RatingCreate(BaseModel):
    appointment_id: uuid.UUID
    stars: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=500)


class RatingOut(BaseModel):
    id: uuid.UUID
    appointment_id: uuid.UUID
    patient_id: uuid.UUID
    stars: int
    comment: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
