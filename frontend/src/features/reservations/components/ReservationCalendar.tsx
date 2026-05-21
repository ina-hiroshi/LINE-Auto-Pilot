import { useMemo } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import type { StoreStaff } from '../../../types/storeResources'
import type { Reservation, GoogleEvent, GoogleCalendar } from '../types'
import { TimeGridColumn } from './TimeGridColumn'

export type CalendarView = 'month' | 'week' | 'day'

export interface ReservationCalendarProps {
  currentDate: Date
  onCurrentDateChange: (date: Date) => void
  calendarView: CalendarView
  onCalendarViewChange: (view: CalendarView) => void
  calendars: GoogleCalendar[]
  selectedCalendarId: string
  displayHours: { start: number; end: number }
  staffList: StoreStaff[]
  reservations: Reservation[]
  googleEvents: GoogleEvent[]
  onReservationClick: (reservation: Reservation) => void
  onGoogleEventClick: (event: GoogleEvent) => void
  onDisconnect: () => void
}

const UNASSIGNED_COLUMN = '__unassigned__'
const GOOGLE_COLUMN = '__google__'

type DayStaffColumn = {
  id: string
  label: string
  kind: 'staff' | 'unassigned' | 'google'
}

function isSameDay(date1: Date, date2: Date) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

function buildDayStaffColumns(
  staffList: StoreStaff[],
  dayReservations: Reservation[],
  dayGoogleEvents: GoogleEvent[],
): DayStaffColumn[] {
  const columns: DayStaffColumn[] = staffList.map((s) => ({
    id: s.id,
    label: s.name,
    kind: 'staff',
  }))
  if (dayReservations.some((r) => !r.staff_id)) {
    columns.push({ id: UNASSIGNED_COLUMN, label: '未割当', kind: 'unassigned' })
  }
  if (dayGoogleEvents.length > 0) {
    columns.push({ id: GOOGLE_COLUMN, label: 'Google', kind: 'google' })
  }
  return columns
}

export function ReservationCalendar({
  currentDate,
  onCurrentDateChange,
  calendarView,
  onCalendarViewChange,
  calendars,
  selectedCalendarId,
  displayHours,
  staffList,
  reservations,
  googleEvents,
  onReservationClick,
  onGoogleEventClick,
  onDisconnect,
}: ReservationCalendarProps) {
  const linkedGoogleEventIds = useMemo(
    () =>
      new Set(
        reservations
          .filter((r) => r.google_event_id)
          .map((r) => r.google_event_id as string),
      ),
    [reservations],
  )

  const dayViewData = useMemo(() => {
    if (calendarView !== 'day') return null
    const dayReservations = reservations.filter((r) =>
      isSameDay(new Date(r.start_time), currentDate),
    )
    const dayGoogleEvents = googleEvents.filter((e) => {
      if (!e.start.dateTime && !e.start.date) return false
      if (linkedGoogleEventIds.has(e.id)) return false
      const start = new Date(e.start.dateTime || e.start.date!)
      return isSameDay(start, currentDate)
    })
    const weekday = ['日', '月', '火', '水', '木', '金', '土'][currentDate.getDay()]
    const columns: DayStaffColumn[] =
      staffList.length > 0
        ? buildDayStaffColumns(staffList, dayReservations, dayGoogleEvents)
        : [
            {
              id: '__single__',
              label: `${currentDate.getDate()}日 (${weekday})`,
              kind: 'staff',
            },
          ]
    return { dayReservations, dayGoogleEvents, columns }
  }, [calendarView, currentDate, reservations, googleEvents, linkedGoogleEventIds, staffList])

  const weekDays = useMemo(() => {
    if (calendarView !== 'week') return []
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      return d
    })
  }, [calendarView, currentDate])

  const timeAxis = (
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
  )

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
            <div
              className={`flex ${calendarView === 'week' ? 'min-w-[600px]' : ''} ${calendarView === 'day' && dayViewData && dayViewData.columns.length > 1 ? 'min-w-max' : ''}`}
            >
              {(calendarView === 'week' || calendarView === 'day') && (
                <div className="w-10 sm:w-14 flex-shrink-0 bg-gray-50 border-b border-r border-gray-200">
                  {calendarView === 'day' && dayViewData && staffList.length > 0 && (
                    <div className="py-2 px-0.5 text-center text-[10px] font-semibold text-gray-600 leading-tight">
                      {currentDate.getMonth() + 1}/{currentDate.getDate()}
                    </div>
                  )}
                </div>
              )}
              <div
                className={`flex-1 ${calendarView === 'day' && dayViewData && staffList.length > 0 ? 'flex min-w-0' : `grid ${calendarView === 'day' ? 'grid-cols-1' : 'grid-cols-7'}`} border-b border-gray-200 bg-gray-50 shrink-0`}
              >
                {calendarView === 'day' && dayViewData ? (
                  dayViewData.columns.map((col) => (
                    <div
                      key={col.id}
                      className={`min-w-[100px] flex-1 py-2 px-1 text-center text-xs font-semibold text-gray-700 border-r border-gray-200 last:border-r-0 truncate ${staffList.length === 0 ? '' : ''}`}
                      title={col.label}
                    >
                      {col.label}
                    </div>
                  ))
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
                className={`flex ${calendarView === 'week' ? 'min-w-[600px]' : ''} ${calendarView === 'day' && dayViewData && staffList.length > 0 ? 'min-w-max' : ''}`}
                style={{ minHeight: `${(displayHours.end - displayHours.start) * 60}px` }}
              >
                {timeAxis}
                {calendarView === 'day' && dayViewData ? (
                  <div className="flex flex-1 min-w-0">
                    {dayViewData.columns.map((col) => {
                      let colReservations = dayViewData.dayReservations
                      let colGoogle = dayViewData.dayGoogleEvents
                      let includeGoogle = false

                      if (staffList.length > 0) {
                        if (col.kind === 'google') {
                          colReservations = []
                          includeGoogle = true
                        } else if (col.kind === 'unassigned') {
                          colReservations = dayViewData.dayReservations.filter((r) => !r.staff_id)
                          colGoogle = []
                        } else if (col.id !== '__single__') {
                          colReservations = dayViewData.dayReservations.filter(
                            (r) => r.staff_id === col.id,
                          )
                          colGoogle = []
                        } else {
                          includeGoogle = true
                        }
                      } else {
                        includeGoogle = true
                      }

                      return (
                        <TimeGridColumn
                          key={col.id}
                          dayReservations={colReservations}
                          dayGoogleEvents={colGoogle}
                          displayHours={displayHours}
                          includeGoogleEvents={includeGoogle}
                          onReservationClick={onReservationClick}
                          onGoogleEventClick={onGoogleEventClick}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex-1 grid grid-cols-7 divide-x divide-gray-200">
                    {weekDays.map((d) => {
                      const dayReservations = reservations.filter((r) =>
                        isSameDay(new Date(r.start_time), d),
                      )
                      const dayGoogleEvents = googleEvents.filter((e) => {
                        if (!e.start.dateTime && !e.start.date) return false
                        if (linkedGoogleEventIds.has(e.id)) return false
                        const start = new Date(e.start.dateTime || e.start.date!)
                        return isSameDay(start, d)
                      })
                      return (
                        <TimeGridColumn
                          key={d.toISOString()}
                          dayReservations={dayReservations}
                          dayGoogleEvents={dayGoogleEvents}
                          displayHours={displayHours}
                          includeGoogleEvents={true}
                          onReservationClick={onReservationClick}
                          onGoogleEventClick={onGoogleEventClick}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
