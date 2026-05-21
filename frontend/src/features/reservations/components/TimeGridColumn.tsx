import type { Reservation, GoogleEvent } from '../types'
import { buildCalendarGridItems, computeOverlapPositions } from '../lib/calendarTimeGrid'

type TimeGridColumnProps = {
  dayReservations: Reservation[]
  dayGoogleEvents: GoogleEvent[]
  displayHours: { start: number; end: number }
  includeGoogleEvents: boolean
  onReservationClick: (reservation: Reservation) => void
  onGoogleEventClick: (event: GoogleEvent) => void
}

export function TimeGridColumn({
  dayReservations,
  dayGoogleEvents,
  displayHours,
  includeGoogleEvents,
  onReservationClick,
  onGoogleEventClick,
}: TimeGridColumnProps) {
  const allItems = buildCalendarGridItems(
    dayReservations,
    dayGoogleEvents,
    displayHours,
    includeGoogleEvents,
  )
  const itemPositions = computeOverlapPositions(allItems)
  const rowCount = displayHours.end - displayHours.start

  return (
    <div className="relative h-full w-full min-w-[100px] flex-1 border-r border-gray-200 last:border-r-0">
      {[...Array(rowCount)].map((_, i) => (
        <div key={i} className="h-[60px] border-b border-gray-100" />
      ))}

      {allItems.map((item) => {
        const pos = itemPositions.get(item.id)
        if (!pos) return null

        const top = item.startMinutes - displayHours.start * 60
        const duration = item.endMinutes - item.startMinutes
        const width = 100 / pos.totalColumns
        const left = pos.column * width

        if (item.type === 'reservation') {
          const r = item.data as Reservation
          const start = new Date(r.start_time)
          return (
            <div
              key={r.id}
              className="absolute bg-primary-100 border-l-4 border-primary-500 text-primary-800 text-xs p-1 rounded overflow-hidden cursor-pointer hover:opacity-90 z-10 flex flex-col"
              style={{
                top: `${top}px`,
                height: `${Math.max(duration, 20)}px`,
                left: `calc(${left}% + 2px)`,
                width: `calc(${width}% - 4px)`,
              }}
              onClick={() => onReservationClick(r)}
            >
              <div className="flex items-center gap-1 font-bold text-[10px] leading-tight">
                <span>
                  {start.toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="truncate">
                  {r.customer?.real_name || r.customer?.display_name || 'ゲスト'}
                </span>
              </div>
              {duration > 30 && r.menu?.name && (
                <div className="truncate text-[10px] opacity-90 mt-0.5">{r.menu.name}</div>
              )}
            </div>
          )
        }

        const e = item.data as GoogleEvent
        const start = new Date(e.start.dateTime!)
        return (
          <div
            key={e.id}
            className="absolute bg-gray-100 border-l-4 border-gray-400 text-gray-600 text-xs p-1 rounded overflow-hidden cursor-pointer hover:bg-gray-200 transition z-0"
            style={{
              top: `${top}px`,
              height: `${Math.max(duration, 20)}px`,
              left: `calc(${left}% + 2px)`,
              width: `calc(${width}% - 4px)`,
            }}
            onClick={() => onGoogleEventClick(e)}
          >
            <div className="font-bold text-[10px]">
              {start.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div className="truncate text-[10px]">{e.summary}</div>
          </div>
        )
      })}
    </div>
  )
}
