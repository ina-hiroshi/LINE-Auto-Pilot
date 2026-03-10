import { Clock, User, Edit2, XCircle } from 'lucide-react'
import type { Reservation } from '../types'

export type ListFilter = 'today' | 'week' | 'month' | 'all'

export interface ReservationListProps {
  reservations: Reservation[]
  listFilter: ListFilter
  onListFilterChange: (filter: ListFilter) => void
  loading: boolean
  onReservationClick: (reservation: Reservation) => void
  onCancelClick: (reservation: Reservation) => void
}

export function ReservationList({
  reservations,
  listFilter,
  onListFilterChange,
  loading,
  onReservationClick,
  onCancelClick,
}: ReservationListProps) {
  const filtered = reservations.filter((r) => {
    if (listFilter === 'all') return true
    const d = new Date(r.start_time)
    const now = new Date()
    if (listFilter === 'today') return d.toDateString() === now.toDateString()
    if (listFilter === 'week') {
      const start = new Date(now)
      start.setDate(now.getDate() - now.getDay())
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(start.getDate() + 7)
      return d >= start && d < end
    }
    if (listFilter === 'month')
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    return true
  })

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h2 className="font-bold text-gray-800">予約一覧</h2>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onListFilterChange('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${listFilter === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            全期間
          </button>
          <button
            onClick={() => onListFilterChange('month')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${listFilter === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            今月
          </button>
          <button
            onClick={() => onListFilterChange('week')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${listFilter === 'week' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            今週
          </button>
          <button
            onClick={() => onListFilterChange('today')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${listFilter === 'today' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            今日
          </button>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-500">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">予約はありません</div>
        ) : (
          filtered.map((reservation) => {
            const startDate = new Date(reservation.start_time)
            const month = startDate.getMonth() + 1
            const day = startDate.getDate()
            const dayOfWeek = startDate.toLocaleDateString('ja-JP', { weekday: 'short' })
            const startTime = startDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
            const endTime = new Date(reservation.end_time).toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={reservation.id}
                className="p-2 hover:bg-gray-50 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 cursor-pointer"
                onClick={() => onReservationClick(reservation)}
              >
                <div className="flex items-start sm:items-center gap-2 w-full">
                  <div className="flex flex-col items-center justify-center w-14 h-14 bg-primary-50 rounded-lg text-primary-700 shrink-0">
                    <span className="text-[10px] font-bold uppercase leading-none">{month}月</span>
                    <span className="text-xl font-bold leading-none my-0.5">{day}</span>
                    <span className="text-[10px] font-bold leading-none">({dayOfWeek})</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <div className="flex items-center gap-1 text-gray-900 font-bold text-sm">
                        <Clock size={12} className="text-gray-400" />
                        <span>{startTime} - {endTime}</span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 text-[10px] rounded-full font-medium ${
                          reservation.status === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : reservation.registration_type === 'manual'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {reservation.status === 'cancelled'
                          ? 'キャンセル'
                          : reservation.registration_type === 'manual'
                            ? '手動登録'
                            : 'LINE予約'}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {reservation.customer?.profile_picture_url ? (
                            <>
                              <img
                                src={reservation.customer.profile_picture_url}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                  const icon = e.currentTarget.nextElementSibling
                                  if (icon) icon.classList.remove('hidden')
                                }}
                              />
                              <User size={18} className="text-gray-400 hidden" />
                            </>
                          ) : (
                            <User size={18} className="text-gray-400" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          {reservation.customer?.real_name ? (
                            <div className="flex items-baseline gap-1 flex-wrap">
                              <span className="text-base font-bold text-gray-900 leading-tight whitespace-nowrap">
                                {reservation.customer.real_name}
                              </span>
                              {reservation.customer.furigana && (
                                <span className="text-xs text-gray-500 leading-tight whitespace-nowrap">
                                  ({reservation.customer.furigana})
                                </span>
                              )}
                              <span className="text-sm font-normal text-gray-500">様</span>
                            </div>
                          ) : (
                            <span className="text-base font-bold text-gray-900">
                              {reservation.customer?.display_name || 'ゲスト'}{' '}
                              <span className="text-sm font-normal text-gray-500">様 (LINE名)</span>
                            </span>
                          )}
                        </div>
                      </div>
                      {(reservation.staff?.name || reservation.menu?.name) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 sm:ml-2 sm:border-l sm:pl-3 sm:border-gray-200 pl-12 sm:pl-3">
                          {reservation.staff?.name && (
                            <span className="text-xs whitespace-nowrap">
                              担当: <span className="font-medium text-gray-800">{reservation.staff.name}</span>
                            </span>
                          )}
                          {reservation.menu?.name && (
                            <span className="text-xs">
                              メニュー:{' '}
                              <span className="font-medium text-gray-800">
                                {reservation.menu.name}{' '}
                                {reservation.menu.price ? `(¥${reservation.menu.price.toLocaleString()})` : ''}
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-row gap-2 w-full sm:w-auto mt-1 sm:mt-0 justify-end sm:justify-start">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onReservationClick(reservation)
                    }}
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition"
                    title="詳細・変更"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onCancelClick(reservation)
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition"
                    title="キャンセル"
                  >
                    <XCircle size={18} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
