import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import SlotPicker from '@/components/SlotPicker'
import type { SlotOut } from '@/api/slots'
import { createAppointment } from '@/api/appointments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/store/toastStore'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const SERVICE_TYPES = [
  'Fisioterapia general',
  'Rehabilitación',
  'Masaje terapéutico',
  'Evaluación inicial',
  'Seguimiento',
]

const schema = z.object({
  service_type: z.string().min(1, 'Selecciona un tipo de servicio'),
  notes: z.string().max(500, 'Máximo 500 caracteres').optional(),
})

type FormValues = z.infer<typeof schema>

export default function BookAppointment() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedSlot, setSelectedSlot] = useState<SlotOut | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const { mutate, isPending } = useMutation({
    mutationFn: (values: FormValues) =>
      createAppointment({
        slot_id: selectedSlot!.id,
        service_type: values.service_type,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast({ title: 'Cita reservada con éxito' })
      navigate('/appointments')
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      toast({
        title: 'No se pudo reservar',
        description:
          detail ?? 'Ocurrió un error, intenta de nuevo.',
        variant: 'destructive',
      })
    },
  })

  function onSubmit(values: FormValues) {
    if (!selectedSlot) {
      toast({
        title: 'Selecciona un horario',
        variant: 'destructive',
      })
      return
    }
    mutate(values)
  }

  return (
    <div className="py-8 max-w-xl mx-auto px-4 space-y-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/appointments')}
          className="text-slate-400 hover:text-morad-purple text-sm flex items-center gap-1 transition-colors"
          aria-label="Volver"
        >
          ← Volver a Mis Citas
        </button>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800 mb-6">Reservar cita</h1>

        <main className="space-y-6">
          {/* Step 1: pick a slot */}
          <section aria-labelledby="pick-slot-heading">
            <h2
              id="pick-slot-heading"
              className="text-sm font-semibold text-slate-500 mb-3"
            >
              1. Elige un horario
            </h2>
            <SlotPicker
              onSelect={setSelectedSlot}
              selectedSlotId={selectedSlot?.id}
              disabled={isPending}
            />
          </section>

          {/* Step 2: confirm details */}
          {selectedSlot && (
            <section aria-labelledby="confirm-heading" className="pt-4 border-t border-slate-100">
              <h2
                id="confirm-heading"
                className="text-sm font-semibold text-slate-500 mb-3"
              >
                2. Confirma los detalles
              </h2>

              <div className="bg-morad-purple/5 border border-morad-purple/10 rounded-xl p-4 mb-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-800 mb-1">Horario seleccionado</p>
                <p className="text-morad-purple font-bold">
                  {format(
                    new Date(selectedSlot.start_time),
                    "EEEE d 'de' MMMM, HH:mm",
                    { locale: es },
                  )}{' '}
                  – {format(new Date(selectedSlot.end_time), 'HH:mm')}
                </p>
              </div>

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-4"
                noValidate
              >
                <div className="space-y-1">
                  <label
                    htmlFor="service_type"
                    className="text-xs font-semibold text-slate-500"
                  >
                    Tipo de servicio
                  </label>
                  <select
                    id="service_type"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-750 bg-white focus:outline-none focus:ring-2 focus:ring-morad-purple"
                    aria-invalid={!!errors.service_type}
                    {...register('service_type')}
                  >
                    <option value="">Selecciona un servicio...</option>
                    {SERVICE_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {errors.service_type && (
                    <p role="alert" className="text-xs text-red-500 mt-1">
                      {errors.service_type.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label htmlFor="notes" className="text-xs font-semibold text-slate-500">
                    Notas (opcional)
                  </label>
                  <Input
                    id="notes"
                    placeholder="Describe tu motivo de consulta..."
                    aria-invalid={!!errors.notes}
                    {...register('notes')}
                  />
                  {errors.notes && (
                    <p role="alert" className="text-xs text-red-500 mt-1">
                      {errors.notes.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full bg-morad-purple hover:bg-morad-purple/90 text-white" disabled={isPending}>
                  {isPending ? 'Reservando...' : 'Confirmar reserva'}
                </Button>
              </form>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
