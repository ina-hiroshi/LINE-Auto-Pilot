import { CheckCircle, XCircle } from 'lucide-react'
import type { Reservation, GoogleEvent, GoogleCalendar } from '../types'

export type CalendarView = 'month' | 'week' | 'day'

export interface ReservationCalendarProps {
  currentDate: Date
  onCurrentDateChange: (date: Date) => void
  calendarView: CalendarView
  onCalendarViewChange: (view: CalendarView) => void
  calendars: GoogleCalendar[]
  selectedCalendarId: string
  displayHours: { start: number; end: number }
  reservations: Reservation[]
  googleEvents: GoogleEvent[]
  onReservationClick: (reservation: Reservation) => void
  onGoogleEventClick: (event: GoogleEvent) => void
  onDisconnect: () => void
}

function isSameDay(date1: Date, date2: Date) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

export function ReservationCalendar({
  currentDate,
  onCurrentDateChange,
  calendarView,
  onCalendarViewChange,
  calendars,
  selectedCalendarId,
  displayHours,
  reservations,
  googleEvents,
  onReservationClick,
  onGoogleEventClick,
  onDisconnect,
}: ReservationCalendarProps) {
  return (
    <div className="flex flex-col h-[800px] bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header / Settings Bar */}
      <div className="p-4 border-b border-gray-100 flex flex-col gap-4 sticky top-0 z-10 bg-white">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center justify-between w-full sm:w-auto gap-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 whitespace-nowrap">
              {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
            </h2>

            <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
              <button
                onClick={() => {
                  const newDate = new Date(currentDate)
                  if (calendarView === 'month') newDate.setMonth(newDate.getMonth() - 1)
                  else if (calendarView === 'week') newDate.setDate(newDate.getDate() - 7)
                  else newDate.setDate(newDate.getDate() - 1)
                  onCurrentDateChange(newDate)
                }}
                className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition text-gray-600"
              >
                ←
              </button>
              <button
                onClick={() => onCurrentDateChange(new Date())}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium hover:bg-white hover:shadow-sm rounded-md transition text-gray-600"
              >
                今日
              </button>
              <button
                onClick={() => {
                  const newDate = new Date(currentDate)
                  if (calendarView === 'month') newDate.setMonth(newDate.getMonth() + 1)
                  else if (calendarView === 'week') newDate.setDate(newDate.getDate() + 7)
                  else newDate.setDate(newDate.getDate() + 1)
                  onCurrentDateChange(newDate)
                }}
                className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition text-gray-600"
              >
                →
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between w-full sm:w-auto gap-2">
            {selectedCalendarId && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-md border border-gray-200">
                  <div
                    className="w-3 h-3 rounded-full border border-gray-200 shadow-sm"
                    style={{
                      backgroundColor: calendars.find((c) => c.id === selectedCalendarId)?.backgroundColor || '#ccc',
                    }}
                  />
                  <span className="text-xs sm:text-sm font-bold text-gray-700 truncate max-w-[150px] sm:max-w-[200px]">
                    {calendars.find((c) => c.id === selectedCalendarId)?.summary || 'カレンダー'}
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-green-700 font-medium px-3 py-1 bg-green-100 rounded-full text-xs whitespace-nowrap border border-green-200">
                  <CheckCircle size={12} />
                  <span>連携中</span>
                </div>
                <button
                  onClick={onDisconnect}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors shadow-sm"
                  title="連携を解除"
                >
                  <XCircle size={14} />
                  <span>解除</span>
                </button>
              </div>
            )}

            <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
              <button
                onClick={() => onCalendarViewChange('month')}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition ${calendarView === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                月
              </button>
              <button
                onClick={() => onCalendarViewChange('week')}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition ${calendarView === 'week' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                週
              </button>
              <button
                onClick={() => onCalendarViewChange('day')}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition ${calendarView === 'day' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                日
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Calendar Grid */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0">
          {/* Days Header */}
          <div className="overflow-x-auto scrollbar-hide">
            <div className={`flex ${calendarView === 'week' ? 'min-w-[600px]' : ''}`}>
              {(calendarView === 'week' || calendarView === 'day') && (
                <div className="w-10 sm:w-14 flex-shrink-0 bg-gray-50 border-b border-r border-gray-200"></div>
              )}
              <div
                className={`flex-1 grid ${calendarView === 'day' ? 'grid-cols-1' : 'grid-cols-7'} border-b border-gray-200 bg-gray-50 shrink-0`}
              >
                {calendarView === 'day' ? (
                  <div className="py-2 text-center text-xs font-semibold text-gray-700">
                    {currentDate.getDate()}日 ({['日', '月', '火', '水', '木', '金', '土'][currentDate.getDay()]})
                  </div>
                ) : calendarView === 'week' ? (
                  (() => {
                    const days = ['日', '月', '火', '水', '木', '金', '土']
                    const startOfWeek = new Date(currentDate)
                    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
                    return days.map((day, i) => {
                      const d = new Date(startOfWeek)
                      d.setDate(startOfWeek.getDate() + i)
                      return (
                        <div
                          key={day}
                          className={`py-2 text-center text-xs font-semibold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}
                        >
                          {d.getDate()} ({day})
                        </div>
                      )
                    })
                  })()
                ) : (
                  ['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                    <div
                      key={day}
                      className={`py-2 text-center text-xs font-semibold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}
                    >
                      {day}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Calendar Body */}
          {calendarView === 'month' ? (
            <div className="flex-1 grid grid-cols-7 grid-rows-6 divide-x divide-y divide-gray-200 bg-gray-200 gap-px overflow-hidden">
              {(() => {
                const year = currentDate.getFullYear()
                const month = currentDate.getMonth()
                const firstDay = new Date(year, month, 1)
                const lastDay = new Date(year, month + 1, 0)
                const daysInMonth = lastDay.getDate()
                const startingDay = firstDay.getDay()

                const days: { day: number; currentMonth: boolean; date: Date }[] = []

                const prevMonthLastDay = new Date(year, month, 0).getDate()
                for (let i = 0; i < startingDay; i++) {
                  days.push({
                    day: prevMonthLastDay - startingDay + 1 + i,
                    currentMonth: false,
                    date: new Date(year, month - 1, prevMonthLastDay - startingDay + 1 + i),
                  })
                }

                for (let i = 1; i <= daysInMonth; i++) {
                  days.push({ day: i, currentMonth: true, date: new Date(year, month, i) })
                }

                const remainingCells = 42 - days.length
                for (let i = 1; i <= remainingCells; i++) {
                  days.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) })
                }

                const linkedGoogleEventIds = new Set(
                  reservations.filter((r) => r.google_event_id).map((r) => r.google_event_id)
                )

                return days.map((d, idx) => {
                  const dayReservations = reservations.filter((r) => isSameDay(new Date(r.start_time), d.date))
                  const dayGoogleEvents = googleEvents.filter((e) => {
                    if (!e.start.dateTime && !e.start.date) return false
                    if (linkedGoogleEventIds.has(e.id)) return false
                    const start = new Date(e.start.dateTime || e.start.date!)
                    return isSameDay(start, d.date)
                  })

                  const isToday = new Date().toDateString() === d.date.toDateString()

                  return (
                    <div
                      key={idx}
                      className={`bg-white min-h-0 p-1 flex flex-col ${!d.currentMonth ? 'bg-gray-50 text-gray-400' : ''}`}
                    >
                      <div
                        className={`text-xs font-medium mb-1 flex justify-between items-center shrink-0 ${isToday ? 'text-primary-600' : ''}`}
                      >
                        <span
                          className={`w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-primary-100 font-bold' : ''}`}
                        >
                          {d.day}
                        </span>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                        {dayReservations.map((r) => (
                          <div
                            key={r.id}
                            className="text-[10px] bg-primary-50 text-primary-700 p-1 rounded border-l-2 border-primary-500 truncate cursor-pointer hover:opacity-80 flex flex-col gap-0.5 leading-tight"
                            onClick={() => onReservationClick(r)}
                          >
                            <div>
                              <span className="font-bold">
                                {new Date(r.start_time).toLocaleTimeString('ja-JP', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>{' '}
                              <span className="hidden sm:inline">
                                {r.customer?.real_name || r.customer?.display_name || 'ゲスト'}
                              </span>
                            </div>
                            {(r.menu?.name || r.staff?.name) && (
                              <div className="text-[9px] opacity-80 truncate hidden sm:block">
                                {r.menu?.name} {r.staff?.name && `(${r.staff.name})`}
                              </div>
                            )}
                          </div>
                        ))}

                        {dayGoogleEvents.map((e) => (
                          <div
                            key={e.id}
                            className="text-[10px] bg-gray-100 text-gray-600 p-1 rounded border-l-2 border-gray-400 truncate"
                            title={e.summary}
                          >
                            <span className="font-bold">
                              {e.start.dateTime
                                ? new Date(e.start.dateTime).toLocaleTimeString('ja-JP', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '終日'}
                            </span>{' '}
                            <span className="hidden sm:inline">{e.summary}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          ) : (
            /* Week / Day View (Time Grid) */
            <div className="flex-1 overflow-auto relative bg-white">
              <div
                className={`flex ${calendarView === 'week' ? 'min-w-[600px]' : ''}`}
                style={{ minHeight: `${(displayHours.end - displayHours.start) * 60}px` }}
              >
                <div className="w-10 sm:w-14 flex-shrink-0 border-r border-gray-200 bg-gray-50 sticky left-0 z-20">
                  {[...Array(displayHours.end - displayHours.start)].map((_, i) => {
                    const hour = i + displayHours.start
                    return (
                      <div
                        key={hour}
                        className="h-[60px] text-[9px] sm:text-[11px] text-gray-500 text-right pr-0.5 sm:pr-1.5 pt-0.5 border-b border-gray-100 bg-gray-50"
                      >
                        <span className="sm:hidden">{hour}</span>
                        <span className="hidden sm:inline">{hour}:00</span>
                      </div>
                    )
                  })}
                </div>

                <div
                  className={`flex-1 grid ${calendarView === 'day' ? 'grid-cols-1' : 'grid-cols-7'} divide-x divide-gray-200`}
                >
                  {(() => {
                    const days: Date[] = []
                    if (calendarView === 'day') {
                      days.push(currentDate)
                    } else {
                      const startOfWeek = new Date(currentDate)
                      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
                      for (let i = 0; i < 7; i++) {
                        const d = new Date(startOfWeek)
                        d.setDate(startOfWeek.getDate() + i)
                        days.push(d)
                      }
                    }

                    type CalendarItem = {
                      id: string
                      type: 'reservation' | 'google'
                      startMinutes: number
                      endMinutes: number
                      data: Reservation | GoogleEvent
                    }

                    return days.map((d, colIdx) => {
                      const dayReservations = reservations.filter((r) =>
                        isSameDay(new Date(r.start_time), d)
                      )
                      const linkedIds = new Set(
                        reservations.filter((r) => r.google_event_id).map((r) => r.google_event_id)
                      )
                      const dayGoogleEvents = googleEvents.filter((e) => {
                        if (!e.start.dateTime && !e.start.date) return false
                        if (linkedIds.has(e.id)) return false
                        const start = new Date(e.start.dateTime || e.start.date!)
                        return isSameDay(start, d)
                      })

                      const allItems: CalendarItem[] = []

                      dayReservations.forEach((r) => {
                        const start = new Date(r.start_time)
                        const end = new Date(r.end_time)
                        const startMinutes = start.getHours() * 60 + start.getMinutes()
                        const endMinutes = end.getHours() * 60 + end.getMinutes()
                        if (startMinutes >= displayHours.start * 60) {
                          allItems.push({
                            id: r.id,
                            type: 'reservation',
                            startMinutes,
                            endMinutes,
                            data: r,
                          })
                        }
                      })

                      dayGoogleEvents.forEach((e) => {
                        if (!e.start.dateTime) return
                        const start = new Date(e.start.dateTime)
                        const end = e.end.dateTime
                          ? new Date(e.end.dateTime)
                          : new Date(start.getTime() + 60 * 60 * 1000)
                        const startMinutes = start.getHours() * 60 + start.getMinutes()
                        const endMinutes = end.getHours() * 60 + end.getMinutes()
                        if (startMinutes >= displayHours.start * 60) {
                          allItems.push({
                            id: e.id,
                            type: 'google',
                            startMinutes,
                            endMinutes,
                            data: e,
                          })
                        }
                      })

                      allItems.sort((a, b) => a.startMinutes - b.startMinutes)

                      const itemPositions: Map<string, { column: number; totalColumns: number }> =
                        new Map()
                      const isOverlapping = (item1: CalendarItem, item2: CalendarItem) =>
                        item1.startMinutes < item2.endMinutes && item2.startMinutes < item1.endMinutes
                      const processedIds = new Set<string>()

                      allItems.forEach((item, index) => {
                        if (processedIds.has(item.id)) return

                        const group: CalendarItem[] = [item]
                        processedIds.add(item.id)

                        for (let i = index + 1; i < allItems.length; i++) {
                          const nextItem = allItems[i]
                          if (processedIds.has(nextItem.id)) continue
                          const overlapsWithGroup = group.some((g) => isOverlapping(g, nextItem))
                          if (overlapsWithGroup) {
                            group.push(nextItem)
                            processedIds.add(nextItem.id)
                          }
                        }

                        const columns: CalendarItem[][] = []
                        group.forEach((g) => {
                          let placed = false
                          for (let col = 0; col < columns.length; col++) {
                            const canPlace = columns[col].every(
                              (existing) => !isOverlapping(existing, g)
                            )
                            if (canPlace) {
                              columns[col].push(g)
                              itemPositions.set(g.id, { column: col, totalColumns: 0 })
                              placed = true
                              break
                            }
                          }
                          if (!placed) {
                            columns.push([g])
                            itemPositions.set(g.id, {
                              column: columns.length - 1,
                              totalColumns: 0,
                            })
                          }
                        })

                        group.forEach((g) => {
                          const pos = itemPositions.get(g.id)!
                          pos.totalColumns = columns.length
                        })
                      })

                      return (
                        <div key={colIdx} className="relative h-full">
                          {[...Array(displayHours.end - displayHours.start)].map((_, i) => (
                            <div key={i} className="h-[60px] border-b border-gray-100"></div>
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
                                  {duration > 30 && (
                                    <>
                                      {r.menu?.name && (
                                        <div className="truncate text-[10px] opacity-90 mt-0.5">
                                          {r.menu.name}
                                        </div>
                                      )}
                                      {r.staff?.name && (
                                        <div className="truncate text-[10px] opacity-80">
                                          担当: {r.staff.name}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )
                            } else {
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
                            }
                          })}
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
