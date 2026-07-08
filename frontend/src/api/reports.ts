import { apiClient } from './client'

export interface ReportSummary {
  total: number
  confirmed: number
  completed: number
  cancelled: number
  no_show: number
}

export interface ReportAppointmentItem {
  id: string
  patient_email: string
  therapist_name: string
  service_type: string
  status: 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  start_time: string
  end_time: string
  cancellation_fee_pct: number
  created_at: string
}

export interface ReportResponse {
  summary: ReportSummary
  appointments: ReportAppointmentItem[]
}

export interface DashboardMetricsResponse {
  total_patients: number
  active_last_month: number
  by_service: Record<string, number>
  by_status: Record<string, number>
  by_age_range: Record<string, number>
}

export async function fetchReports(params: {
  start_date?: string
  end_date?: string
  therapist_id?: string
}): Promise<ReportResponse> {
  const res = await apiClient.get<ReportResponse>('/api/reports/appointments', {
    params,
  })
  return res.data
}

export async function fetchMetrics(): Promise<DashboardMetricsResponse> {
  const res = await apiClient.get<DashboardMetricsResponse>(
    '/api/metrics/dashboard',
  )
  return res.data
}
