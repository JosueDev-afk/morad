import { apiClient } from './client'

export interface SlotOut {
  id: string
  therapist_id: string
  start_time: string
  end_time: string
  is_active: boolean
}

export interface TherapistOut {
  id: string
  first_name: string
  last_name: string
  specialty: string | null
}

export async function fetchSlots(params: {
  date?: string
  therapist_id?: string
}): Promise<SlotOut[]> {
  const res = await apiClient.get<SlotOut[]>('/api/slots', { params })
  return res.data
}

export async function fetchTherapists(): Promise<TherapistOut[]> {
  const res = await apiClient.get<TherapistOut[]>('/api/therapists')
  return res.data
}

export async function createSlot(payload: {
  therapist_id: string
  start_time: string
  end_time: string
}): Promise<SlotOut> {
  const res = await apiClient.post<SlotOut>('/api/slots', payload)
  return res.data
}

export async function updateSlot(
  id: string,
  payload: {
    start_time?: string
    end_time?: string
    is_active?: boolean
  },
): Promise<SlotOut> {
  const res = await apiClient.put<SlotOut>(`/api/slots/${id}`, payload)
  return res.data
}

export async function deleteSlot(id: string): Promise<void> {
  await apiClient.delete(`/api/slots/${id}`)
}

