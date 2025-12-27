import { useState, useEffect, useCallback } from 'react'
import { Calendar, Clock, User, CheckCircle, AlertCircle, Loader2, RefreshCw, Lock, Edit2, XCircle, FileText, MessageSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStoreResources } from '../hooks/useStoreResources'
import type { StoreMenu, StoreStaff } from '../types/storeResources'
import Toast from '../components/Toast'
import Modal from '../components/Modal'

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
  staff?: {
    name: string
  }
  menu?: {
    name: string
    price?: number | null
  }
  staff_id?: string
  menu_id?: string
}

type GoogleCalendar = {
  id: string
  summary: string
  primary?: boolean
  backgroundColor?: string
}

type GoogleEvent = {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  htmlLink: string
}

const toErrorMessage = (error: unknown): string => {
	if (error instanceof Error) return error.message
	if (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
		return (error as { message: string }).message
	}
	return String(error)
}

export default function Reservations() {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [isGoogleConnected, setIsGoogleConnected] = useState(false)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const { staffList, menuList } = useStoreResources(storeId)
  
  // Google Calendar State
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([])
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('')
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('day')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [modifyDate, setModifyDate] = useState('')
  const [modifyTime, setModifyTime] = useState('')
  const [modifyStaffId, setModifyStaffId] = useState<string>('')
  const [modifyMenuId, setModifyMenuId] = useState<string>('')
  const [modifyMemo, setModifyMemo] = useState<string>('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchCalendars = useCallback(async () => {
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

      const calendarsResult: GoogleCalendar[] = result.calendars || []
      setCalendars(calendarsResult)
      
      if (!selectedCalendarId) {
        const primary = calendarsResult.find((c) => c.primary)
        if (primary) setSelectedCalendarId(primary.id)
      }
    } catch (error) {
      console.error('Fetch Calendars Error:', error)
      setToast({ message: 'カレンダー一覧の取得に失敗しました', type: 'error' })
    } finally {
      setCalendarLoading(false)
    }
  }, [selectedCalendarId])

  const checkGoogleConnection = useCallback(async () => {
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
      await fetchCalendars()
    }
  }, [fetchCalendars])

  const handleGoogleConnect = async () => {
    try {
      setCalendarLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const redirectUri = window.location.origin + '/reservations'
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth?redirect_uri=${encodeURIComponent(redirectUri)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })
      
      const { url, error } = await response.json()
      if (error) throw new Error(error)
      
      window.location.href = url
    } catch (error) {
      console.error('Google Connect Error:', error)
      setToast({ message: 'Google連携の開始に失敗しました', type: 'error' })
    } finally {
      setCalendarLoading(false)
    }
  }

  const handleGoogleCallback = useCallback(async (code: string) => {
    try {
      setCalendarLoading(true)
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const redirectUri = window.location.origin + '/reservations'

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code, redirect_uri: redirectUri })
      })
      
      const result = await response.json()
      if (result.error) throw new Error(result.error)
      
      setIsGoogleConnected(true)
      setToast({ message: 'Googleカレンダーと連携しました', type: 'success' })
      
      await fetchCalendars()
    } catch (error) {
      console.error('Google Callback Error:', error)
      setToast({ message: `Google連携に失敗しました: ${toErrorMessage(error)}`, type: 'error' })
    } finally {
      setCalendarLoading(false)
    }
  }, [fetchCalendars])

  const fetchGoogleEvents = useCallback(async () => {
    if (!isGoogleConnected || !selectedCalendarId || viewMode !== 'calendar') return
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      let startDate = new Date(currentDate)
      let endDate = new Date(currentDate)

      if (calendarView === 'month') {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        
        startDate = new Date(firstDay)
        startDate.setDate(startDate.getDate() - startDate.getDay())
        
        endDate = new Date(lastDay)
        endDate.setDate(endDate.getDate() + (6 - endDate.getDay()))
      } else if (calendarView === 'week') {
        const day = currentDate.getDay()
        const diff = currentDate.getDate() - day
        startDate = new Date(currentDate)
        startDate.setDate(diff)
        
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 6)
      } else {
        startDate = new Date(currentDate)
        endDate = new Date(currentDate)
      }
      
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)

      const timeMin = startDate.toISOString()
      const timeMax = endDate.toISOString()

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar?action=list_events&calendar_id=${encodeURIComponent(selectedCalendarId)}&timeMin=${timeMin}&timeMax=${timeMax}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })
      
      const result = await response.json()
      if (result.error) throw new Error(result.error)
      
      setGoogleEvents(result.events || [])
    } catch (error) {
      console.error('Fetch Google Events Error:', error)
    }
  }, [calendarView, currentDate, isGoogleConnected, selectedCalendarId, viewMode])

  useEffect(() => {
    fetchGoogleEvents()
  }, [fetchGoogleEvents])

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
    } catch (error) {
      console.error('Save Settings Error:', error)
      setToast({ message: `設定の保存に失敗しました: ${toErrorMessage(error)}`, type: 'error' })
    } finally {
      setCalendarLoading(false)
    }
  }

  const fetchReservations = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get Store ID
      const { data: stores } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
      
      const currentStoreId = stores?.[0]?.id
      if (!currentStoreId) return
      setStoreId(currentStoreId)

      // Fetch Reservations
      const { data: resDataRaw, error: resError } = await supabase
        .from('reservations')
        .select('*, staff:staff_members(name), menu:booking_menus(name, price)')
        .eq('store_id', currentStoreId)
        .neq('status', 'cancelled') // キャンセル済みを除外
        .order('start_time', { ascending: true })

      if (resError) throw resError

      const resData = (resDataRaw ?? []) as Reservation[]
      if (resData.length > 0) {
        // Fetch Customers for these reservations
        const userIds = Array.from(new Set(resData.map((r: Reservation) => r.line_user_id).filter(Boolean)))
        
        const { data: customers, error: custError } = await supabase
          .from('customers')
          .select('line_user_id, display_name, profile_picture_url, real_name, furigana')
          .eq('store_id', currentStoreId)
          .in('line_user_id', userIds)

        if (custError) throw custError

        // Merge data
        const merged = resData.map((r: Reservation) => ({
          ...r,
          customer: customers?.find((c: { line_user_id: string }) => c.line_user_id === r.line_user_id)
        }))
        setReservations(merged)
      }
    } catch (error) {
      console.error('Error fetching reservations:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReservations()
    checkGoogleConnection()

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      handleGoogleCallback(code)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [checkGoogleConnection, fetchReservations, handleGoogleCallback])

  // Realtime Subscription
  useEffect(() => {
    if (!storeId) return

    const channel = supabase
      .channel('reservations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `store_id=eq.${storeId}`
        },
        () => {
          fetchReservations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchReservations, storeId])

  const handleCancelReservation = async () => {
    if (!selectedReservation) return
    setActionLoading(true)
    try {
      const { error } = await supabase.functions.invoke('booking', {
        body: {
          action: 'cancel_reservation',
          reservation_id: selectedReservation.id
        }
      })
      if (error) throw error
      setToast({ message: '予約をキャンセルしました', type: 'success' })
      setIsCancelModalOpen(false)
      fetchReservations()
    } catch (error) {
      console.error('Cancel Error:', error)
      setToast({ message: `キャンセルに失敗しました: ${toErrorMessage(error)}`, type: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleModifyReservation = async () => {
    if (!selectedReservation || !modifyDate || !modifyTime) return
    setActionLoading(true)
    try {
      const { error } = await supabase.functions.invoke('booking', {
        body: {
          action: 'update_reservation',
          reservation_id: selectedReservation.id,
          store_id: storeId,
          line_user_id: selectedReservation.line_user_id,
          real_name: selectedReservation.customer?.real_name,
          furigana: selectedReservation.customer?.furigana,
          date: modifyDate,
          time: modifyTime,
          staff_id: modifyStaffId || null,
          menu_id: modifyMenuId || null,
          memo: modifyMemo
        }
      })
      if (error) throw error
      setToast({ message: '予約を変更しました', type: 'success' })
      setIsModifyModalOpen(false)
      fetchReservations()
    } catch (error) {
      console.error('Modify Error:', error)
      setToast({ message: `変更に失敗しました: ${toErrorMessage(error)}`, type: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const openDetailModal = (reservation: Reservation) => {
    setSelectedReservation(reservation)
    setIsDetailModalOpen(true)
  }

  const openModifyModal = (reservation: Reservation) => {
    setSelectedReservation(reservation)
    setIsDetailModalOpen(false) // Close detail modal if open
    const d = new Date(reservation.start_time)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    
    setModifyDate(`${year}-${month}-${day}`)
    setModifyTime(`${hour}:${minute}`)
    setModifyStaffId(reservation.staff_id || '')
    setModifyMenuId(reservation.menu_id || '')
    setModifyMemo(reservation.memo || '')
    setIsModifyModalOpen(true)
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
                    const dayOfWeek = startDate.toLocaleDateString('ja-JP', { weekday: 'short' })
                    const startTime = startDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                    const endTime = new Date(reservation.end_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

                    return (
                      <div key={reservation.id} 
                           className="p-2 hover:bg-gray-50 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 cursor-pointer"
                           onClick={() => openDetailModal(reservation)}
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
                              <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-medium ${
                                reservation.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {reservation.status === 'cancelled' ? 'キャンセル' : 'LINE予約'}
                              </span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                                <div className="flex items-center gap-3">
                                    {/* Profile Picture */}
                                    <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                                        {reservation.customer?.profile_picture_url ? (
                                            <>
                                              <img 
                                                src={reservation.customer.profile_picture_url} 
                                                alt="" 
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                  e.currentTarget.style.display = 'none';
                                                  // Show the sibling icon
                                                  const icon = e.currentTarget.nextElementSibling;
                                                  if (icon) icon.classList.remove('hidden');
                                                }}
                                              />
                                              <User size={18} className="text-gray-400 hidden" />
                                            </>
                                        ) : (
                                            <User size={18} className="text-gray-400" />
                                        )}
                                    </div>
                                    
                                    {/* Name Display */}
                                    <div className="flex flex-col min-w-0">
                                        {reservation.customer?.real_name ? (
                                            <div className="flex items-baseline gap-1 flex-wrap">
                                                <span className="text-base font-bold text-gray-900 leading-tight whitespace-nowrap">
                                                    {reservation.customer.real_name}
                                                </span>
                                                {reservation.customer.furigana && (
                                                    <span className="text-xs text-gray-500 leading-tight whitespace-nowrap">({reservation.customer.furigana})</span>
                                                )}
                                                <span className="text-sm font-normal text-gray-500">様</span>
                                            </div>
                                        ) : (
                                            <span className="text-base font-bold text-gray-900">
                                                {reservation.customer?.display_name || 'ゲスト'} <span className="text-sm font-normal text-gray-500">様 (LINE名)</span>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Staff and Menu Display */}
                                {(reservation.staff?.name || reservation.menu?.name) && (
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 sm:ml-2 sm:border-l sm:pl-3 sm:border-gray-200 pl-12 sm:pl-3">
                                        {reservation.staff?.name && (
                                            <span className="text-xs whitespace-nowrap">担当: <span className="font-medium text-gray-800">{reservation.staff.name}</span></span>
                                        )}
                                        {reservation.menu?.name && (
                                          <span className="text-xs">メニュー: <span className="font-medium text-gray-800">{reservation.menu.name} {reservation.menu.price ? `(¥${reservation.menu.price.toLocaleString()})` : ''}</span></span>
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
                              openDetailModal(reservation)
                            }}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition"
                            title="詳細・変更"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedReservation(reservation)
                              setIsCancelModalOpen(true)
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
                          setCurrentDate(newDate)
                        }}
                        className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition text-gray-600"
                      >
                        ←
                      </button>
                      <button 
                        onClick={() => setCurrentDate(new Date())}
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
                          setCurrentDate(newDate)
                        }}
                        className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition text-gray-600"
                      >
                        →
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                    <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
                      <button 
                        onClick={() => setCalendarView('month')}
                        className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition ${calendarView === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        月
                      </button>
                      <button 
                        onClick={() => setCalendarView('week')}
                        className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition ${calendarView === 'week' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        週
                      </button>
                      <button 
                        onClick={() => setCalendarView('day')}
                        className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition ${calendarView === 'day' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        日
                      </button>
                    </div>

                    <div className="flex items-center gap-2 ml-auto sm:ml-0">
                      <div className="hidden sm:flex items-center gap-2 text-green-700 font-medium px-3 py-1 bg-green-100 rounded-full text-xs whitespace-nowrap">
                        <CheckCircle size={12} />
                        <span>連携中</span>
                      </div>
                      
                      <button 
                        onClick={() => {
                          fetchCalendars()
                          fetchGoogleEvents()
                        }}
                        className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition"
                        title="更新"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mobile Calendar Selector (Collapsible or simplified) */}
                {selectedCalendarId && (
                  <div className="flex items-center gap-2 w-full">
                    <select
                      value={selectedCalendarId}
                      onChange={(e) => setSelectedCalendarId(e.target.value)}
                      className="flex-1 text-sm border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5"
                    >
                      {calendars.map(cal => (
                        <option key={cal.id} value={cal.id}>{cal.summary}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleSaveCalendarSettings}
                      disabled={calendarLoading}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap px-2"
                      title="選択したカレンダーをデフォルトとして保存します"
                    >
                      保存
                    </button>
                  </div>
                )}
              </div>

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {!selectedCalendarId ? (
                  // Initial Setup UI (Select Calendar)
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
                  // Calendar Grid View
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Days Header */}
                    <div className="overflow-x-auto scrollbar-hide">
                      <div className={`grid ${calendarView === 'day' ? 'grid-cols-1' : 'grid-cols-7'} border-b border-gray-200 bg-gray-50 shrink-0 ${calendarView === 'week' ? 'min-w-[700px]' : ''}`}>
                        {(() => {
                          if (calendarView === 'day') {
                            const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][currentDate.getDay()]
                            return (
                              <div className="py-2 text-center text-xs font-semibold text-gray-700">
                                {currentDate.getDate()}日 ({dayOfWeek})
                              </div>
                            )
                          }
                          
                          // Week or Month view header
                          const days = ['日', '月', '火', '水', '木', '金', '土']
                          if (calendarView === 'week') {
                            const startOfWeek = new Date(currentDate)
                            startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
                            return days.map((day, i) => {
                              const d = new Date(startOfWeek)
                              d.setDate(startOfWeek.getDate() + i)
                              return (
                                <div key={day} className={`py-2 text-center text-xs font-semibold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                                  {d.getDate()} ({day})
                                </div>
                              )
                            })
                          }
                          
                          return days.map((day, i) => (
                            <div key={day} className={`py-2 text-center text-xs font-semibold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                              {day}
                            </div>
                          ))
                        })()}
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
                          const startingDay = firstDay.getDay() // 0 = Sunday
                          
                          const days = []
                          
                          // Previous month padding
                          const prevMonthLastDay = new Date(year, month, 0).getDate()
                          for (let i = 0; i < startingDay; i++) {
                            days.push({ day: prevMonthLastDay - startingDay + 1 + i, currentMonth: false, date: new Date(year, month - 1, prevMonthLastDay - startingDay + 1 + i) })
                          }
                          
                          // Current month
                          for (let i = 1; i <= daysInMonth; i++) {
                            days.push({ day: i, currentMonth: true, date: new Date(year, month, i) })
                          }
                          
                          // Next month padding
                          const remainingCells = 42 - days.length // 6 rows * 7 cols
                          for (let i = 1; i <= remainingCells; i++) {
                            days.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) })
                          }

                          return days.map((d, idx) => {
                            // Helper to check if dates are on the same day (Local Time)
                            const isSameDay = (date1: Date, date2: Date) => {
                              return date1.getFullYear() === date2.getFullYear() &&
                                     date1.getMonth() === date2.getMonth() &&
                                     date1.getDate() === date2.getDate()
                            }

                            // Filter Reservations
                            const dayReservations = reservations.filter(r => isSameDay(new Date(r.start_time), d.date))
                            
                            // Filter Google Events
                            const dayGoogleEvents = googleEvents.filter(e => {
                              if (!e.start.dateTime && !e.start.date) return false
                              const start = new Date(e.start.dateTime || e.start.date!)
                              return isSameDay(start, d.date)
                            })

                            const isToday = new Date().toDateString() === d.date.toDateString()

                            return (
                              <div key={idx} className={`bg-white min-h-0 p-1 flex flex-col ${!d.currentMonth ? 'bg-gray-50 text-gray-400' : ''}`}>
                                <div className={`text-xs font-medium mb-1 flex justify-between items-center shrink-0 ${isToday ? 'text-primary-600' : ''}`}>
                                  <span className={`w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-primary-100 font-bold' : ''}`}>
                                    {d.day}
                                  </span>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                                  {/* App Reservations */}
                                  {dayReservations.map(r => (
                                    <div key={r.id} className="text-[10px] bg-primary-50 text-primary-700 p-1 rounded border-l-2 border-primary-500 truncate cursor-pointer hover:opacity-80 flex flex-col gap-0.5 leading-tight"
                                         onClick={() => openDetailModal(r)}>
                                      <div>
                                        <span className="font-bold">{new Date(r.start_time).toLocaleTimeString('ja-JP', {hour: '2-digit', minute:'2-digit'})}</span>
                                        {' '}
                                        <span className="hidden sm:inline">{r.customer?.real_name || r.customer?.display_name || 'ゲスト'}</span>
                                      </div>
                                      {(r.menu?.name || r.staff?.name) && (
                                        <div className="text-[9px] opacity-80 truncate hidden sm:block">
                                          {r.menu?.name} {r.staff?.name && `(${r.staff.name})`}
                                        </div>
                                      )}
                                    </div>
                                  ))}

                                  {/* Google Events */}
                                  {dayGoogleEvents.map(e => (
                                    <div key={e.id} className="text-[10px] bg-gray-100 text-gray-600 p-1 rounded border-l-2 border-gray-400 truncate" title={e.summary}>
                                      <span className="font-bold">
                                        {e.start.dateTime 
                                          ? new Date(e.start.dateTime).toLocaleTimeString('ja-JP', {hour: '2-digit', minute:'2-digit'})
                                          : '終日'}
                                      </span>
                                      {' '}
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
                      // Week / Day View (Time Grid)
                      <div className="flex-1 overflow-y-auto relative bg-white overflow-x-auto">
                        <div className={`flex min-h-[1440px] ${calendarView === 'week' ? 'min-w-[700px]' : ''}`}> {/* 24 hours * 60px */}
                          {/* Time Labels */}
                          <div className="w-12 flex-shrink-0 border-r border-gray-200 bg-gray-50 sticky left-0 z-20">
                            {[...Array(24)].map((_, i) => (
                              <div key={i} className="h-[60px] text-[10px] text-gray-500 text-right pr-2 pt-1 border-b border-gray-100 bg-gray-50">
                                {i}:00
                              </div>
                            ))}
                          </div>

                          {/* Grid Columns */}
                          <div className={`flex-1 grid ${calendarView === 'day' ? 'grid-cols-1' : 'grid-cols-7'} divide-x divide-gray-200`}>
                            {(() => {
                              const days = []
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

                              return days.map((d, colIdx) => {
                                // Helper to check if dates are on the same day (Local Time)
                                const isSameDay = (date1: Date, date2: Date) => {
                                  return date1.getFullYear() === date2.getFullYear() &&
                                         date1.getMonth() === date2.getMonth() &&
                                         date1.getDate() === date2.getDate()
                                }

                                // Filter Reservations
                                const dayReservations = reservations.filter(r => isSameDay(new Date(r.start_time), d))
                                
                                // Filter Google Events
                                const dayGoogleEvents = googleEvents.filter(e => {
                                  if (!e.start.dateTime && !e.start.date) return false
                                  const start = new Date(e.start.dateTime || e.start.date!)
                                  return isSameDay(start, d)
                                })

                                return (
                                  <div key={colIdx} className="relative h-full">
                                    {/* Hour Lines */}
                                    {[...Array(24)].map((_, i) => (
                                      <div key={i} className="h-[60px] border-b border-gray-100"></div>
                                    ))}

                                    {/* Events */}
                                    {dayReservations.map(r => {
                                      const start = new Date(r.start_time)
                                      const end = new Date(r.end_time)
                                      const startMinutes = start.getHours() * 60 + start.getMinutes()
                                      const duration = (end.getTime() - start.getTime()) / (1000 * 60)
                                      
                                      return (
                                        <div
                                          key={r.id}
                                          className="absolute left-1 right-1 bg-primary-100 border-l-4 border-primary-500 text-primary-800 text-xs p-1 rounded overflow-hidden cursor-pointer hover:opacity-90 z-10 flex flex-col"
                                          style={{
                                            top: `${startMinutes}px`,
                                            height: `${Math.max(duration, 20)}px`
                                          }}
                                          onClick={() => openDetailModal(r)}
                                        >
                                          <div className="flex items-center gap-1 font-bold text-[10px] leading-tight">
                                            <span>{start.toLocaleTimeString('ja-JP', {hour: '2-digit', minute:'2-digit'})}</span>
                                            <span className="truncate">{r.customer?.real_name || r.customer?.display_name || 'ゲスト'}</span>
                                          </div>
                                          {duration > 30 && (
                                            <>
                                              {r.menu?.name && <div className="truncate text-[10px] opacity-90 mt-0.5">{r.menu.name}</div>}
                                              {r.staff?.name && <div className="truncate text-[10px] opacity-80">担当: {r.staff.name}</div>}
                                            </>
                                          )}
                                        </div>
                                      )
                                    })}

                                    {dayGoogleEvents.map(e => {
                                      if (!e.start.dateTime) return null // Skip all-day events for now in time grid
                                      
                                      const start = new Date(e.start.dateTime)
                                      const end = e.end.dateTime ? new Date(e.end.dateTime) : new Date(start.getTime() + 60 * 60 * 1000)
                                      const startMinutes = start.getHours() * 60 + start.getMinutes()
                                      const duration = (end.getTime() - start.getTime()) / (1000 * 60)

                                      return (
                                        <div
                                          key={e.id}
                                          className="absolute left-1 right-1 bg-gray-100 border-l-4 border-gray-400 text-gray-600 text-xs p-1 rounded overflow-hidden z-0 opacity-80"
                                          style={{
                                            top: `${startMinutes}px`,
                                            height: `${Math.max(duration, 20)}px`
                                          }}
                                        >
                                          <div className="font-bold">{start.toLocaleTimeString('ja-JP', {hour: '2-digit', minute:'2-digit'})}</div>
                                          <div className="truncate">{e.summary}</div>
                                        </div>
                                      )
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

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onConfirm={() => selectedReservation && openModifyModal(selectedReservation)}
        title="予約詳細"
        confirmText="変更する"
        cancelText="閉じる"
        footerContent={
          <button
            onClick={() => {
              setIsDetailModalOpen(false)
              setIsCancelModalOpen(true)
            }}
            className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 transition"
          >
            <XCircle size={16} />
            予約をキャンセル
          </button>
        }
      >
        {selectedReservation && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                 <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {selectedReservation.customer?.profile_picture_url ? (
                      <img src={selectedReservation.customer.profile_picture_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={32} className="text-gray-400" />
                    )}
                 </div>
                 <div>
                   <div className="text-lg font-bold text-gray-900">
                     {selectedReservation.customer?.real_name || selectedReservation.customer?.display_name || 'ゲスト'}
                   </div>
                   {selectedReservation.customer?.furigana && (
                     <div className="text-sm text-gray-500">{selectedReservation.customer.furigana}</div>
                   )}
                   <div className="text-xs text-gray-400 mt-1">LINE名: {selectedReservation.customer?.display_name || '-'}</div>
                 </div>
              </div>
              <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                selectedReservation.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}>
                {selectedReservation.status === 'cancelled' ? 'キャンセル' : 'LINE予約'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <Clock className="w-5 h-5 text-primary-500 mt-0.5" />
                <div>
                  <div className="font-bold text-gray-700 text-xs mb-1">日時</div>
                  <div className="text-gray-900 font-medium">
                    {new Date(selectedReservation.start_time).toLocaleDateString('ja-JP', {year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'})}
                  </div>
                  <div className="text-xl font-bold text-primary-600 mt-0.5">
                    {new Date(selectedReservation.start_time).toLocaleTimeString('ja-JP', {hour: '2-digit', minute:'2-digit'})}
                    {' - '}
                    {new Date(selectedReservation.end_time).toLocaleTimeString('ja-JP', {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="font-bold text-gray-700 text-xs mb-1">担当スタッフ</div>
                  <div className="text-gray-900 font-medium">{selectedReservation.staff?.name || '指定なし'}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <FileText className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="font-bold text-gray-700 text-xs mb-1">メニュー</div>
                  <div className="text-gray-900 font-medium">
                    {selectedReservation.menu?.name || '指定なし'}
                    {selectedReservation.menu?.price && ` (¥${selectedReservation.menu.price.toLocaleString()})`}
                  </div>
                </div>
              </div>
              
              {selectedReservation.memo && selectedReservation.memo !== 'Web予約' && selectedReservation.memo !== 'LINE予約' && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <MessageSquare className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="font-bold text-gray-700 text-xs mb-1">メモ</div>
                    <div className="text-gray-900 whitespace-pre-wrap">{selectedReservation.memo}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleCancelReservation}
        title="予約キャンセル"
        message="この予約をキャンセルしますか？この操作は取り消せません。"
        confirmText="キャンセルする"
        variant="danger"
        isLoading={actionLoading}
      />

      <Modal
        isOpen={isModifyModalOpen}
        onClose={() => setIsModifyModalOpen(false)}
        onConfirm={handleModifyReservation}
        title="予約変更"
        confirmText="変更する"
        isLoading={actionLoading}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">新しい予約内容を入力してください。</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
            <input 
              type="date" 
              value={modifyDate}
              onChange={(e) => setModifyDate(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">時間</label>
            <input 
              type="time" 
              value={modifyTime}
              onChange={(e) => setModifyTime(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          
          {staffList.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">担当スタッフ</label>
              <select
                value={modifyStaffId}
                onChange={(e) => setModifyStaffId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">指定なし</option>
                {staffList.map((staff: StoreStaff) => (
                  <option key={staff.id} value={staff.id}>{staff.name}</option>
                ))}
              </select>
            </div>
          )}

          {menuList.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メニュー</label>
              <select
                value={modifyMenuId}
                onChange={(e) => setModifyMenuId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">指定なし</option>
                {menuList.map((menu: StoreMenu) => (
                  <option key={menu.id} value={menu.id}>
                    {menu.name} {menu.price ? `(¥${menu.price.toLocaleString()})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
            <textarea
              value={modifyMemo}
              onChange={(e) => setModifyMemo(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 min-h-[100px]"
              placeholder="予約に関するメモを入力してください"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
