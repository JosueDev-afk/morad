from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User
from app.schemas.ratings import RatingCreate, RatingOut
from app.services.ratings import RatingService

router = APIRouter(prefix="/api/ratings", tags=["ratings"])


@router.post("", response_model=RatingOut, status_code=status.HTTP_201_CREATED)
def create_rating(
    body: RatingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["patient"])),
):
    """Submit a rating for a completed appointment (req 8.1, 8.2, 8.3, 8.4)."""
    return RatingService.create(
        db=db,
        patient_id=current_user.id,
        appointment_id=body.appointment_id,
        stars=body.stars,
        comment=body.comment,
    )


@router.get("", response_model=List[RatingOut])
def list_ratings(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(["admin"])),
):
    """Return all ratings — admin only (req 8.5)."""
    return RatingService.list_all(db)
