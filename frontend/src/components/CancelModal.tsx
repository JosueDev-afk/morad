import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  cancelAppointment,
  getCancellationFeePreview,
  type AppointmentOut,
} from '@/api/appointments'
import { toast } from '@/store/toastStore'

interface CancelModalProps {
  appointment: AppointmentOut | null
  onClose: () => void
}

export default function CancelModal({ appointment, onClose }: CancelModalProps) {
  const queryClient = useQueryClient()
  const isOpen = !!appointment

  const { data: feeData, isLoading: feeLoading } = useQuery({
    queryKey: ['cancellation-fee', appointment?.id],
    queryFn: () => getCancellationFeePreview(appointment!.id),
    enabled: isOpen,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: () => cancelAppointment(appointment!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast({ title: 'Cita cancelada' })
      onClose()
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      toast({
        title: 'No se pudo cancelar',
        description: detail ?? 'Ocurrió un error, intenta de nuevo.',
        variant: 'destructive',
      })
    },
  })

  const fee = feeData?.cancellation_fee_pct ?? null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar cita</DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {feeLoading ? (
            <p className="text-sm text-morad-gray/60">
              Calculando tarifa de cancelación...
            </p>
          ) : (
            <div className="rounded-lg border border-morad-gray/20 p-4 space-y-2">
              <p className="text-sm text-morad-gray">
                Tarifa de cancelación aplicable:
              </p>
              <p
                className={`text-2xl font-bold ${
                  fee === 0
                    ? 'text-morad-turquoise'
                    : fee === 50
                    ? 'text-yellow-500'
                    : 'text-red-500'
                }`}
              >
                {fee}%
              </p>
              {fee === 0 && (
                <p className="text-xs text-morad-gray/60">
                  Sin cargo (cortesía o más de 24 h de anticipación).
                </p>
              )}
              {fee === 50 && (
                <p className="text-xs text-morad-gray/60">
                  Cancelación entre 6 y 24 h antes de la cita.
                </p>
              )}
              {fee === 100 && (
                <p className="text-xs text-morad-gray/60">
                  Cancelación con menos de 6 h de anticipación.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose} disabled={isPending}>
              Volver
            </Button>
            <Button
              variant="destructive"
              onClick={() => mutate()}
              disabled={isPending || feeLoading}
            >
              {isPending ? 'Cancelando...' : 'Confirmar cancelación'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
