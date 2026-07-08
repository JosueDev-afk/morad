import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, model_validator


class SlotCreate(BaseModel):
    therapist_id: uuid.UUID
    start_time: datetime
    end_time: datetime

    @model_validator(mode="after")
    def end_after_start(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time debe ser posterior a start_time")
        return self


class SlotUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def end_after_start(self):
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("end_time debe ser posterior a start_time")
        return self


class SlotOut(BaseModel):
    id: uuid.UUID
    therapist_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    is_active: bool

    model_config = {"from_attributes": True}
