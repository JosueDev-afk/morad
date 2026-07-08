import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { Calendar, Clock, RefreshCw, User, Phone, Mail, FileText, CheckCircle, XCircle } from 'lucide-react'
import { updateAppointmentStatus, type AppointmentOut } from '@/api/appointments'
import { apiClient } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/utils'

interface PatientDetail {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
}

interface PatientHistoryItem {
  id: string
  service_type: string
  status: string
  start_time: string
  end_time: string
  notes: string | null
}

interface AppointmentDetail extends AppointmentOut {
  patient?: PatientDetail | null
  patient_history?: PatientHistoryItem[]
}

interface TherapistAgendaData {
  appointments: AppointmentOut[]
  free_slots: {
    id: string
    therapist_id: string
    start_time: string
    end_time: string
    is_active: boolean
  }[]
}

export default function TherapistAgenda() {
  const queryClient = useQueryClient()
  const today = startOfDay(new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [detailId, setDetailId] = useState<string | null>(null)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')

  // Fetch agenda (appointments and free slots)
  const { data, isLoading, isError, refetch } = useQuery<TherapistAgendaData>({
    queryKey: ['therapist-agenda', dateStr],
    queryFn: async () => {
      const res = await apiClient.get<TherapistAgendaData>('/api/appointments', {
        params: { date: dateStr },
      })
      return res.data
    },
  })

  // Fetch detailed appointment for modal
  const { data: detail, isLoading: isLoadingDetail } = useQuery<AppointmentDetail>({
    queryKey: ['appointment-detail', detailId],
    queryFn: async () => {
      const res = await apiClient.get<AppointmentDetail>(`/api/appointments/${detailId}`)
      return res.data
    },
    enabled: !!detailId,
  })

  // Update appointment status mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'completed' | 'no_show' }) =>
      updateAppointmentStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['therapist-agenda'] })
      queryClient.invalidateQueries({ queryKey: ['appointment-detail'] })
      toast({ title: 'Estado actualizado', description: 'La cita ha sido actualizada con éxito.' })
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail ?? 'Ocurrió un error al actualizar la cita.'
      toast({ title: 'Error', description: detail, variant: 'destructive' })
    },
  })

  // Merge appointments and free slots into a chronological list
  const agendaItems: Array<
    | { type: 'appointment'; time: string; data: AppointmentOut }
    | { type: 'slot'; time: string; data: any }
  > = []

  if (data) {
    // Add appointments
    data.appointments.forEach((appt) => {
      agendaItems.push({
        type: 'appointment',
        time: appt.slot?.start_time ?? appt.created_at,
        data: appt,
      })
    })

    // Add free slots
    data.free_slots.forEach((slot) => {
      agendaItems.push({
        type: 'slot',
        time: slot.start_time,
        data: slot,
      })
    })

    // Sort chronologically
    agendaItems.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  }

  const STATUS_LABEL: Record<string, string> = {
    confirmed: 'Confirmada',
    completed: 'Completada',
    cancelled: 'Cancelada',
    no_show: 'No asistió',
  }

  const STATUS_CLASS: Record<string, string> = {
    confirmed: 'bg-morad-turquoise/15 text-morad-turquoise border-morad-turquoise/20',
    completed: 'bg-green-500/15 text-green-600 border-green-500/20',
    cancelled: 'bg-red-500/15 text-red-500 border-red-500/20',
    no_show: 'bg-gray-500/15 text-morad-gray/60 border-gray-500/20',
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar calendar */}
      <aside className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-morad-gray flex items-center gap-2">
            <Calendar className="text-morad-purple h-5 w-5" />
            Agenda Diaria
          </h2>
          <p className="text-xs text-morad-gray/50 mt-1">Selecciona un día para ver tus citas y bloques libres.</p>
        </div>

        <div className="flex justify-center border border-slate-100 rounded-xl p-2 bg-slate-50/50 shadow-inner">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={(day) => day && setSelectedDate(day)}
            locale={es}
            classNames={{
              selected: 'bg-morad-purple text-white rounded-full font-semibold',
              today: 'font-bold text-morad-purple border border-morad-purple/30',
              day: 'hover:bg-morad-purple/10 hover:text-morad-purple rounded-full transition-colors',
            }}
          />
        </div>
      </aside>

      {/* Main Agenda View */}
      <main className="flex-1 p-6 md:p-8 space-y-6 max-w-4xl">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-morad-gray">
              {format(selectedDate, "eeee, d 'de' MMMM", { locale: es })}
            </h1>
            <p className="text-sm text-morad-gray/60">
              Total eventos para hoy: {agendaItems.length}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="border-slate-200 text-morad-gray hover:bg-slate-50 flex items-center gap-1.5"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Actualizar
          </Button>
        </header>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-24 bg-white border border-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="text-center py-12 bg-white rounded-2xl border border-red-100 p-8 space-y-3">
            <p className="text-red-500 font-medium">Error al cargar la agenda</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && agendaItems.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/60 p-8 space-y-3">
            <Calendar className="mx-auto h-12 w-12 text-slate-300 stroke-[1.5]" />
            <p className="text-slate-400 text-sm font-medium">No hay citas ni slots definidos para esta fecha.</p>
          </div>
        )}

        {/* Agenda List */}
        {!isLoading && !isError && agendaItems.length > 0 && (
          <div className="space-y-3">
            {agendaItems.map((item) => {
              const startStr = format(new Date(item.time), 'HH:mm')
              const isAppt = item.type === 'appointment'

              if (isAppt) {
                const appt = item.data as AppointmentOut
                const status = appt.status
                const isConfirmed = status === 'confirmed'

                return (
                  <div
                    key={`appt-${appt.id}`}
                    onClick={() => setDetailId(appt.id)}
                    className="group bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-morad-purple/30 rounded-xl p-4 shadow-sm hover:shadow transition-all duration-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4 cursor-pointer"
                  >
                    <div className="flex items-start gap-4">
                      <div className="bg-morad-purple/10 text-morad-purple rounded-lg p-2.5 flex flex-col items-center justify-center shrink-0">
                        <Clock className="h-4 w-4 mb-0.5" />
                        <span className="text-xs font-bold">{startStr}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-morad-gray text-base group-hover:text-morad-purple transition-colors">
                            {appt.service_type.toUpperCase()}
                          </h3>
                          <span
                            className={cn(
                              'text-xs font-semibold px-2.5 py-0.5 rounded-full border',
                              STATUS_CLASS[status]
                            )}
                          >
                            {STATUS_LABEL[status]}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">
                          {appt.notes ? appt.notes : <span className="text-slate-400 italic">Sin notas adjuntas</span>}
                        </p>
                      </div>
                    </div>

                    {/* Quick action buttons */}
                    {isConfirmed && (
                      <div
                        className="flex gap-2 self-end sm:self-auto"
                        onClick={(e) => e.stopPropagation()} // Prevent opening modal
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => statusMutation.mutate({ id: appt.id, status: 'completed' })}
                          disabled={statusMutation.isPending}
                          className="border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Completada
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => statusMutation.mutate({ id: appt.id, status: 'no_show' })}
                          disabled={statusMutation.isPending}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          No asistió
                        </Button>
                      </div>
                    )}
                  </div>
                )
              } else {
                const slot = item.data as any
                return (
                  <div
                    key={`slot-${slot.id}`}
                    className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-4 flex justify-between items-center gap-4 text-slate-400"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-slate-200 text-slate-500 rounded-lg p-2.5 flex flex-col items-center justify-center shrink-0">
                        <Clock className="h-4 w-4 mb-0.5" />
                        <span className="text-xs font-bold">{startStr}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-400 tracking-wide uppercase text-xs px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-500">
                          Disponible
                        </span>
                        <p className="text-xs text-slate-400 mt-1">Horario libre para reservaciones.</p>
                      </div>
                    </div>
                  </div>
                )
              }
            })}
          </div>
        )}
      </main>

      {/* Appointment Detail & Patient History Modal */}
      <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-morad-gray">Detalles de la Cita</DialogTitle>
            <DialogDescription>Información del paciente e historial clínico.</DialogDescription>
          </DialogHeader>

          {isLoadingDetail ? (
            <div className="py-12 flex justify-center items-center">
              <RefreshCw className="h-8 w-8 text-morad-purple animate-spin" />
            </div>
          ) : detail ? (
            <div className="space-y-6">
              {/* Contact Card */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Paciente</h4>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-morad-purple/10 text-morad-purple rounded-full flex items-center justify-center">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-morad-gray text-base">
                      {detail.patient?.first_name} {detail.patient?.last_name}
                    </h3>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="truncate">{detail.patient?.email}</span>
                  </div>
                  {detail.patient?.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>{detail.patient.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Consultation Details */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Servicio Solicitado</h4>
                <p className="font-semibold text-morad-gray text-sm uppercase">{detail.service_type}</p>
                
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-2">Notas de consulta</h4>
                <div className="flex gap-2 bg-slate-50 p-3 rounded-lg border border-slate-150 text-sm text-slate-700 italic">
                  <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <p>{detail.notes ? detail.notes : 'Sin notas ingresadas por el paciente.'}</p>
                </div>
              </div>

              {/* Patient History */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Historial Previo ({detail.patient_history?.length ?? 0})
                </h4>

                {detail.patient_history && detail.patient_history.length > 0 ? (
                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {detail.patient_history.map((hist) => {
                      const hDate = format(new Date(hist.start_time), "d 'de' MMM, yyyy", { locale: es })
                      return (
                        <div
                          key={`hist-${hist.id}`}
                          className="border border-slate-150 rounded-lg p-3 text-xs space-y-1 bg-white hover:bg-slate-50"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-700 uppercase">{hist.service_type}</span>
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                                hist.status === "completed" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                              )}
                            >
                              {STATUS_LABEL[hist.status] || hist.status}
                            </span>
                          </div>
                          <div className="text-slate-400">{hDate}</div>
                          {hist.notes && <p className="text-slate-600 italic mt-1 border-l border-slate-200 pl-2">{hist.notes}</p>}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-50/50 p-4 rounded-xl border border-dashed border-slate-200 text-center">
                    Primer agendamiento del paciente con este terapeuta.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No se pudieron cargar los detalles de la cita.</p>
          )}

          <div className="pt-2 flex justify-end">
            <Button onClick={() => setDetailId(null)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
