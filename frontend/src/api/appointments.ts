import { apiClient } from './client'

export interface AppointmentOut {
  id: string
  patient_id: string
  therapist_id: string
  slot_id: string
  service_type: string
  notes: string | null
  status: 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  cancellation_fee_pct: number
  created_at: string
  slot?: { start_time: string; end_time: string } | null
  has_rating?: boolean
}

export interface RatingPayload {
  appointment_id: string
  stars: number
  comment?: string
}

export interface RatingOut {
  id: string
  appointment_id: string
  patient_id: string
  stars: number
  comment: string | null
  created_at: string
}

export interface CreateAppointmentPayload {
  slot_id: string
  service_type: string
  notes?: string
}

export interface ReschedulePayload {
  new_slot_id: string
  service_type?: string
  notes?: string
}

export async function fetchAppointments(): Promise<AppointmentOut[]> {
  const res = await apiClient.get<AppointmentOut[]>('/api/appointments')
  return res.data
}

export async function createAppointment(
  payload: CreateAppointmentPayload,
): Promise<AppointmentOut> {
  const res = await apiClient.post<AppointmentOut>('/api/appointments', payload)
  return res.data
}

export async function cancelAppointment(id: string): Promise<AppointmentOut> {
  const res = await apiClient.post<AppointmentOut>(
    `/api/appointments/${id}/cancel`,
  )
  return res.data
}

export async function rescheduleAppointment(
  id: string,
  payload: ReschedulePayload,
): Promise<AppointmentOut> {
  const res = await apiClient.post<AppointmentOut>(
    `/api/appointments/${id}/reschedule`,
    payload,
  )
  return res.data
}

export async function getCancellationFeePreview(
  id: string,
): Promise<{ cancellation_fee_pct: number }> {
  const res = await apiClient.get<{ cancellation_fee_pct: number }>(
    `/api/appointments/${id}/cancellation-fee`,
  )
  return res.data
}

export async function submitRating(payload: RatingPayload): Promise<RatingOut> {
  const res = await apiClient.post<RatingOut>('/api/ratings', payload)
  return res.data
}

export async function updateAppointmentStatus(
  id: string,
  status: 'completed' | 'no_show',
): Promise<AppointmentOut> {
  const res = await apiClient.patch<AppointmentOut>(
    `/api/appointments/${id}/status`,
    { status },
  )
  return res.data
}

