import { Calendar, AlertCircle, Loader2 } from 'lucide-react'
import ProBadge from '../../../components/ProBadge'
import type { GoogleCalendar } from '../types'

export interface GoogleCalendarSyncConnectProps {
  calendarLoading: boolean
  isPro: boolean
  onConnect: () => void
}

export function GoogleCalendarSyncConnect({
  calendarLoading,
  isPro,
  onConnect,
}: GoogleCalendarSyncConnectProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-slate-50 -z-10"></div>
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary-100 rounded-full blur-3xl opacity-50"></div>
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-yellow-100 rounded-full blur-3xl opacity-50"></div>

      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full relative">
        {!isPro && (
          <div className="absolute -top-3 -right-3">
            <ProBadge />
          </div>
        )}

        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
          <Calendar size={40} />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-3">Googleカレンダー連携</h2>
        <p className="text-gray-500 mb-8 leading-relaxed text-sm">
          Googleカレンダーと連携することで、
          <br />
          予約状況を一元管理し、ダブルブッキングを防止。
          <br />
          <span className="text-xs text-gray-400 mt-2 block">
            ※ホットペッパービューティー等の外部システムとも間接的に連携可能です。
          </span>
        </p>

        <button
          onClick={onConnect}
          disabled={calendarLoading || !isPro}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 px-6 py-4 rounded-xl hover:bg-gray-50 transition font-bold shadow-sm hover:shadow-md group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {calendarLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <img
              src="https://www.google.com/favicon.ico"
              alt="Google"
              className="w-5 h-5 group-hover:scale-110 transition-transform"
            />
          )}
          Googleアカウントでログイン
        </button>

        <p className="mt-6 text-[10px] text-gray-400 flex items-center justify-center gap-1">
          <AlertCircle size={12} />
          <span>カレンダーの読み取り・書き込み権限が必要です</span>
        </p>
      </div>
    </div>
  )
}

export interface GoogleCalendarSyncSelectProps {
  calendars: GoogleCalendar[]
  selectedCalendarId: string
  onSelectedCalendarIdChange: (id: string) => void
  calendarLoading: boolean
  onSave: () => void
}

export function GoogleCalendarSyncSelect({
  calendars,
  selectedCalendarId,
  onSelectedCalendarIdChange,
  calendarLoading,
  onSave,
}: GoogleCalendarSyncSelectProps) {
  return (
    <div className="max-w-lg mx-auto mt-10 p-6 overflow-y-auto">
      <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">予約管理に使用するカレンダー</h3>
      <p className="text-sm text-gray-500 mb-6 text-center">
        LINEからの予約を登録し、空き状況を確認するカレンダーを選択してください。
      </p>

      {calendars.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-gray-400" />
          カレンダー一覧を取得中...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2 max-h-96 overflow-y-auto border rounded-xl p-2 bg-white shadow-sm">
            {calendars.map((cal) => (
              <label
                key={cal.id}
                className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer border transition-all ${
                  selectedCalendarId === cal.id
                    ? 'bg-primary-50 border-primary-200 shadow-sm ring-1 ring-primary-100'
                    : 'hover:bg-gray-50 border-transparent'
                }`}
              >
                <input
                  type="radio"
                  name="calendar"
                  value={cal.id}
                  checked={selectedCalendarId === cal.id}
                  onChange={(e) => onSelectedCalendarIdChange(e.target.value)}
                  className="w-5 h-5 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <div className="flex-1">
                  <div className="font-bold text-gray-900">{cal.summary}</div>
                  {cal.primary && (
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded inline-block mt-1">
                      メインカレンダー
                    </span>
                  )}
                </div>
                <div
                  className="w-4 h-4 rounded-full border border-gray-100 shadow-sm"
                  style={{ backgroundColor: cal.backgroundColor || '#ccc' }}
                />
              </label>
            ))}
          </div>
          <button
            onClick={onSave}
            disabled={calendarLoading || !selectedCalendarId}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition shadow-lg shadow-primary-200 disabled:opacity-50 disabled:shadow-none"
          >
            {calendarLoading ? '保存中...' : '設定を保存してカレンダーを表示'}
          </button>
        </div>
      )}
    </div>
  )
}
