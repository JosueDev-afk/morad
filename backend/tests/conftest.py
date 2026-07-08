"""
Shared pytest fixtures for MORAD backend tests.
Uses SQLite in-memory so no running Postgres is needed.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

from app.database import Base

# ── SQLite in-memory engine ────────────────────────────────────────────────────
SQLITE_URL = "sqlite://"


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(
        SQLITE_URL,
        connect_args={"check_same_thread": False},
    )

    # SQLite needs foreign-key enforcement enabled per connection
    @event.listens_for(eng, "connect")
    def set_sqlite_pragma(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    # Import all models so they register on Base.metadata
    import app.models.user  # noqa: F401
    import app.models.therapist  # noqa: F401
    import app.models.availability_slot  # noqa: F401
    import app.models.appointment  # noqa: F401
    import app.models.rating  # noqa: F401
    import app.models.verification_code  # noqa: F401

    Base.metadata.create_all(bind=eng)

    # SQLite supports partial unique indexes — create it manually to mirror
    # the PostgreSQL partial index defined in the Alembic migration.
    with eng.connect() as conn:
        conn.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_slot_confirmed
                ON appointments (slot_id)
                WHERE status = 'confirmed'
                """
            )
        )
        conn.commit()

    yield eng
    Base.metadata.drop_all(bind=eng)


@pytest.fixture
def db(engine):
    """Provide a transactional session that rolls back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()

    yield session

    session.close()
    # IntegrityError tests invalidate the underlying transaction; guard against that.
    if transaction.is_active:
        transaction.rollback()
    connection.close()


# ── Reusable factory helpers ───────────────────────────────────────────────────

def make_user(db, *, role: str = "patient", email: Optional[str] = None):
    from app.models.user import User

    user = User(
        id=uuid.uuid4(),
        email=email or f"{uuid.uuid4().hex[:8]}@example.com",
        password_hash="hashed",
        role=role,
        first_name="Test",
        last_name="User",
        email_verified=True,
    )
    db.add(user)
    db.flush()
    return user


def make_therapist(db, *, email: Optional[str] = None):
    from app.models.therapist import Therapist

    user = make_user(db, role="therapist", email=email)
    therapist = Therapist(user_id=user.id, specialty="General")
    db.add(therapist)
    db.flush()
    return therapist


def make_slot(db, therapist_id, *, start: Optional[datetime] = None, end: Optional[datetime] = None):
    from app.models.availability_slot import AvailabilitySlot

    start = start or datetime(2030, 1, 10, 9, 0, tzinfo=timezone.utc)
    end = end or datetime(2030, 1, 10, 10, 0, tzinfo=timezone.utc)
    slot = AvailabilitySlot(
        id=uuid.uuid4(),
        therapist_id=therapist_id,
        start_time=start,
        end_time=end,
        is_active=True,
    )
    db.add(slot)
    db.flush()
    return slot


def make_appointment(db, *, patient_id, therapist_id, slot_id, status: str = "confirmed"):
    from app.models.appointment import Appointment

    appt = Appointment(
        id=uuid.uuid4(),
        patient_id=patient_id,
        therapist_id=therapist_id,
        slot_id=slot_id,
        service_type="fisioterapia",
        status=status,
        cancellation_fee_pct=0,
    )
    db.add(appt)
    db.flush()
    return appt
