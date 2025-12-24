import { useState } from 'react'
import { Calendar, Clock, User, Settings, CheckCircle, AlertCircle } from 'lucide-react'

export default function Reservations() {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [isGoogleConnected, setIsGoogleConnected] = useState(false) // TODO: Fetch from DB

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">予約確認</h1>
        <div className="flex gap-4">
          <div className="bg-gray-100 p-1 rounded-lg flex">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              リスト
            </button>
            <button 
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${viewMode === 'calendar' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              カレンダー
            </button>
          </div>
          <button className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 shadow-sm">+ 予約登録</button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">本日の予約</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-6 hover:bg-gray-50 transition flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center justify-center w-16 h-16 bg-primary-50 rounded-lg text-primary-700">
                    <span className="text-xs font-bold uppercase">12月</span>
                    <span className="text-xl font-bold">24</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock size={16} className="text-gray-400" />
                      <span className="font-bold text-gray-900">14:00 - 15:00</span>
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">確定</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <User size={16} className="text-gray-400" />
                      <span>田中 太郎 様</span>
                      <span className="text-gray-300">|</span>
                      <span className="text-sm">カット + カラー</span>
                    </div>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-primary-600">詳細</button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-150">
          {!isGoogleConnected ? (
            <div className="flex flex-col items-center justify-center h-150 p-8 text-center">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
                <Calendar size={40} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Googleカレンダーと連携</h2>
              <p className="text-gray-500 max-w-lg mb-8 leading-relaxed">
                Googleカレンダーと連携することで、ホットペッパービューティーなどの外部予約システムと予約状況を一元管理できます。
              </p>
              <button 
                onClick={() => setIsGoogleConnected(true)}
                className="flex items-center gap-3 bg-white border border-gray-300 text-gray-700 px-8 py-4 rounded-xl hover:bg-gray-50 transition font-bold shadow-sm hover:shadow-md"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
                Googleアカウントでログイン
              </button>
              <p className="mt-6 text-xs text-gray-400 flex items-center gap-1">
                <AlertCircle size={12} />
                <span>カレンダーの読み取り・書き込み権限が必要です</span>
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-2 text-green-700 font-medium px-3 py-1 bg-green-100 rounded-full text-sm">
                  <CheckCircle size={14} />
                  <span>Googleカレンダー連携中</span>
                </div>
                <button 
                  onClick={() => setIsGoogleConnected(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 px-3 py-1 hover:bg-gray-200 rounded-md transition"
                >
                  <Settings size={14} />
                  連携解除
                </button>
              </div>
              <div className="flex-1 bg-white p-4">
                {/* Google Calendar Embed Placeholder */}
                <div className="w-full h-full bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center">
                  <div className="text-center">
                    <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-400 font-medium">ここにGoogleカレンダーが表示されます</p>
                    <p className="text-sm text-gray-300 mt-2">src="https://calendar.google.com/..."</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
