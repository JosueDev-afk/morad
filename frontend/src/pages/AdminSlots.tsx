import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  isSameDay,
} from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { fetchTherapists, fetchSlots, createSlot, updateSlot, deleteSlot, type TherapistOut } from '@/api/slots'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/utils'

const slotSchema = z
  .object({
    therapist_id: z.string().min(1, 'El terapeuta es requerido'),
    date: z.string().min(1, 'La fecha es requerida'),
    start_time: z.string().min(1, 'La hora de inicio es requerida'),
    end_time: z.string().min(1, 'La hora de fin es requerida'),
  })
  .refine(
    (data) => {
      const start = new Date(`${data.date}T${data.start_time}`)
      const end = new Date(`${data.date}T${data.end_time}`)
      return end > start
    },
    {
      message: 'La hora de fin debe ser posterior a la de inicio',
      path: ['end_time'],
    },
  )

type SlotFormValues = z.infer<typeof slotSchema>

export default function AdminSlots() {
  const queryClient = useQueryClient()
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [view, setView] = useState<'week' | 'month'>('week')

  // Fetch therapists
  const { data: therapists = [] } = useQuery<TherapistOut[]>({
    queryKey: ['therapists'],
    queryFn: fetchTherapists,
  })

  useEffect(() => {
    if (therapists.length > 0 && !selectedTherapistId) {
      setSelectedTherapistId(therapists[0].id)
    }
  }, [therapists, selectedTherapistId])

  // Date range depending on view
  const startRange =
    view === 'week'
      ? startOfWeek(currentDate, { weekStartsOn: 1 })
      : startOfMonth(currentDate)
  const endRange =
    view === 'week'
      ? endOfWeek(currentDate, { weekStartsOn: 1 })
      : endOfMonth(currentDate)

  // Fetch slots for this therapist
  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['admin-slots', selectedTherapistId],
    queryFn: () =>
      fetchSlots({
        therapist_id: selectedTherapistId || undefined,
      }),
    enabled: !!selectedTherapistId,
  })

  // Filter slots within the visible date range
  const visibleSlots = slots.filter((slot) => {
    const start = new Date(slot.start_time)
    return start >= startRange && start <= endRange
  })

  // React Hook Form for slot creation
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
  } = useForm<SlotFormValues>({
    resolver: zodResolver(slotSchema),
    defaultValues: {
      therapist_id: selectedTherapistId,
      date: format(new Date(), 'yyyy-MM-dd'),
      start_time: '09:00',
      end_time: '10:00',
    },
  })

  // Sync therapist_id value when selectedTherapistId changes
  useEffect(() => {
    setValue('therapist_id', selectedTherapistId)
  }, [selectedTherapistId, setValue])

  const onInvalidSubmit = (errs: any) => {
    const messages = Object.values(errs).map((e: any) => e.message).filter(Boolean)
    if (messages.length > 0) {
      toast({
        title: 'Error de validación',
        description: messages.join('. '),
        variant: 'destructive',
      })
    }
  }

  // CRUD Mutations
  const createMutation = useMutation({
    mutationFn: (data: SlotFormValues) => {
      const start_time = new Date(`${data.date}T${data.start_time}:00`).toISOString()
      const end_time = new Date(`${data.date}T${data.end_time}:00`).toISOString()
      return createSlot({
        therapist_id: data.therapist_id,
        start_time,
        end_time,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-slots'] })
      toast({ title: 'Slot creado', description: 'El bloque de disponibilidad ha sido registrado.' })
      reset({
        therapist_id: selectedTherapistId,
        date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '09:00',
        end_time: '10:00',
      })
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail ?? 'No se pudo crear el slot.'
      toast({ title: 'Error de creación', description: detail, variant: 'destructive' })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updateSlot(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-slots'] })
      toast({ title: 'Slot actualizado', description: 'El estado del bloque ha sido modificado.' })
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail ?? 'No se pudo actualizar el slot.'
      toast({ title: 'Error', description: detail, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSlot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-slots'] })
      toast({ title: 'Slot eliminado', description: 'El bloque ha sido removido de la agenda.' })
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail ?? 'No se pudo eliminar el slot.'
      toast({ title: 'Error de eliminación', description: detail, variant: 'destructive' })
    },
  })

  // Date Navigation
  const handlePrev = () => {
    setCurrentDate((prev) => (view === 'week' ? addDays(prev, -7) : addDays(prev, -30)))
  }

  const handleNext = () => {
    setCurrentDate((prev) => (view === 'week' ? addDays(prev, 7) : addDays(prev, 30)))
  }

  // Week view columns generation
  const weekDays = []
  let day = startRange
  while (day <= endRange) {
    weekDays.push(day)
    day = addDays(day, 1)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-morad-gray">Gestión de Horarios</h1>
          <p className="text-sm text-morad-gray/60">Configura la disponibilidad de los fisioterapeutas.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white border border-slate-200 rounded-lg p-1">
            <button
              onClick={() => setView('week')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                view === 'week' ? 'bg-morad-purple text-white shadow' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              Semana
            </button>
            <button
              onClick={() => setView('month')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                view === 'month' ? 'bg-morad-purple text-white shadow' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              Mes
            </button>
          </div>

          <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden">
            <Button variant="ghost" size="sm" onClick={handlePrev} className="h-9 px-2 hover:bg-slate-50">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-bold text-slate-700 px-3 min-w-32 text-center uppercase">
              {view === 'week'
                ? `Sem del ${format(startRange, 'dd MMM', { locale: es })}`
                : format(currentDate, 'MMMM yyyy', { locale: es })}
            </span>
            <Button variant="ghost" size="sm" onClick={handleNext} className="h-9 px-2 hover:bg-slate-50">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Creation Form & Therapist Selector */}
        <div className="lg:col-span-1 space-y-6">
          {/* Selector */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Terapeuta</label>
            <select
              value={selectedTherapistId}
              onChange={(e) => setSelectedTherapistId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-morad-gray bg-white focus:outline-none focus:ring-2 focus:ring-morad-purple"
            >
              <option value="">Selecciona terapeuta...</option>
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Form */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-morad-gray text-base flex items-center gap-1.5">
              <Plus className="text-morad-turquoise h-5 w-5" />
              Nuevo Horario
            </h3>

            <form onSubmit={handleSubmit((d) => createMutation.mutate(d), onInvalidSubmit)} className="space-y-4">
              <input type="hidden" value={selectedTherapistId} {...register('therapist_id')} />

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Fecha</label>
                <Input type="date" {...register('date')} />
                {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Inicio</label>
                  <Input type="time" {...register('start_time')} />
                  {errors.start_time && (
                    <p className="text-xs text-red-500">{errors.start_time.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Fin</label>
                  <Input type="time" {...register('end_time')} />
                  {errors.end_time && (
                    <p className="text-xs text-red-500">{errors.end_time.message}</p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !selectedTherapistId}
                className="w-full bg-morad-purple hover:bg-morad-purple/90 text-white"
              >
                Crear Bloque
              </Button>
            </form>
          </div>
        </div>

        {/* Slots Schedule View */}
        <div className="lg:col-span-3">
          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-16 flex justify-center items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-morad-purple" />
            </div>
          ) : view === 'week' ? (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              {weekDays.map((day) => {
                const daySlots = visibleSlots.filter((slot) =>
                  isSameDay(new Date(slot.start_time), day),
                )
                daySlots.sort(
                  (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
                )

                return (
                  <div
                    key={day.toISOString()}
                    className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm min-h-64 flex flex-col space-y-3"
                  >
                    <div className="border-b border-slate-100 pb-2 text-center">
                      <p className="text-xs font-bold text-morad-purple uppercase">
                        {format(day, 'eee', { locale: es })}
                      </p>
                      <p className="text-lg font-bold text-morad-gray">{format(day, 'd')}</p>
                    </div>

                    <div className="flex-1 space-y-2 overflow-y-auto max-h-96 pr-0.5">
                      {daySlots.map((slot) => {
                        const start = format(new Date(slot.start_time), 'HH:mm')
                        const end = format(new Date(slot.end_time), 'HH:mm')

                        return (
                          <div
                            key={slot.id}
                            className={cn(
                              'border border-slate-100 rounded-lg p-2 flex flex-col gap-1 transition-all group relative',
                              slot.is_active ? 'bg-slate-50' : 'bg-slate-100/50 opacity-60',
                            )}
                          >
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-3 w-3" />
                                {start} – {end}
                              </span>
                            </div>

                            <div className="flex justify-end gap-1 pt-1 border-t border-slate-200/40 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() =>
                                  toggleMutation.mutate({ id: slot.id, is_active: !slot.is_active })
                                }
                                className="text-slate-400 hover:text-morad-purple p-0.5"
                                title={slot.is_active ? 'Desactivar' : 'Activar'}
                              >
                                {slot.is_active ? (
                                  <Eye className="h-3.5 w-3.5" />
                                ) : (
                                  <EyeOff className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => deleteMutation.mutate(slot.id)}
                                className="text-slate-400 hover:text-red-500 p-0.5"
                                title="Eliminar"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}

                      {daySlots.length === 0 && (
                        <p className="text-[10px] text-slate-400 text-center py-6 italic">Sin slots</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            // Monthly view: simple sorted list of all slots
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="font-semibold text-morad-gray text-base">Slots de Disponibilidad</h3>

              {visibleSlots.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-2">
                  {visibleSlots.map((slot) => {
                    const start = new Date(slot.start_time)
                    const dateFmt = format(start, "d 'de' MMMM", { locale: es })
                    const startStr = format(start, 'HH:mm')
                    const endStr = format(new Date(slot.end_time), 'HH:mm')

                    return (
                      <div
                        key={slot.id}
                        className={cn(
                          'border border-slate-200 rounded-xl p-3 flex justify-between items-center bg-slate-50/50 hover:bg-slate-50 transition-colors group',
                          !slot.is_active && 'opacity-65 bg-slate-100',
                        )}
                      >
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-morad-gray">{dateFmt}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {startStr} – {endStr}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              toggleMutation.mutate({ id: slot.id, is_active: !slot.is_active })
                            }
                            className="h-8 w-8 text-slate-500 hover:text-morad-purple"
                          >
                            {slot.is_active ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(slot.id)}
                            className="h-8 w-8 text-slate-500 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic text-center py-12">
                  No hay bloques configurados para este mes.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
