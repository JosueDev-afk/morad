# Requirements Document

## Introduction

MORAD es un sistema web de agendamiento de citas para una clínica de fisioterapia. El MVP contempla tres roles: **paciente**, **fisioterapeuta** y **administrador**. El flujo principal cubre el ciclo completo: registro → visualización de horarios → reserva → cancelación/reprogramación → calificación post-cita. El stack es React + TypeScript + shadcn/ui en el frontend y Python + FastAPI + PostgreSQL en el backend, con autenticación JWT.

---

## Requirements

### Requirement 1 — Registro e inicio de sesión de pacientes (HU-001)

**User Story:** As a patient, I want to register and log in to the system, so that I can book and manage my appointments.

#### Acceptance Criteria

1. WHEN a visitor submits the registration form with first name, last name, email, password, and password confirmation THEN the system SHALL create the user account with `email_verified = true` and return a success response.
2. WHEN a visitor attempts to register with an email that already exists THEN the system SHALL reject the request with a clear error message indicating the email is already in use.
3. WHEN a visitor submits a registration form with passwords that do not match THEN the system SHALL reject the request and display a validation error.
4. WHEN a registered patient submits valid credentials THEN the system SHALL return a JWT access token and a refresh token.
5. WHEN a registered patient submits invalid credentials THEN the system SHALL return a 401 error with a clear message.
6. WHEN a JWT access token expires THEN the system SHALL allow the client to exchange a valid refresh token for a new access token.
7. WHEN a patient logs out THEN the system SHALL invalidate the refresh token.
8. The system SHALL store `email_verified` and a `verification_codes` table in the data model to support email verification in a future phase without schema redesign.
9. WHEN a patient completes registration THEN the system SHALL allow immediate login without any email verification step in the MVP.

---

### Requirement 2 — Visualización de horarios disponibles (HU-002)

**User Story:** As a patient, I want to see available appointment slots by date and therapist, so that I can choose a convenient time.

#### Acceptance Criteria

1. WHEN a patient selects a date THEN the system SHALL display only slots that are active, not yet booked, and in the future.
2. WHEN a patient applies a filter by therapist THEN the system SHALL show only the slots belonging to that therapist.
3. WHEN no slots are available for the selected date THEN the system SHALL display a clear "no available slots" message.
4. WHEN a patient attempts to select a past date THEN the system SHALL prevent the selection and show an appropriate message.
5. WHEN slots are updated (e.g., another patient books one) THEN the frontend SHALL reflect the change without requiring a full page reload (SPA behavior; no WebSocket required for MVP).

---

### Requirement 3 — Reserva de cita (HU-003)

**User Story:** As a patient, I want to book an appointment by selecting a date, slot, and service type, so that I can receive physiotherapy treatment.

#### Acceptance Criteria

1. WHEN a patient selects a slot, a service type, and optionally adds notes, then confirms THEN the system SHALL create the appointment, mark the slot as booked, and show a success confirmation in the UI.
2. WHEN a patient already has 2 active future appointments THEN the system SHALL reject the booking request with a clear message explaining the limit.
3. WHEN two patients attempt to book the same slot simultaneously THEN the system SHALL guarantee only one succeeds, using a database-level constraint (`UNIQUE(therapist_id, start_time)` on active appointments or `SELECT ... FOR UPDATE`), and return a clear "slot no longer available" error to the other.
4. WHEN a booking succeeds THEN the appointment SHALL appear immediately in the patient's "Mis citas" view.
5. The system SHALL NOT send any email or SMS confirmation in the MVP; confirmation is visual only (toast + updated appointment list).

---

### Requirement 4 — Cancelación y reprogramación (HU-004)

**User Story:** As a patient, I want to cancel or reschedule my appointments, so that I can manage changes in my availability.

#### Acceptance Criteria

1. WHEN a patient cancels an appointment with ≥24 hours of advance notice THEN the system SHALL apply a 0% cancellation fee.
2. WHEN a patient cancels an appointment between 6 and 24 hours before the appointment THEN the system SHALL apply a 50% cancellation fee.
3. WHEN a patient cancels an appointment with less than 6 hours of advance notice THEN the system SHALL apply a 100% cancellation fee.
4. WHEN a patient cancels their very first appointment ever (no prior cancellations in history) THEN the system SHALL apply a 0% fee regardless of advance notice (courtesy waiver).
5. WHEN a cancellation is confirmed THEN the system SHALL free the associated slot and update the appointment status to `cancelled`.
6. WHEN a patient attempts to cancel an appointment with status `completed` THEN the system SHALL reject the request with a clear error message.
7. WHEN a patient reschedules an appointment THEN the system SHALL atomically cancel the original appointment (releasing its slot) and create a new appointment in the chosen slot.
8. The system SHALL NOT send any email or SMS notification for cancellations or rescheduling in the MVP; confirmation is visual only.

---

### Requirement 5 — Gestión de horarios por el administrador (HU-005)

**User Story:** As an administrator, I want to manage therapist availability slots, so that patients can see and book correct appointment times.

#### Acceptance Criteria

