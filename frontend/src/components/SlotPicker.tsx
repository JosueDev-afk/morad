import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, isBefore, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { fetchSlots, fetchTherapists, type SlotOut } from '@/api/slots'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SlotPickerProps {
  onSelect: (slot: SlotOut) => void
  selectedSlotId?: string
  /** When true the component is disabled (e.g. inside a submitting form) */
  disabled?: boolean
}

export default function SlotPicker({
  onSelect,
  selectedSlotId,
  disabled,
}: SlotPickerProps) {
  const today = startOfDay(new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [therapistId, setTherapistId] = useState<string>('')

  const { data: therapists = [] } = useQuery({
    queryKey: ['therapists'],
    queryFn: fetchTherapists,
  })

  const dateStr = format(selectedDate, 'yyyy-MM-dd')

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['slots', dateStr, therapistId],
    queryFn: () =>
      fetchSlots({
        date: dateStr,
        therapist_id: therapistId || undefined,
      }),
  })

  function handleDaySelect(day: Date | undefined) {
    if (!day) return
    if (isBefore(startOfDay(day), today)) return // req 2.4
    setSelectedDate(day)
  }

  return (
    <div className="space-y-4">
      {/* Therapist filter */}
      <div className="space-y-1">
        <label className="text-sm text-morad-gray font-medium">
          Terapeuta (opcional)
        </label>
        <select
          className="w-full border border-morad-gray/30 rounded-md px-3 py-2 text-sm text-morad-gray bg-white focus:outline-none focus:ring-2 focus:ring-morad-turquoise"
          value={therapistId}
          onChange={(e) => setTherapistId(e.target.value)}
          disabled={disabled}
        >
          <option value="">Todos los terapeutas</option>
          {therapists.map((t) => (
            <option key={t.id} value={t.id}>
              {t.first_name} {t.last_name}
              {t.specialty ? ` — ${t.specialty}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Calendar */}
      <div className="flex justify-center border border-morad-gray/20 rounded-lg p-2">
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={handleDaySelect}
          locale={es}
          disabled={{ before: today }}
          classNames={{
            selected: 'bg-morad-turquoise text-white rounded-full',
            today: 'font-bold text-morad-turquoise',
            disabled: 'opacity-30 cursor-not-allowed',
          }}
        />
      </div>

      {/* Slot list */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-morad-gray">
          Horarios para {format(selectedDate, "d 'de' MMMM", { locale: es })}
        </p>

        {isLoading && (
          <p className="text-sm text-morad-gray/60">Cargando horarios...</p>
        )}

        {!isLoading && slots.length === 0 && (
          <p className="text-sm text-morad-gray/60">
            No hay horarios disponibles para esta fecha.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {slots.map((slot) => {
            const start = format(new Date(slot.start_time), 'HH:mm')
            const end = format(new Date(slot.end_time), 'HH:mm')
            const isSelected = slot.id === selectedSlotId
            return (
              <Button
                key={slot.id}
                type="button"
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                disabled={disabled}
                className={cn(
                  'text-xs',
                  isSelected && 'ring-2 ring-morad-turquoise ring-offset-1',
                )}
                onClick={() => onSelect(slot)}
              >
                {start} – {end}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
