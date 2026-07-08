import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User
from app.schemas.slots import SlotCreate, SlotOut, SlotUpdate
from app.services import slots as slot_service

router = APIRouter(prefix="/api/slots", tags=["slots"])


@router.get("", response_model=List[SlotOut])
def list_slots(
    date: Optional[str] = None,
    therapist_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return slots, optionally filtered by date and therapist (req 2.1, 2.2). Admin sees all slots."""
    is_admin = current_user.role == "admin"
    return slot_service.get_slots(
        db,
        date=date,
        therapist_id=therapist_id,
        include_inactive=is_admin,
        include_past=is_admin,
    )


@router.post("", response_model=SlotOut, status_code=201)
def create_slot(
    data: SlotCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(["admin"])),
):
    """Create a new availability slot (req 5.1, 5.2)."""
    return slot_service.create_slot(db, data)


@router.put("/{slot_id}", response_model=SlotOut)
def update_slot(
    slot_id: uuid.UUID,
    data: SlotUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(["admin"])),
):
    """Update an existing slot; blocked if it has a confirmed appointment (req 5.3, 5.5)."""
    return slot_service.update_slot(db, slot_id, data)


@router.delete("/{slot_id}", status_code=204)
def delete_slot(
    slot_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(["admin"])),
):
    """Delete a slot; blocked if it has a confirmed appointment (req 5.3)."""
    slot_service.delete_slot(db, slot_id)
