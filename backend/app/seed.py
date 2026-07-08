import uuid
from datetime import datetime, timedelta, timezone
from app.database import SessionLocal, engine
from app.models.user import User
from app.models.therapist import Therapist
from app.models.availability_slot import AvailabilitySlot
from app.models.appointment import Appointment
from app.models.rating import Rating
from app.services.auth import hash_password


def seed_data():
    db = SessionLocal()
    print("Clearing existing data...")
    db.query(Rating).delete()
    db.query(Appointment).delete()
    db.query(AvailabilitySlot).delete()
    db.query(Therapist).delete()
    db.query(User).delete()
    db.commit()

    print("Creating admin...")
    admin = User(
        email="admin@morad.com",
        password_hash=hash_password("adminpassword"),
        role="admin",
        first_name="Admin",
        last_name="Morad",
        phone="555-0100",
        email_verified=True,
    )
    db.add(admin)

    print("Creating therapists...")
    t1_user = User(
        email="terapeuta1@morad.com",
        password_hash=hash_password("therapistpassword"),
        role="therapist",
        first_name="Laura",
        last_name="Gomez",
        phone="555-0101",
        email_verified=True,
    )
    t2_user = User(
        email="terapeuta2@morad.com",
        password_hash=hash_password("therapistpassword"),
        role="therapist",
        first_name="Carlos",
        last_name="Perez",
        phone="555-0102",
        email_verified=True,
    )
    db.add(t1_user)
    db.add(t2_user)
    db.flush()

    t1 = Therapist(user_id=t1_user.id, specialty="Fisioterapia Deportiva")
    t2 = Therapist(user_id=t2_user.id, specialty="Kinesiología")
    db.add(t1)
    db.add(t2)
    db.flush()

    print("Creating patients...")
    patients = []
    patient_data = [
        ("paciente1@example.com", "Juan", "Garcia", "555-0201"),
        ("paciente2@example.com", "Maria", "Rodriguez", "555-0202"),
        ("paciente3@example.com", "Pedro", "Martinez", "555-0203"),
        ("paciente4@example.com", "Ana", "Lopez", "555-0204"),
        ("paciente5@example.com", "Lucia", "Sanchez", "555-0205"),
    ]
    for email, first, last, phone in patient_data:
        p = User(
            email=email,
            password_hash=hash_password("patientpassword"),
            role="patient",
            first_name=first,
            last_name=last,
            phone=phone,
            email_verified=True,
        )
        db.add(p)
        patients.append(p)
    db.flush()

    print("Creating slots for the next 30 days...")
    slots_created = []
    # Base datetime starting tomorrow at 9:00 AM UTC
    base_date = (datetime.now(timezone.utc) + timedelta(days=1)).replace(
        hour=9, minute=0, second=0, microsecond=0
    )
    for day_offset in range(30):
        slot_day = base_date + timedelta(days=day_offset)
        if slot_day.weekday() >= 5:  # Skip weekends
            continue
        for hour in [9, 10, 11, 12]:
            start = slot_day.replace(hour=hour)
            end = start + timedelta(hours=1)
            # Therapist 1
            s1 = AvailabilitySlot(
                therapist_id=t1.user_id,
                start_time=start,
                end_time=end,
                is_active=True,
            )
            # Therapist 2
            s2 = AvailabilitySlot(
                therapist_id=t2.user_id,
                start_time=start,
                end_time=end,
                is_active=True,
            )
            db.add(s1)
            db.add(s2)
            slots_created.append((s1, s2))
    db.flush()

    print("Booking sample appointments...")
    # Appt 1: Patient 1, Therapist 1, Slot 1 -> Completed with 5-star rating
    appt1 = Appointment(
        patient_id=patients[0].id,
        therapist_id=t1.user_id,
        slot_id=slots_created[0][0].id,
        service_type="fisioterapia",
        notes="Recuperación hombro",
        status="completed",
        cancellation_fee_pct=0,
    )
    db.add(appt1)
    db.flush()
    r1 = Rating(
        appointment_id=appt1.id,
        patient_id=patients[0].id,
        stars=5,
        comment="Excelente atención, muy paciente y clara.",
    )
    db.add(r1)

    # Appt 2: Patient 2, Therapist 1, Slot 2 -> Completed with 4-star rating
    appt2 = Appointment(
        patient_id=patients[1].id,
        therapist_id=t1.user_id,
        slot_id=slots_created[0][1].id,
        service_type="fisioterapia",
        notes="Evaluación postural",
        status="completed",
        cancellation_fee_pct=0,
    )
    db.add(appt2)
    db.flush()
    r2 = Rating(
        appointment_id=appt2.id,
        patient_id=patients[1].id,
        stars=4,
        comment="Muy profesional y limpio.",
    )
    db.add(r2)

    # Appt 3: Patient 3, Therapist 2, Slot 3 -> Confirmed
    appt3 = Appointment(
        patient_id=patients[2].id,
        therapist_id=t2.user_id,
        slot_id=slots_created[1][1].id,
        service_type="kinesiologia",
        notes="Dolor lumbar crónico",
        status="confirmed",
        cancellation_fee_pct=0,
    )
    db.add(appt3)

    # Appt 4: Patient 4, Therapist 2, Slot 4 -> Cancelled with fee
    appt4 = Appointment(
        patient_id=patients[3].id,
        therapist_id=t2.user_id,
        slot_id=slots_created[2][1].id,
        service_type="kinesiologia",
        notes="Rehabilitación de rodilla",
        status="cancelled",
        cancellation_fee_pct=50,
    )
    db.add(appt4)

    # Appt 5: Patient 5, Therapist 1, Slot 5 -> No Show
    appt5 = Appointment(
        patient_id=patients[4].id,
        therapist_id=t1.user_id,
        slot_id=slots_created[3][0].id,
        service_type="fisioterapia",
        notes="Contractura en cuello",
        status="no_show",
        cancellation_fee_pct=0,
    )
    db.add(appt5)

    # Appt 6: Patient 1, Therapist 2, Slot 6 -> Confirmed
    appt6 = Appointment(
        patient_id=patients[0].id,
        therapist_id=t2.user_id,
        slot_id=slots_created[4][1].id,
        service_type="kinesiologia",
        notes="Sesión de seguimiento",
        status="confirmed",
        cancellation_fee_pct=0,
    )
    db.add(appt6)

    db.commit()
    db.close()
    print("==================================================")
    print("Database successfully seeded!")
    print("Cuentas de prueba creadas:")
    print("  - Administrador: admin@morad.com / adminpassword")
    print("  - Terapeuta 1: terapeuta1@morad.com / therapistpassword")
    print("  - Terapeuta 2: terapeuta2@morad.com / therapistpassword")
    print("  - Paciente 1: paciente1@example.com / patientpassword")
    print("  - Paciente 2: paciente2@example.com / patientpassword")
    print("==================================================")


if __name__ == "__main__":
    seed_data()
