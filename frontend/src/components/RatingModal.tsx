import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Star } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { submitRating, type AppointmentOut } from '@/api/appointments'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/utils'

const ratingSchema = z.object({
  comment: z.string().max(500, 'Máximo 500 caracteres').optional(),
})

type RatingFormValues = z.infer<typeof ratingSchema>

interface RatingModalProps {
  appointment: AppointmentOut | null
  onClose: () => void
}

export default function RatingModal({ appointment, onClose }: RatingModalProps) {
  const queryClient = useQueryClient()
  const isOpen = !!appointment
  const [stars, setStars] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<RatingFormValues>({ resolver: zodResolver(ratingSchema) })

  const { mutate, isPending } = useMutation({
    mutationFn: (data: RatingFormValues) =>
      submitRating({
        appointment_id: appointment!.id,
        stars,
        comment: data.comment || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast({ title: 'Calificación enviada', description: '¡Gracias por tu opinión!' })
      setSubmitted(true)
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      toast({
        title: 'No se pudo enviar la calificación',
        description: detail ?? 'Ocurrió un error, intenta de nuevo.',
        variant: 'destructive',
      })
    },
  })

  function handleClose() {
    reset()
    setStars(0)
    setHovered(0)
    setSubmitted(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Calificar cita</DialogTitle>
          <DialogDescription>
            {appointment?.service_type} — tu opinión nos ayuda a mejorar.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-morad-turquoise font-medium">¡Calificación enviada!</p>
            <Button onClick={handleClose}>Cerrar</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit((data) => mutate(data))} className="space-y-5">
            {/* Star selector */}
            <div className="space-y-1">
              <p className="text-sm text-morad-gray font-medium">Puntuación *</p>
              <div
                role="radiogroup"
                aria-label="Puntuación de 1 a 5 estrellas"
                className="flex gap-1"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={stars === n}
                    aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
                    onClick={() => setStars(n)}
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(0)}
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-morad-purple rounded"
                  >
                    <Star
                      className={cn(
                        'h-8 w-8 transition-colors',
                        n <= (hovered || stars)
                          ? 'fill-morad-purple text-morad-purple'
                          : 'text-morad-gray/30',
                      )}
                    />
                  </button>
                ))}
              </div>
              {stars === 0 && (
                <p className="text-xs text-morad-gray/50">Selecciona una puntuación</p>
              )}
            </div>

            {/* Comment */}
            <div className="space-y-1">
              <label
                htmlFor="rating-comment"
                className="text-sm text-morad-gray font-medium"
              >
                Comentario (opcional)
              </label>
              <textarea
                id="rating-comment"
                rows={3}
                maxLength={500}
                placeholder="¿Cómo fue tu experiencia?"
                className={cn(
                  'w-full rounded-md border border-morad-gray/30 px-3 py-2 text-sm text-morad-gray',
                  'placeholder:text-morad-gray/40 focus:outline-none focus:ring-2 focus:ring-morad-turquoise resize-none',
                  errors.comment && 'border-red-400',
                )}
                {...register('comment')}
              />
              {errors.comment && (
                <p className="text-xs text-red-500">{errors.comment.message}</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={stars === 0 || isPending}
                className="bg-morad-purple hover:bg-morad-purple/90 text-white"
              >
                {isPending ? 'Enviando...' : 'Enviar calificación'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
