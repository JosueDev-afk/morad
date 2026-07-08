import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  BarChart,
  TrendingUp,
  FileSpreadsheet,
  Calendar,
  Users,
  Search,
  Download,
  AlertCircle,
} from 'lucide-react'
import { fetchTherapists } from '@/api/slots'
import { fetchReports, fetchMetrics } from '@/api/reports'
import { apiClient } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/utils'

export default function AdminReports() {
  const [activeTab, setActiveTab] = useState<'metrics' | 'reports'>('metrics')

  // Reports filters state
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [therapistId, setTherapistId] = useState<string>('')

  // Queries
  const { data: therapists = [] } = useQuery({
    queryKey: ['therapists'],
    queryFn: fetchTherapists,
  })

  const { data: metrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: fetchMetrics,
    enabled: activeTab === 'metrics',
  })

  const {
    data: reports,
    isLoading: isLoadingReports,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ['admin-reports', startDate, endDate, therapistId],
    queryFn: () =>
      fetchReports({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        therapist_id: therapistId || undefined,
      }),
    enabled: activeTab === 'reports',
  })

  // Export CSV handler
  const handleExportCSV = async () => {
    try {
      const res = await apiClient.get('/api/reports/appointments', {
        params: {
          format: 'csv',
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          therapist_id: therapistId || undefined,
        },
        responseType: 'blob',
      })

      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `reporte_citas_${format(new Date(), 'yyyy-MM-dd')}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast({ title: 'Exportación completada', description: 'El archivo CSV ha sido descargado.' })
    } catch (err) {
      toast({
        title: 'Error de exportación',
        description: 'No se pudo generar el archivo CSV.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-morad-gray">Reportes & Métricas</h1>
          <p className="text-sm text-morad-gray/60">Análisis y estadísticas de las citas de MORAD.</p>
        </div>

        {/* Tab selection */}
        <div className="flex bg-white border border-slate-200 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('metrics')}
            className={cn(
              'px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1.5',
              activeTab === 'metrics'
                ? 'bg-morad-purple text-white shadow'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            <TrendingUp className="h-4 w-4" />
            Métricas
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={cn(
              'px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1.5',
              activeTab === 'reports'
                ? 'bg-morad-purple text-white shadow'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Reportes
          </button>
        </div>
      </header>

      {/* ── METRICS DASHBOARD VIEW ── */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          {isLoadingMetrics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
              <div className="h-32 bg-white rounded-xl border border-slate-200" />
              <div className="h-32 bg-white rounded-xl border border-slate-200" />
            </div>
          ) : metrics ? (
            <>
              {/* Total KPI cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
                  <div className="bg-morad-purple/10 text-morad-purple p-4 rounded-xl">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-slate-400 font-medium text-sm">Pacientes Registrados</h3>
                    <p className="text-3xl font-extrabold text-morad-gray mt-1">
                      {metrics.total_patients}
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
                  <div className="bg-morad-turquoise/10 text-morad-turquoise p-4 rounded-xl">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-slate-400 font-medium text-sm">Pacientes Activos (Último Mes)</h3>
                    <p className="text-3xl font-extrabold text-morad-gray mt-1">
                      {metrics.active_last_month}
                    </p>
                  </div>
                </div>
              </div>

              {/* Graphical breakdowns */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Break down 1: Services */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-morad-gray text-base flex items-center gap-2">
                    <BarChart className="text-morad-purple h-5 w-5" />
                    Distribución por Servicio
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(metrics.by_service).map(([service, count]) => {
                      const total = Object.values(metrics.by_service).reduce((a, b) => a + b, 0) || 1
                      const pct = Math.round((count / total) * 100)
                      return (
                        <div key={service} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span className="uppercase">{service}</span>
                            <span>
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-morad-purple rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                    {Object.keys(metrics.by_service).length === 0 && (
                      <p className="text-xs text-slate-400 italic py-6 text-center">Sin datos de servicios.</p>
                    )}
                  </div>
                </div>

                {/* Break down 2: Status */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-morad-gray text-base flex items-center gap-2">
                    <BarChart className="text-morad-turquoise h-5 w-5" />
                    Estado de Citas
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(metrics.by_status).map(([status, count]) => {
                      const total = Object.values(metrics.by_status).reduce((a, b) => a + b, 0) || 1
                      const pct = Math.round((count / total) * 100)
                      const colors: Record<string, string> = {
                        confirmed: 'bg-morad-turquoise',
                        completed: 'bg-green-500',
                        cancelled: 'bg-red-500',
                        no_show: 'bg-slate-400',
                      }
                      const labels: Record<string, string> = {
                        confirmed: 'Confirmada',
                        completed: 'Completada',
                        cancelled: 'Cancelada',
                        no_show: 'No asistió',
                      }

                      return (
                        <div key={status} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span>{labels[status] || status}</span>
                            <span>
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full', colors[status] || 'bg-slate-400')}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Break down 3: Age Range */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-morad-gray text-base flex items-center gap-2">
                    <BarChart className="text-morad-pink h-5 w-5" />
                    Rango de Edad (Pacientes)
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(metrics.by_age_range).map(([range, count]) => {
                      const total = Object.values(metrics.by_age_range).reduce((a, b) => a + b, 0) || 1
                      const pct = Math.round((count / total) * 100)
                      return (
                        <div key={range} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span>{range} Años</span>
                            <span>
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-morad-pink rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-slate-400 italic text-center py-12">No se pudieron cargar las métricas.</p>
          )}
        </div>
      )}

      {/* ── REPORTS & CSV SEARCH VIEW ── */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Filtros de Búsqueda</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Desde
                </label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Hasta
                </label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Fisioterapeuta</label>
                <select
                  value={therapistId}
                  onChange={(e) => setTherapistId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-morad-gray bg-white focus:outline-none focus:ring-2 focus:ring-morad-purple h-9"
                >
                  <option value="">Todos</option>
                  {therapists.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.first_name} {t.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => refetchReports()}
                  className="flex-1 bg-morad-purple hover:bg-morad-purple/90 text-white h-9 text-xs"
                >
                  <Search className="h-4 w-4 mr-1.5" /> Buscar
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                  disabled={!reports || reports.appointments.length === 0}
                  className="border-slate-200 hover:bg-slate-50 h-9 px-3"
                  title="Exportar a CSV"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Report Results */}
          {isLoadingReports ? (
            <div className="bg-white border border-slate-200 rounded-xl p-16 flex justify-center items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-morad-purple" />
            </div>
          ) : reports ? (
            <div className="space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  { label: 'Total', value: reports.summary.total, color: 'text-morad-purple bg-morad-purple/5' },
                  { label: 'Confirmadas', value: reports.summary.confirmed, color: 'text-morad-turquoise bg-morad-turquoise/5' },
                  { label: 'Completadas', value: reports.summary.completed, color: 'text-green-600 bg-green-500/5' },
                  { label: 'Canceladas', value: reports.summary.cancelled, color: 'text-red-500 bg-red-500/5' },
                  { label: 'No Asistió', value: reports.summary.no_show, color: 'text-slate-500 bg-slate-500/5' },
                ].map((s) => (
                  <div key={s.label} className={cn('rounded-xl p-4 border border-slate-150 shadow-sm text-center', s.color)}>
                    <p className="text-[10px] uppercase font-bold tracking-wider opacity-70">{s.label}</p>
                    <p className="text-2xl font-black mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Paciente</th>
                        <th className="py-3 px-4">Terapeuta</th>
                        <th className="py-3 px-4">Servicio</th>
                        <th className="py-3 px-4">Fecha & Hora</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4 text-right">Fee Cancelación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reports.appointments.map((appt) => {
                        const start = new Date(appt.start_time)
                        const startFmt = format(start, 'dd/MM/yyyy HH:mm', { locale: es })
                        const colors: Record<string, string> = {
                          confirmed: 'bg-morad-turquoise/10 text-morad-turquoise',
                          completed: 'bg-green-100 text-green-700',
                          cancelled: 'bg-red-100 text-red-500',
                          no_show: 'bg-gray-100 text-slate-500',
                        }
                        const labels: Record<string, string> = {
                          confirmed: 'Confirmada',
                          completed: 'Completada',
                          cancelled: 'Cancelada',
                          no_show: 'No asistió',
                        }

                        return (
                          <tr key={appt.id} className="hover:bg-slate-50/50">
                            <td className="py-3.5 px-4 font-medium text-slate-700 truncate max-w-44">
                              {appt.patient_email}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 truncate max-w-44">
                              {appt.therapist_name}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 uppercase font-semibold text-xs">
                              {appt.service_type}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 font-medium">
                              {startFmt}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', colors[appt.status])}>
                                {labels[appt.status] || appt.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                              {appt.cancellation_fee_pct}%
                            </td>
                          </tr>
                        )
                      })}

                      {reports.appointments.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                            No se encontraron citas con los filtros especificados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/60 p-8 space-y-3">
              <AlertCircle className="mx-auto h-12 w-12 text-slate-300 stroke-[1.5]" />
              <p className="text-slate-400 text-sm font-medium">Usa los filtros de arriba para realizar una consulta de citas.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
