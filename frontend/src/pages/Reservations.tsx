import { useState, useEffect } from 'react'
import { Calendar, Clock, User, CheckCircle, AlertCircle, Loader2, RefreshCw, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Toast from '../components/Toast'

type Reservation = {
  id: string
  start_time: string
  end_time: string
  status: string
  memo: string
  line_user_id: string
  customer?: {
    display_name: string
    profile_picture_url: string | null
    real_name: string | null
    furigana: string | null
  }
}

type GoogleCalendar = {
  id: string
  summary: string
  primary?: boolean
  backgroundColor?: string
}

export default function Reservations() {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [isGoogleConnected, setIsGoogleConnected] = useState(false)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  
  // Google Calendar State
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([])
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('')
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetchReservations()
    checkGoogleConnection()
    
    // Handle Google OAuth Callback
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      handleGoogleCallback(code)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const checkGoogleConnection = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: settings } = await supabase
      .from('google_calendar_settings')
      .select('calendar_id')
      .eq('user_id', user.id)
      .maybeSingle()
    
    if (settings) {
      setIsGoogleConnected(true)
      setSelectedCalendarId(settings.calendar_id)
    }
  }

  const handleGoogleConnect = async () => {
    try {
      setCalendarLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })
      
      const { url, error } = await response.json()
      if (error) throw new Error(error)
      
      window.location.href = url
    } catch (error: any) {
      console.error('Google Connect Error:', error)
      setToast({ message: 'Google連携の開始に失敗しました', type: 'error' })
    } finally {
      setCalendarLoading(false)
    }
  }

  const handleGoogleCallback = async (code: string) => {
    try {
      setCalendarLoading(true)
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      })
      
      const result = await response.json()
      if (result.error) throw new Error(result.error)
      
      setIsGoogleConnected(true)
      setToast({ message: 'Googleカレンダーと連携しました', type: 'success' })
      
      // Automatically fetch calendars after connection
      await fetchCalendars()
    } catch (error: any) {
      console.error('Google Callback Error:', error)
      setToast({ message: 'Google連携に失敗しました: ' + error.message, type: 'error' })
    } finally {
      setCalendarLoading(false)
    }
  }

  const fetchCalendars = async () => {
    try {
      setCalendarLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar?action=list_calendars`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })
      
      const result = await response.json()
      if (result.error) throw new Error(result.error)
      
      setCalendars(result.calendars || [])
      
      // If no calendar selected yet, select primary
      if (!selectedCalendarId) {
        const primary = result.calendars.find((c: any) => c.primary)
        if (primary) setSelectedCalendarId(primary.id)
      }
    } catch (error: any) {
      console.error('Fetch Calendars Error:', error)
      setToast({ message: 'カレンダー一覧の取得に失敗しました', type: 'error' })
    } finally {
      setCalendarLoading(false)
    }
  }

  const handleSaveCalendarSettings = async () => {
    try {
      setCalendarLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('google_calendar_settings')
        .update({ calendar_id: selectedCalendarId })
        .eq('user_id', user.id)

      if (error) throw error

      setToast({ message: 'カレンダー設定を保存しました', type: 'success' })
    } catch (error: any) {
      console.error('Save Settings Error:', error)
      setToast({ message: '設定の保存に失敗しました', type: 'error' })
    } finally {
      setCalendarLoading(false)
    }
  }

  const fetchReservations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get Store ID
      const { data: stores } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
      
      const storeId = stores?.[0]?.id
      if (!storeId) return

      // Fetch Reservations
      const { data: resData, error: resError } = await supabase
        .from('reservations')
        .select('*')
        .eq('store_id', storeId)
        .order('start_time', { ascending: true })

      if (resError) throw resError

      if (resData) {
        // Fetch Customers for these reservations
        const userIds = Array.from(new Set(resData.map(r => r.line_user_id).filter(Boolean)))
        
        const { data: customers, error: custError } = await supabase
          .from('customers')
          .select('line_user_id, display_name, profile_picture_url, real_name, furigana')
          .eq('store_id', storeId)
          .in('line_user_id', userIds)

        if (custError) throw custError

        // Merge data
        const merged = resData.map(r => ({
          ...r,
          customer: customers?.find(c => c.line_user_id === r.line_user_id)
        }))
        setReservations(merged)
      }
    } catch (error) {
      console.error('Error fetching reservations:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">予約確認</h1>
        <div className="flex gap-4 w-full sm:w-auto">
          <div className="bg-gray-100 p-1 rounded-lg flex flex-1 sm:flex-none">
            <button 
              onClick={() => setViewMode('list')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              リスト
            </button>
            <button 
              onClick={() => {
                setViewMode('calendar')
                if (isGoogleConnected && !calendars.length) fetchCalendars()
              }}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition ${viewMode === 'calendar' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              カレンダー
            </button>
          </div>
          <button className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 shadow-sm whitespace-nowrap">+ 予約登録</button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">予約一覧</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {loading ? (
                <div className="p-8 text-center text-gray-500">読み込み中...</div>
            ) : reservations.length === 0 ? (
                <div className="p-8 text-center text-gray-500">予約はありません</div>
            ) : (
                reservations.map((reservation) => {
                    const startDate = new Date(reservation.start_time)
                    const month = startDate.getMonth() + 1
                    const day = startDate.getDate()
                    const startTime = startDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                    const endTime = new Date(reservation.end_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

                    return (
                      <div key={reservation.id} className="p-4 sm:p-6 hover:bg-gray-50 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start sm:items-center gap-4 sm:gap-6 w-full">
                          <div className="flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-primary-50 rounded-lg text-primary-700 shrink-0">
                            <span className="text-[10px] sm:text-xs font-bold uppercase">{month}月</span>
                            <span className="text-lg sm:text-xl font-bold">{day}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <div className="flex items-center gap-1 text-gray-900 font-bold">
                                <Clock size={16} className="text-gray-400" />
                                <span>{startTime} - {endTime}</span>
                              </div>
                              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                reservation.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                reservation.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {reservation.status === 'confirmed' ? '確定' : 
                                 reservation.status === 'cancelled' ? 'キャンセル' : '承認待ち'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                {/* LINE Icon / Profile Picture */}
                                <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                                    {reservation.customer?.profile_picture_url ? (
                                        <img src={reservation.customer.profile_picture_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={16} className="text-gray-400" />
                                    )}
                                </div>
                                
                                {/* Name Display */}
                                <div className="flex flex-col">
                                    {reservation.customer?.real_name ? (
                                        <>
                                            <span className="text-sm font-bold text-gray-900 leading-tight">
                                                {reservation.customer.real_name} <span className="text-xs font-normal text-gray-500 ml-1">様</span>
                                            </span>
                                            {reservation.customer.furigana && (
                                                <span className="text-[10px] text-gray-500 leading-tight">{reservation.customer.furigana}</span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-sm font-bold text-gray-900">
                                            {reservation.customer?.display_name || 'ゲスト'} <span className="text-xs font-normal text-gray-500">様 (LINE名)</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                            {reservation.memo && (
                                <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded inline-block">
                                    {reservation.memo}
                                </p>
                            )}
                          </div>
                        </div>
                        <button className="w-full sm:w-auto text-center text-sm text-gray-500 hover:text-primary-600 border sm:border-none rounded py-2 sm:py-0 mt-2 sm:mt-0">詳細</button>
                      </div>
                    )
                })
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[600px]">
          {!isGoogleConnected ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center relative overflow-hidden">
              {/* Background Decoration */}
              <div className="absolute top-0 left-0 w-full h-full bg-slate-50 -z-10"></div>
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary-100 rounded-full blur-3xl opacity-50"></div>
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-yellow-100 rounded-full blur-3xl opacity-50"></div>

              <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full relative">
                <div className="absolute -top-3 -right-3">
                  <span className="text-xs font-bold px-3 py-1.5 bg-gradient-to-r from-amber-200 to-yellow-400 text-yellow-900 rounded-full shadow-sm flex items-center gap-1">
                    <Lock size={12} /> Proプラン機能
                  </span>
                </div>

                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <Calendar size={40} />
                </div>
                
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Googleカレンダー連携</h2>
                <p className="text-gray-500 mb-8 leading-relaxed text-sm">
                  Googleカレンダーと連携することで、<br/>
                  予約状況を一元管理し、ダブルブッキングを防止。<br/>
                  <span className="text-xs text-gray-400 mt-2 block">※ホットペッパービューティー等の外部システムとも間接的に連携可能です。</span>
                </p>
                
                <button 
                  onClick={handleGoogleConnect}
                  disabled={calendarLoading}
                  className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 px-6 py-4 rounded-xl hover:bg-gray-50 transition font-bold shadow-sm hover:shadow-md group"
                >
                  {calendarLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  )}
                  Googleアカウントでログイン
                </button>
                
                <p className="mt-6 text-[10px] text-gray-400 flex items-center justify-center gap-1">
                  <AlertCircle size={12} />
                  <span>カレンダーの読み取り・書き込み権限が必要です</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Header / Settings Bar */}
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-green-700 font-medium px-3 py-1 bg-green-100 rounded-full text-sm">
                    <CheckCircle size={14} />
                    <span>連携中</span>
                  </div>
                  <span className="text-sm text-gray-500 hidden sm:inline">
                    {selectedCalendarId ? 'カレンダー設定済み' : 'カレンダーを選択してください'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={fetchCalendars}
                    className="text-sm text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-200 rounded-md transition"
                    title="更新"
                  >
                    <RefreshCw size={16} />
                  </button>
                  {/* Settings Toggle could go here */}
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 p-6 overflow-y-auto">
                {!selectedCalendarId ? (
                  // Initial Setup UI (Select Calendar)
                  <div className="max-w-lg mx-auto mt-10">
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
                                onChange={(e) => setSelectedCalendarId(e.target.value)}
                                className="w-5 h-5 text-primary-600 focus:ring-primary-500 border-gray-300"
                              />
                              <div className="flex-1">
                                <div className="font-bold text-gray-900">{cal.summary}</div>
                                {cal.primary && (
                                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded inline-block mt-1">メインカレンダー</span>
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
                          onClick={handleSaveCalendarSettings}
                          disabled={calendarLoading || !selectedCalendarId}
                          className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition shadow-lg shadow-primary-200 disabled:opacity-50 disabled:shadow-none"
                        >
                          {calendarLoading ? '保存中...' : '設定を保存してカレンダーを表示'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  // Calendar View (Placeholder for now)
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-full max-w-4xl h-[600px] bg-white rounded-xl border border-gray-200 shadow-sm p-4 relative">
                      {/* Mock Calendar UI */}
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50 backdrop-blur-sm z-10">
                        <div className="text-center p-8 bg-white rounded-2xl shadow-xl border border-gray-100">
                          <Calendar size={48} className="mx-auto text-primary-300 mb-4" />
                          <h3 className="text-xl font-bold text-gray-800 mb-2">カレンダー表示準備中</h3>
                          <p className="text-gray-500 mb-6">
                            選択されたカレンダーID: <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">{selectedCalendarId}</span><br/>
                            現在、カレンダー表示機能を実装中です。
                          </p>
                          <button 
                            onClick={() => setSelectedCalendarId('')}
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium underline"
                          >
                            カレンダー選択に戻る
                          </button>
                        </div>
                      </div>
                      {/* Background Grid Mock */}
                      <div className="grid grid-cols-7 h-full opacity-20 pointer-events-none">
                        {[...Array(7)].map((_, i) => (
                          <div key={i} className="border-r border-gray-300 h-full"></div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {toast && (
        <Toast
          isVisible={true}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {toast && (
        <Toast
          isVisible={true}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
