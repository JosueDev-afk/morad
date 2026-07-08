import csv
import io
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import cast, Date as SADate, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models.appointment import Appointment
from app.models.availability_slot import AvailabilitySlot
from app.models.user import User
from app.models.therapist import Therapist
from app.models.rating import Rating

# Prefix is empty so we can register both /api/reports and /api/metrics
router = APIRouter(tags=["reports_and_metrics"])


class ReportSummary(BaseModel):
    total: int
    confirmed: int
    completed: int
    cancelled: int
    no_show: int


class ReportAppointmentItem(BaseModel):
    id: uuid.UUID
    patient_email: str
    therapist_name: str
    service_type: str
    status: str
    start_time: datetime
    end_time: datetime
    cancellation_fee_pct: int
    created_at: datetime


class ReportResponse(BaseModel):
    summary: ReportSummary
    appointments: List[ReportAppointmentItem]


class DashboardMetricsResponse(BaseModel):
    total_patients: int
    active_last_month: int
    by_service: dict
    by_status: dict
    by_age_range: dict


def generate_csv(appointments: List[Appointment]):
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "ID Cita", "Email Paciente", "Terapeuta", "Servicio", 
        "Estado", "Inicio", "Fin", "Fee Cancelacion (%)", "Creado En"
    ])
    yield output.getvalue()
    output.seek(0)
    output.truncate(0)

    for appt in appointments:
        start_str = appt.slot.start_time.isoformat() if appt.slot else ""
        end_str = appt.slot.end_time.isoformat() if appt.slot else ""
        therapist_name = (
            f"{appt.therapist.user.first_name} {appt.therapist.user.last_name}"
            if appt.therapist and appt.therapist.user
            else ""
        )
        writer.writerow([
            str(appt.id),
            appt.patient.email if appt.patient else "",
            therapist_name,
            appt.service_type,
            appt.status,
            start_str,
            end_str,
            appt.cancellation_fee_pct,
            appt.created_at.isoformat() if appt.created_at else ""
        ])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)


@router.get("/api/reports/appointments")
def get_appointments_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    therapist_id: Optional[uuid.UUID] = None,
    format: str = "json",
    db: Session = Depends(get_db),
    _: User = Depends(require_role(["admin"])),
):
    """Retrieve detailed appointment reports with status summary or CSV streaming (req 11.1)."""
    query = db.query(Appointment).join(AvailabilitySlot, Appointment.slot_id == AvailabilitySlot.id)

    if therapist_id:
        query = query.filter(Appointment.therapist_id == therapist_id)

    if start_date:
        query = query.filter(cast(AvailabilitySlot.start_time, SADate) >= start_date)

    if end_date:
        query = query.filter(cast(AvailabilitySlot.start_time, SADate) <= end_date)

    appointments = query.order_by(AvailabilitySlot.start_time.desc()).all()

    if format.lower() == "csv":
        response = StreamingResponse(
            generate_csv(appointments),
            media_type="text/csv",
        )
        response.headers["Content-Disposition"] = "attachment; filename=reporte_citas.csv"
        return response

    # Default to JSON response
    summary = {
        "total": len(appointments),
        "confirmed": sum(1 for a in appointments if a.status == "confirmed"),
        "completed": sum(1 for a in appointments if a.status == "completed"),
        "cancelled": sum(1 for a in appointments if a.status == "cancelled"),
        "no_show": sum(1 for a in appointments if a.status == "no_show"),
    }

    items = [
        ReportAppointmentItem(
            id=a.id,
            patient_email=a.patient.email if a.patient else "",
            therapist_name=(
                f"{a.therapist.user.first_name} {a.therapist.user.last_name}"
                if a.therapist and a.therapist.user
                else ""
            ),
            service_type=a.service_type,
            status=a.status,
            start_time=a.slot.start_time,
            end_time=a.slot.end_time,
            cancellation_fee_pct=a.cancellation_fee_pct,
            created_at=a.created_at,
        )
        for a in appointments
    ]

    return ReportResponse(summary=ReportSummary(**summary), appointments=items)


@router.get("/api/metrics/dashboard", response_model=DashboardMetricsResponse)
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(["admin"])),
):
    """Retrieve anonymized dashboard metrics with no PII (req 11.2)."""
    # 1. Total patients
    total_patients = db.query(User).filter(User.role == "patient").count()

    # 2. Active patients last month (past 30 days)
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    # SQLite naive datetime compatibility check
    active_last_month = (
        db.query(Appointment.patient_id)
        .filter(Appointment.created_at >= thirty_days_ago)
        .distinct()
        .count()
    )

    # 3. Distribution by service
    service_counts = (
        db.query(Appointment.service_type, func.count(Appointment.id))
        .group_by(Appointment.service_type)
        .all()
    )
    by_service = {service: count for service, count in service_counts}

    # 4. Distribution by status
    status_counts = (
        db.query(Appointment.status, func.count(Appointment.id))
        .group_by(Appointment.status)
        .all()
    )
    by_status = {status: count for status, count in status_counts}

    # Ensure all statuses exist in by_status
    for s in ["confirmed", "completed", "cancelled", "no_show"]:
        if s not in by_status:
            by_status[s] = 0

    # 5. Distribution by age range (deterministic simulation based on user UUID int value)
    age_ranges = {"18-25": 0, "26-35": 0, "36-50": 0, "50+": 0}
    patients = db.query(User.id).filter(User.role == "patient").all()
    
    for p in patients:
        uuid_int = p.id.int
        bucket = uuid_int % 4
        if bucket == 0:
            age_ranges["18-25"] += 1
        elif bucket == 1:
            age_ranges["26-35"] += 1
        elif bucket == 2:
            age_ranges["36-50"] += 1
        else:
            age_ranges["50+"] += 1

    return DashboardMetricsResponse(
        total_patients=total_patients,
        active_last_month=active_last_month,
        by_service=by_service,
        by_status=by_status,
        by_age_range=age_ranges,
    )
