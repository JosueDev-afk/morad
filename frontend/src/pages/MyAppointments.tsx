import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchAppointments, type AppointmentOut } from '@/api/appointments'
import AppointmentCard from '@/components/AppointmentCard'
import CancelModal from '@/components/CancelModal'
import RescheduleModal from '@/components/RescheduleModal'
import RatingModal from '@/components/RatingModal'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

type FilterStatus = 'all' | 'confirmed' | 'completed' | 'cancelled'

export default function MyAppointments() {
  const [cancelTarget, setCancelTarget] = useState<AppointmentOut | null>(null)
  const [rescheduleTarget, setRescheduleTarget] =
    useState<AppointmentOut | null>(null)
  const [ratingTarget, setRatingTarget] = useState<AppointmentOut | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('all')

  const {
    data: appointments = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['appointments'],
    queryFn: fetchAppointments,
  })

  const filtered =
    filter === 'all'
      ? appointments
      : appointments.filter((a) => a.status === filter)

  // Sort: upcoming confirmed first, then by creation date desc
  const sorted = [...filtered].sort((a, b) => {
    const aStart = a.slot?.start_time ?? a.created_at
    const bStart = b.slot?.start_time ?? b.created_at
    return new Date(bStart).getTime() - new Date(aStart).getTime()
  })

  const FILTERS: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'confirmed', label: 'Confirmadas' },
    { value: 'completed', label: 'Completadas' },
    { value: 'cancelled', label: 'Canceladas' },
  ]

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-morad-gray/20 px-4 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-morad-gray">Mis citas</h1>
        <Button size="sm" asChild>
          <Link to="/book">
            <Plus className="h-4 w-4" />
            Nueva cita
          </Link>
        </Button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Filter tabs */}
        <div
          role="tablist"
          aria-label="Filtrar citas"
          className="flex gap-1 bg-morad-gray/5 rounded-lg p-1"
        >
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={`flex-1 text-xs py-1.5 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-morad-turquoise ${
                filter === value
                  ? 'bg-white shadow text-morad-gray font-medium'
                  : 'text-morad-gray/60 hover:text-morad-gray'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* State: loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-28 rounded-lg bg-morad-gray/10 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* State: error */}
        {isError && (
          <p className="text-sm text-red-500 text-center py-8">
            No se pudieron cargar tus citas. Intenta de nuevo.
          </p>
        )}

        {/* State: empty */}
        {!isLoading && !isError && sorted.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <p className="text-morad-gray/60 text-sm">
              {filter === 'all'
                ? 'Aún no tienes citas.'
                : 'No hay citas con este filtro.'}
            </p>
            {filter === 'all' && (
              <Button size="sm" asChild>
                <Link to="/book">Reservar mi primera cita</Link>
              </Button>
            )}
          </div>
        )}

        {/* Appointment list */}
        {!isLoading && !isError && sorted.length > 0 && (
          <div className="space-y-3">
            {sorted.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appointment={appt}
                slotStart={appt.slot?.start_time}
                slotEnd={appt.slot?.end_time}
                hasRating={appt.has_rating}
                onCancel={setCancelTarget}
                onReschedule={setRescheduleTarget}
                onRate={setRatingTarget}
              />
            ))}
          </div>
        )}
      </main>

      <CancelModal
        appointment={cancelTarget}
        onClose={() => setCancelTarget(null)}
      />
      <RescheduleModal
        appointment={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
      />
      <RatingModal
        appointment={ratingTarget}
        onClose={() => setRatingTarget(null)}
      />
    </div>
  )
}