1. WHEN an administrator creates a new availability slot for a therapist THEN the system SHALL validate there is no overlapping slot for the same therapist and save it if valid.
2. WHEN an administrator attempts to create a slot that overlaps an existing one for the same therapist THEN the system SHALL reject it with a clear overlap error.
3. WHEN an administrator edits or deletes a slot that already has a confirmed appointment THEN the system SHALL reject the operation with a message explaining the slot is in use, optionally offering a "disable" action instead.
4. WHEN an administrator views the schedule THEN the system SHALL display it in both weekly and monthly views, filterable by therapist.
5. WHEN an administrator lists slots THEN the system SHALL support full CRUD (create, read, update, delete) for availability slots.

---

### Requirement 6 — Reportes de citas (HU-006)

**User Story:** As an administrator, I want to generate appointment reports filtered by date range and therapist, so that I can monitor clinic performance.

#### Acceptance Criteria

1. WHEN an administrator opens the reports panel THEN the system SHALL display appointment counts grouped by status: `confirmed`, `completed`, `cancelled`, `no_show`.
2. WHEN an administrator applies a date range filter THEN the system SHALL restrict results to appointments within that range.
3. WHEN an administrator applies a therapist filter THEN the system SHALL restrict results to that therapist's appointments (or all therapists if none selected).
4. WHEN an administrator requests a CSV export THEN the system SHALL generate and download a CSV file with the filtered appointment data.
5. PDF export is desirable but non-blocking for the MVP.

---

### Requirement 7 — Agenda del día del fisioterapeuta (HU-007)

**User Story:** As a therapist, I want to view my own daily schedule, so that I can prepare for each patient appointment.

#### Acceptance Criteria

1. WHEN a therapist views their agenda THEN the system SHALL display only their own appointments, never another therapist's.
2. WHEN a therapist views their agenda THEN appointments SHALL be listed in chronological order with the appointment status visible.
3. WHEN a therapist views their agenda THEN free slots SHALL be visible as "disponible".
4. WHEN a therapist clicks on an appointment THEN the system SHALL show a modal/panel with the patient's name, phone, email, notes, and history of previous appointments with that therapist.
5. The agenda SHALL refresh when the therapist navigates to the view or manually triggers a refresh; real-time WebSocket updates are not required for the MVP.

---

### Requirement 8 — Calificación post-cita (HU-009)

**User Story:** As a patient, I want to rate a completed appointment, so that I can provide feedback on the service I received.

#### Acceptance Criteria

1. WHEN a patient views a completed appointment THEN the system SHALL offer a rating option (1–5 stars + optional comment up to 500 characters).
2. WHEN a patient submits a rating THEN the system SHALL save it and mark the appointment as rated (no further edits allowed from the patient).
3. WHEN a patient attempts to rate an appointment that has already been rated THEN the system SHALL reject the request.
4. WHEN a patient attempts to rate an appointment that is not in `completed` status THEN the system SHALL reject the request.
5. WHEN an administrator views the ratings panel THEN the system SHALL display all ratings and comments across all appointments.

---

### Requirement 9 — Dashboard de métricas agregadas (HU-010 adaptado)

**User Story:** As an administrator, I want to view aggregated and anonymized clinic metrics, so that I can understand overall performance without exposing patient personal data.

#### Acceptance Criteria

1. WHEN an administrator opens the metrics dashboard THEN the system SHALL display total patient count, patients active in the last 30 days, appointment distribution by service type, and appointment distribution by status.
2. The system SHALL NOT expose individual patient names, emails, phone numbers, or medical history in any report or export.
3. WHEN an administrator views age distribution THEN the system SHALL show aggregated age range buckets (e.g., 18–25, 26–35) without individual data.

---

### Requirement 10 — Autorización por roles

**User Story:** As a system administrator, I want role-based access control enforced on every endpoint, so that users can only perform actions permitted by their role.

#### Acceptance Criteria

1. WHEN a patient attempts to access a therapist or admin endpoint THEN the system SHALL return a 403 Forbidden response.
2. WHEN a therapist attempts to view another therapist's agenda or manage slots THEN the system SHALL return a 403 Forbidden response.
3. WHEN an unauthenticated user accesses any protected endpoint THEN the system SHALL return a 401 Unauthorized response.
4. WHEN a user with role `admin` accesses admin-only features THEN the system SHALL allow the operation.

---

### Requirement 11 — Identidad visual y componentes UI

**User Story:** As a clinic stakeholder, I want the application to use the MORAD brand palette and consistent UI components, so that the product feels professional and cohesive.

#### Acceptance Criteria

1. The system SHALL use the MORAD color palette: Turquoise `#66CCCC` (primary), Purple `#A58BDB` (secondary), Pink `#DA39EF` (CTA/highlight), Gray `#545454` (text/borders), White `#FFFFFF` (background).
2. Primary action buttons SHALL use turquoise; success states SHALL use turquoise/green-turquoise; error states SHALL use the default shadcn red; promotional highlights SHALL use pink.
3. The system SHALL use the following shadcn/ui components: button, card, dialog, calendar, select, input, badge, table, tabs, toast.

---

### Requirement 12 — Datos de prueba (Seed data)

**User Story:** As a developer, I want seed data pre-loaded, so that I can test all features without manual data entry.

#### Acceptance Criteria

1. WHEN the seed script is run THEN the system SHALL create at least 2 therapists, several patients, availability slots covering the next 30 days, and appointments in various statuses.
2. WHEN the seed data is loaded THEN it SHALL be sufficient to test filters, reports, and rating flows end to end.
