import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, Clock } from 'lucide-react'
import type { AppointmentOut } from '@/api/appointments'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STATUS_LABEL: Record<AppointmentOut['status'], string> = {
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
}

const STATUS_CLASS: Record<AppointmentOut['status'], string> = {
  confirmed: 'bg-morad-turquoise/10 text-morad-turquoise',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-500',
  no_show: 'bg-gray-100 text-morad-gray/60',
}

interface AppointmentCardProps {
  appointment: AppointmentOut
  /** ISO string from the linked slot */
  slotStart?: string
  slotEnd?: string
  hasRating?: boolean
  onCancel: (appt: AppointmentOut) => void
  onReschedule: (appt: AppointmentOut) => void
  onRate: (appt: AppointmentOut) => void
}

export default function AppointmentCard({
  appointment,
  slotStart,
  slotEnd,
  hasRating,
  onCancel,
  onReschedule,
  onRate,
}: AppointmentCardProps) {
  const { status, service_type, notes, cancellation_fee_pct } = appointment

  const canCancel = status === 'confirmed'
  const canReschedule = status === 'confirmed'
  const canRate = status === 'completed' && !hasRating

  return (
    <article className="border border-morad-gray/20 rounded-lg p-4 space-y-3 bg-white">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-medium text-morad-gray text-sm">{service_type}</p>
          {slotStart && (
            <div className="flex items-center gap-1 text-xs text-morad-gray/70">
              <Calendar className="h-3 w-3" />
              <span>
                {format(new Date(slotStart), "d 'de' MMMM yyyy", {
                  locale: es,
                })}
              </span>
              <Clock className="h-3 w-3 ml-1" />
              <span>
                {format(new Date(slotStart), 'HH:mm')}
                {slotEnd ? ` – ${format(new Date(slotEnd), 'HH:mm')}` : ''}
              </span>
            </div>
          )}
        </div>
        <span
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
            STATUS_CLASS[status],
          )}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      {notes && (
        <p className="text-xs text-morad-gray/60 italic border-l-2 border-morad-gray/20 pl-2">
          {notes}
        </p>
      )}

      {status === 'cancelled' && cancellation_fee_pct > 0 && (
        <p className="text-xs text-red-500">
          Tarifa de cancelación aplicada: {cancellation_fee_pct}%
        </p>
      )}

      {/* Actions */}
      {(canCancel || canReschedule || canRate) && (
        <div className="flex gap-2 flex-wrap pt-1">
          {canReschedule && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReschedule(appointment)}
            >
              Reprogramar
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => onCancel(appointment)}
            >
              Cancelar
            </Button>
          )}
          {canRate && (
            <Button
              size="sm"
              variant="outline"
              className="border-morad-purple text-morad-purple hover:bg-morad-purple/5"
              onClick={() => onRate(appointment)}
            >
              Calificar
            </Button>
          )}
        </div>
      )}
    </article>
  )
}
