import { Calendar, Lock } from 'lucide-react'
import type { GoogleCalendarSettings } from '../types'

interface CalendarTabProps {
  googleCalendarSettings: GoogleCalendarSettings
  saving: boolean
  onConnect: () => void
  onDisconnect?: () => void
  isPro: boolean
}

export function CalendarTab({ googleCalendarSettings, saving, onConnect, onDisconnect, isPro }: CalendarTabProps) {
  if (!isPro) {
    return (
      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute inset-0 bg-gray-50/50 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white p-4 rounded-full shadow-sm mb-4">
            <Lock className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Proプラン限定機能</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md">
            Googleカレンダー連携機能を使用するには、Proプランへのアップグレードが必要です。<br />
            予約の自動同期やダブルブッキング防止機能が利用可能になります。
          </p>
          <button className="px-6 py-2.5 bg-gradient-to-r from-gray-800 to-gray-700 text-white rounded-full font-bold text-sm shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5">
            プランをアップグレード
          </button>
        </div>

        <div className="flex items-center gap-2 mb-6 pb-2 border-b opacity-50">
          <Calendar className="text-primary-600" size={24} />
          <h2 className="text-xl font-bold text-gray-800">Googleカレンダー連携</h2>
        </div>

        <div className="space-y-6 opacity-50 pointer-events-none">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h3 className="font-bold text-blue-800 mb-2">機能について</h3>
            <p className="text-sm text-blue-700 leading-relaxed">
              Googleカレンダーと連携すると、以下の機能が利用可能になります：
            </p>
            <ul className="list-disc list-inside text-sm text-blue-700 mt-2 space-y-1">
              <li>LINEからの予約が自動的にGoogleカレンダーに登録されます</li>
              <li>Googleカレンダーの予定（他の予約など）を考慮して、空き枠を計算します</li>
              <li>ダブルブッキングを防止し、予約管理を一元化できます</li>
            </ul>
          </div>

          <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">未連携</h3>
              <p className="text-gray-600 mb-6">
                Googleアカウントにログインして、<br />
                カレンダーへのアクセスを許可してください。
              </p>
              <button
                disabled
                className="px-8 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold shadow-sm flex items-center gap-3 mx-auto opacity-50 cursor-not-allowed"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                Googleでログイン
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-6 pb-2 border-b">
        <Calendar className="text-primary-600" size={24} />
        <h2 className="text-xl font-bold text-gray-800">Googleカレンダー連携</h2>
      </div>

      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <h3 className="font-bold text-blue-800 mb-2">機能について</h3>
          <p className="text-sm text-blue-700 leading-relaxed">
            Googleカレンダーと連携すると、以下の機能が利用可能になります：
          </p>
          <ul className="list-disc list-inside text-sm text-blue-700 mt-2 space-y-1">
            <li>LINEからの予約が自動的にGoogleカレンダーに登録されます</li>
            <li>Googleカレンダーの予定（他の予約など）を考慮して、空き枠を計算します</li>
            <li>ダブルブッキングを防止し、予約管理を一元化できます</li>
          </ul>
        </div>

        <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
          {googleCalendarSettings.connected ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">連携済み</h3>
              <p className="text-gray-600 mb-6">
                Googleカレンダーと正常に連携しています。<br />
                カレンダーID: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{googleCalendarSettings.calendar_id || 'primary'}</span>
              </p>
              <div className="text-xs text-gray-400 mb-6">
                最終更新: {googleCalendarSettings.updated_at ? new Date(googleCalendarSettings.updated_at).toLocaleString() : '不明'}
              </div>
              <button
                onClick={() => {
                  if (onDisconnect) {
                    onDisconnect()
                  }
                }}
                className="px-6 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-bold"
              >
                連携を解除
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">未連携</h3>
              <p className="text-gray-600 mb-6">
                Googleアカウントにログインして、<br />
                カレンダーへのアクセスを許可してください。
              </p>
              <button
                onClick={onConnect}
                disabled={saving}
                className="px-8 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-bold shadow-sm flex items-center gap-3 mx-auto"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                Googleでログイン
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
