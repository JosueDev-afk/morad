import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import SlotPicker from '@/components/SlotPicker'
import type { SlotOut } from '@/api/slots'
import {
  rescheduleAppointment,
  type AppointmentOut,
} from '@/api/appointments'
import { toast } from '@/store/toastStore'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface RescheduleModalProps {
  appointment: AppointmentOut | null
  onClose: () => void
}

export default function RescheduleModal({
  appointment,
  onClose,
}: RescheduleModalProps) {
  const queryClient = useQueryClient()
  const isOpen = !!appointment
  const [newSlot, setNewSlot] = useState<SlotOut | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      rescheduleAppointment(appointment!.id, {
        new_slot_id: newSlot!.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast({ title: 'Cita reprogramada con éxito' })
      setNewSlot(null)
      onClose()
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      toast({
        title: 'No se pudo reprogramar',
        description: detail ?? 'Ocurrió un error, intenta de nuevo.',
        variant: 'destructive',
      })
    },
  })

  function handleConfirm() {
    if (!newSlot) {
      toast({ title: 'Selecciona un nuevo horario', variant: 'destructive' })
      return
    }
    mutate()
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setNewSlot(null)
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reprogramar cita</DialogTitle>
          <DialogDescription>
            Selecciona el nuevo horario para tu cita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <SlotPicker
            onSelect={setNewSlot}
            selectedSlotId={newSlot?.id}
            disabled={isPending}
          />

          {newSlot && (
            <div className="rounded-lg bg-morad-turquoise/10 p-3 text-sm text-morad-gray">
              <p className="font-medium">Nuevo horario:</p>
              <p className="text-morad-turquoise font-semibold">
                {format(
                  new Date(newSlot.start_time),
                  "EEEE d 'de' MMMM, HH:mm",
                  { locale: es },
                )}{' '}
                – {format(new Date(newSlot.end_time), 'HH:mm')}
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setNewSlot(null)
                onClose()
              }}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!newSlot || isPending}
            >
              {isPending ? 'Reprogramando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
