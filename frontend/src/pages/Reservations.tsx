import { useState, useEffect, useCallback } from 'react'
import { Calendar, Clock, User, CheckCircle, AlertCircle, Loader2, Edit2, XCircle, FileText, MessageSquare, Plus, Search, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStoreResources } from '../hooks/useStoreResources'
import type { StoreMenu, StoreStaff } from '../types/storeResources'
import Toast from '../components/Toast'
import Modal from '../components/Modal'
import ProLockOverlay from '../components/ProLockOverlay'
import ProBadge from '../components/ProBadge'

type Customer = {
  id: string
  line_user_id: string
  display_name: string
  profile_picture_url: string | null
  real_name: string | null
  furigana: string | null
}

type Reservation = {
  id: string
  start_time: string
  end_time: string
  status: string
  memo: string
  line_user_id: string
  registration_type?: 'line' | 'manual'
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
  location?: string
  description?: string
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
  const [listFilter, setListFilter] = useState<'today' | 'week' | 'month' | 'all'>('all')
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
  const [displayHours, setDisplayHours] = useState({ start: 9, end: 22 }) // Default 9:00 - 22:00

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
  const [isPro, setIsPro] = useState(false)

  // Googleイベント詳細モーダル State
  const [isGoogleEventModalOpen, setIsGoogleEventModalOpen] = useState(false)
  const [selectedGoogleEvent, setSelectedGoogleEvent] = useState<GoogleEvent | null>(null)

  // 予約登録モーダル State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerFurigana, setNewCustomerFurigana] = useState('')
  const [createDate, setCreateDate] = useState('')
  const [createTime, setCreateTime] = useState('')
  const [createStaffId, setCreateStaffId] = useState<string>('')
  const [createMenuId, setCreateMenuId] = useState<string>('')
  const [createMemo, setCreateMemo] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [availableSlots, setAvailableSlots] = useState<{ time: string; available: boolean }[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [bookingSettings, setBookingSettings] = useState<{
    booking_enable_staff: boolean
    booking_enable_menu: boolean
    slot_interval_minutes: number
  }>({ booking_enable_staff: false, booking_enable_menu: false, slot_interval_minutes: 60 })

  const fetchCalendars = useCallback(async (preselectedId?: string) => {
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
      
      const targetId = preselectedId || selectedCalendarId
      const targetExists = calendarsResult.some(c => c.id === targetId)

      if (targetId && targetExists) {
        if (preselectedId) setSelectedCalendarId(preselectedId)
      } else {
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
      // setSelectedCalendarId(settings.calendar_id) // fetchCalendars内で設定するため削除
      await fetchCalendars(settings.calendar_id)
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
    if (!isGoogleConnected || !selectedCalendarId || viewMode !== 'calendar' || !isPro) return
    
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
  }, [calendarView, currentDate, isGoogleConnected, selectedCalendarId, viewMode, isPro])

  useEffect(() => {
    fetchGoogleEvents()
  }, [fetchGoogleEvents])

  const handleSaveCalendarSettings = async (newCalendarId?: string) => {
    try {
      setCalendarLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const targetId = newCalendarId || selectedCalendarId

      // 1. Update DB
      const { error } = await supabase
        .from('google_calendar_settings')
        .update({ calendar_id: targetId })
        .eq('user_id', session.user.id)

      if (error) throw error

      // 2. Start Watch (Webhook)
      const watchResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar?action=watch&calendar_id=${encodeURIComponent(targetId)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })
      
      const watchResult = await watchResponse.json()
      if (watchResult.error) {
        console.error('Watch Start Error:', watchResult.error)
        throw new Error(`同期の開始に失敗しました: ${watchResult.error}`)
      }

      setToast({ message: 'カレンダー設定を保存し、同期を開始しました', type: 'success' })
    } catch (error) {
      console.error('Save Settings Error:', error)
      setToast({ message: `設定の保存に失敗しました: ${toErrorMessage(error)}`, type: 'error' })
    } finally {
      setCalendarLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Googleカレンダーとの連携を解除しますか？\n解除すると、Googleカレンダーの予定は予約一覧に表示されなくなります。')) return

    try {
      setCalendarLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar?action=disconnect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })
      
      const result = await response.json()
      if (result.error) throw new Error(result.error)
      
      setIsGoogleConnected(false)
      setCalendars([])
      setSelectedCalendarId('')
      setGoogleEvents([])
      setToast({ message: '連携を解除しました', type: 'success' })
    } catch (error) {
      console.error('Disconnect Error:', error)
      setToast({ message: `連携解除に失敗しました: ${toErrorMessage(error)}`, type: 'error' })
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
        .select('id, business_hours')
        .eq('owner_id', user.id)
        .limit(1)
      
      // Get Profile for Plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single()
      
      setIsPro(profile?.plan === 'pro' || profile?.plan === 'executive')
      
      const currentStore = stores?.[0]
      if (!currentStore) return
      setStoreId(currentStore.id)

      // Calculate Display Hours
      let currentStart = 0
      let currentEnd = 24

      if (currentStore.business_hours) {
        try {
          const hours = currentStore.business_hours as Record<string, { start: string; end: string }[]>
          let minStart = 24
          let maxEnd = 0
          
          Object.values(hours).forEach(slots => {
            if (Array.isArray(slots)) {
              slots.forEach(slot => {
                if (slot.start) {
                  const h = parseInt(slot.start.split(':')[0], 10)
                  if (!isNaN(h) && h < minStart) minStart = h
                }
                if (slot.end) {
                  const h = parseInt(slot.end.split(':')[0], 10)
                  // If end is 20:00, we want to show until 20:00, so maxEnd should be 20.
                  // If end is 20:30, we probably want to show until 21:00.
                  const m = parseInt(slot.end.split(':')[1], 10)
                  let endH = h
                  if (m > 0) endH += 1
                  if (!isNaN(endH) && endH > maxEnd) maxEnd = endH
                }
              })
            }
          })

          if (minStart < 24 && maxEnd > 0) {
             currentStart = Math.max(0, minStart)
             currentEnd = Math.min(24, maxEnd)
          }
        } catch (e) {
          console.error('Error parsing business hours:', e)
        }
      }
      
      setDisplayHours({ start: currentStart, end: currentEnd })

      // Fetch Reservations
      const { data: resDataRaw, error: resError } = await supabase
        .from('reservations')
        .select('*, staff:staff_members(name), menu:booking_menus(name, price)')
        .eq('store_id', currentStore.id)
        .neq('status', 'cancelled') // キャンセル済みを除外
        .order('start_time', { ascending: true })

      if (resError) throw resError

      const resData = (resDataRaw ?? []) as Reservation[]
      
      if (resData.length === 0) {
        setReservations([])
      } else {
        // Check if any reservation is outside display hours and expand if necessary
        let newStart = currentStart
        let newEnd = currentEnd
        
        // Re-calculate based on actual reservations if they are outside business hours
        resData.forEach(r => {
            const startH = new Date(r.start_time).getHours()
            const endH = new Date(r.end_time).getHours() + (new Date(r.end_time).getMinutes() > 0 ? 1 : 0)
            
            if (startH < newStart) newStart = startH
            if (endH > newEnd) newEnd = endH
        })
        
        if (newStart !== currentStart || newEnd !== currentEnd) {
             setDisplayHours({ start: Math.max(0, newStart), end: Math.min(24, newEnd) })
        }

        // Fetch Customers for these reservations
        const userIds = Array.from(new Set(resData.map((r: Reservation) => r.line_user_id).filter(Boolean)))
        
        const { data: customers, error: custError } = await supabase
          .from('customers')
          .select('line_user_id, display_name, profile_picture_url, real_name, furigana')
          .eq('store_id', currentStore.id)
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

    console.log('Setting up realtime subscription for store:', storeId)

    const channel = supabase
      .channel(`reservations-realtime-${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `store_id=eq.${storeId}`
        },
        (payload) => {
          console.log('Realtime update received:', payload)
          fetchReservations()
          fetchGoogleEvents()
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
      })

    return () => {
      console.log('Cleaning up realtime subscription')
      supabase.removeChannel(channel)
    }
  }, [fetchReservations, fetchGoogleEvents, storeId])

  const handleCancelReservation = async () => {
    if (!selectedReservation) return
    setActionLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('booking', {
        body: {
          action: 'cancel_reservation',
          reservation_id: selectedReservation.id,
          store_id: storeId,
          is_manual: true
        }
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)

      setToast({ message: '予約をキャンセルしました', type: 'success' })
      setIsCancelModalOpen(false)
      fetchReservations()
      fetchGoogleEvents()
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
          is_manual: true,
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
      fetchGoogleEvents()
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

  // 予約登録モーダルを開く
  const openCreateModal = async () => {
    // 今日の日付をデフォルト設定
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    setCreateDate(`${year}-${month}-${day}`)
    setCreateTime('')
    setCreateStaffId('')
    setCreateMenuId('')
    setCreateMemo('')
    setSelectedCustomer(null)
    setIsNewCustomer(false)
    setNewCustomerName('')
    setNewCustomerFurigana('')
    setCustomerSearch('')
    setAvailableSlots([])
    
    // 顧客一覧を取得
    if (storeId) {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('store_id', storeId)
        .order('display_name', { ascending: true })
      setCustomers((data || []) as Customer[])
      
      // 予約設定を取得
      const { data: store } = await supabase
        .from('stores')
        .select('booking_enable_staff, booking_enable_menu, slot_interval_minutes')
        .eq('id', storeId)
        .single()
      if (store) {
        setBookingSettings({
          booking_enable_staff: store.booking_enable_staff ?? false,
          booking_enable_menu: store.booking_enable_menu ?? false,
          slot_interval_minutes: store.slot_interval_minutes ?? 60
        })
      }
    }
    
    setIsCreateModalOpen(true)
  }

  // 日付変更時に空き枠を取得
  const fetchAvailableSlots = useCallback(async (date: string, menuId?: string, staffId?: string) => {
    if (!storeId || !date) return
    
    setLoadingSlots(true)
    try {
      const { data, error } = await supabase.functions.invoke('booking', {
        body: {
          action: 'get_available_slots',
          store_id: storeId,
          date: date,
          menu_id: menuId || null,
          staff_id: staffId || null,
        }
      })
      
      if (error) throw error
      setAvailableSlots(data?.slots || [])
    } catch (e) {
      console.error('Failed to fetch slots:', e)
      setAvailableSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [storeId])

  // 日付・メニュー・スタッフ変更時に空き枠を再取得
  useEffect(() => {
    if (isCreateModalOpen && createDate) {
      fetchAvailableSlots(createDate, createMenuId, createStaffId)
    }
  }, [isCreateModalOpen, createDate, createMenuId, createStaffId, fetchAvailableSlots])

  // 予約登録処理
  const handleCreateReservation = async () => {
    if (!storeId) {
      setToast({ message: '店舗情報が見つかりません', type: 'error' })
      return
    }
    
    if (!createDate || !createTime) {
      setToast({ message: '日付と時間を選択してください', type: 'error' })
      return
    }
    
    if (!selectedCustomer && !isNewCustomer) {
      setToast({ message: '顧客を選択するか、新規顧客情報を入力してください', type: 'error' })
      return
    }
    
    if (isNewCustomer && !newCustomerName) {
      setToast({ message: '顧客名を入力してください', type: 'error' })
      return
    }

    setCreateLoading(true)
    try {
      // 予約作成
      const { data, error } = await supabase.functions.invoke('booking', {
        body: {
          action: 'create_reservation',
          store_id: storeId,
          line_user_id: selectedCustomer?.line_user_id || `MANUAL_${Date.now()}`,
          display_name: selectedCustomer?.display_name || newCustomerName,
          real_name: selectedCustomer?.real_name || newCustomerName,
          furigana: selectedCustomer?.furigana || newCustomerFurigana,
          date: createDate,
          time: createTime,
          staff_id: createStaffId || null,
          menu_id: createMenuId || null,
          memo: createMemo || null,
          is_manual: true, // 手動登録フラグ
        }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      // 新規顧客の場合、顧客テーブルにも登録
      if (isNewCustomer && newCustomerName) {
        const newLineUserId = `MANUAL_${Date.now()}`
        await supabase.from('customers').upsert({
          store_id: storeId,
          line_user_id: newLineUserId,
          display_name: newCustomerName,
          real_name: newCustomerName,
          furigana: newCustomerFurigana || null,
        }, { onConflict: 'store_id, line_user_id' })
      }

      setToast({ message: '予約を登録しました', type: 'success' })
      setIsCreateModalOpen(false)
      
      // 予約一覧を再取得
      fetchReservations()
    } catch (error) {
      console.error('Create Reservation Error:', error)
      setToast({ message: `予約登録に失敗しました: ${toErrorMessage(error)}`, type: 'error' })
    } finally {
      setCreateLoading(false)
    }
  }

  // 顧客検索フィルター
  const filteredCustomers = customers.filter(c => {
    if (!customerSearch) return true
    const search = customerSearch.toLowerCase()
    return (
      c.display_name?.toLowerCase().includes(search) ||
      c.real_name?.toLowerCase().includes(search) ||
      c.furigana?.toLowerCase().includes(search)
    )
  })

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 z-20 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-200 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">予約管理</h1>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-500">予約の確認・編集・キャンセルなどの管理を行います。</p>
              <div className="flex gap-2 shrink-0">
                <div className="bg-gray-100 p-1 rounded-lg flex">
                  <button 
                    onClick={() => setViewMode('list')}
                    className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition whitespace-nowrap ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    リスト
                  </button>
                  <button 
                    onClick={() => {
                      setViewMode('calendar')
                      if (isGoogleConnected && !calendars.length) fetchCalendars()
                    }}
                    className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition flex items-center justify-center gap-1 whitespace-nowrap ${viewMode === 'calendar' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    カレンダー
                    {!isPro && <ProBadge />}
                  </button>
                </div>
                <button 
                  onClick={openCreateModal}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 shadow-sm whitespace-nowrap flex items-center gap-2 font-medium"
                >
                  <Plus size={18} />
                  予約登録
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-7xl mx-auto">
      {viewMode === 'list' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="font-bold text-gray-800">予約一覧</h2>
            <div className="flex bg-gray-100 rounded-lg p-1">
                <button onClick={() => setListFilter('all')} className={`px-3 py-1 text-xs font-medium rounded-md transition ${listFilter === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>全期間</button>
                <button onClick={() => setListFilter('month')} className={`px-3 py-1 text-xs font-medium rounded-md transition ${listFilter === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>今月</button>
                <button onClick={() => setListFilter('week')} className={`px-3 py-1 text-xs font-medium rounded-md transition ${listFilter === 'week' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>今週</button>
                <button onClick={() => setListFilter('today')} className={`px-3 py-1 text-xs font-medium rounded-md transition ${listFilter === 'today' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>今日</button>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {loading ? (
                <div className="p-8 text-center text-gray-500">読み込み中...</div>
            ) : (
                (() => {
                    const filtered = reservations.filter(r => {
                        if (listFilter === 'all') return true
                        const d = new Date(r.start_time)
                        const now = new Date()
                        if (listFilter === 'today') return d.toDateString() === now.toDateString()
                        if (listFilter === 'week') {
                            const start = new Date(now)
                            start.setDate(now.getDate() - now.getDay())
                            start.setHours(0,0,0,0)
                            const end = new Date(start)
                            end.setDate(start.getDate() + 7)
                            return d >= start && d < end
                        }
                        if (listFilter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
                        return true
                    })

                    if (filtered.length === 0) return <div className="p-8 text-center text-gray-500">予約はありません</div>

                    return filtered.map((reservation) => {
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
                                reservation.registration_type === 'manual' ? 'bg-blue-100 text-blue-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {reservation.status === 'cancelled' ? 'キャンセル' : 
                                 reservation.registration_type === 'manual' ? '手動登録' : 'LINE予約'}
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
            })()
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[600px] relative">
          {!isPro && (
            <ProLockOverlay 
              title="Googleカレンダー連携" 
              description={
                <>
                  Googleカレンダー連携機能を使用するには、Proプランへのアップグレードが必要です。<br />
                  予約の自動同期やダブルブッキング防止機能が利用可能になります。
                </>
              }
            />
          )}
          {!isGoogleConnected ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center relative overflow-hidden">
              {/* Background Decoration */}
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
                  Googleカレンダーと連携することで、<br/>
                  予約状況を一元管理し、ダブルブッキングを防止。<br/>
                  <span className="text-xs text-gray-400 mt-2 block">※ホットペッパービューティー等の外部システムとも間接的に連携可能です。</span>
                </p>
                
                <button 
                  onClick={handleGoogleConnect}
                  disabled={calendarLoading || !isPro}
                  className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 px-6 py-4 rounded-xl hover:bg-gray-50 transition font-bold shadow-sm hover:shadow-md group disabled:opacity-50 disabled:cursor-not-allowed"
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
                    {/* Calendar Name Display */}
                    {selectedCalendarId && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-md border border-gray-200">
                          <div 
                            className="w-3 h-3 rounded-full border border-gray-200 shadow-sm" 
                            style={{ backgroundColor: calendars.find(c => c.id === selectedCalendarId)?.backgroundColor || '#ccc' }} 
                          />
                          <span className="text-xs sm:text-sm font-bold text-gray-700 truncate max-w-[150px] sm:max-w-[200px]">
                            {calendars.find(c => c.id === selectedCalendarId)?.summary || 'カレンダー'}
                          </span>
                        </div>
                        <div className="hidden sm:flex items-center gap-2 text-green-700 font-medium px-3 py-1 bg-green-100 rounded-full text-xs whitespace-nowrap border border-green-200">
                          <CheckCircle size={12} />
                          <span>連携中</span>
                        </div>
                        <button
                          onClick={handleDisconnect}
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
                  </div>
                </div>
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
                          onClick={() => handleSaveCalendarSettings()}
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
                      <div className={`flex ${calendarView === 'week' ? 'min-w-[600px]' : ''}`}>
                        {(calendarView === 'week' || calendarView === 'day') && (
                          <div className="w-10 sm:w-14 flex-shrink-0 bg-gray-50 border-b border-r border-gray-200"></div>
                        )}
                        <div className={`flex-1 grid ${calendarView === 'day' ? 'grid-cols-1' : 'grid-cols-7'} border-b border-gray-200 bg-gray-50 shrink-0`}>
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
                      <div className="flex-1 overflow-auto relative bg-white">
                        <div 
                          className={`flex ${calendarView === 'week' ? 'min-w-[600px]' : ''}`}
                          style={{ minHeight: `${(displayHours.end - displayHours.start) * 60}px` }}
                        >
                          {/* Time Labels */}
                          <div className="w-10 sm:w-14 flex-shrink-0 border-r border-gray-200 bg-gray-50 sticky left-0 z-20">
                            {[...Array(displayHours.end - displayHours.start)].map((_, i) => {
                              const hour = i + displayHours.start
                              return (
                                <div key={hour} className="h-[60px] text-[9px] sm:text-[11px] text-gray-500 text-right pr-0.5 sm:pr-1.5 pt-0.5 border-b border-gray-100 bg-gray-50">
                                  <span className="sm:hidden">{hour}</span>
                                  <span className="hidden sm:inline">{hour}:00</span>
                                </div>
                              )
                            })}
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

                                // --- 重なり計算ロジック ---
                                // すべてのイベント（予約 + Googleイベント）を統合
                                type CalendarItem = {
                                  id: string
                                  type: 'reservation' | 'google'
                                  startMinutes: number
                                  endMinutes: number
                                  data: Reservation | GoogleEvent
                                }

                                const allItems: CalendarItem[] = []

                                // 予約を追加
                                dayReservations.forEach(r => {
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
                                      data: r
                                    })
                                  }
                                })

                                // Googleイベントを追加
                                dayGoogleEvents.forEach(e => {
                                  if (!e.start.dateTime) return
                                  const start = new Date(e.start.dateTime)
                                  const end = e.end.dateTime ? new Date(e.end.dateTime) : new Date(start.getTime() + 60 * 60 * 1000)
                                  const startMinutes = start.getHours() * 60 + start.getMinutes()
                                  const endMinutes = end.getHours() * 60 + end.getMinutes()
                                  if (startMinutes >= displayHours.start * 60) {
                                    allItems.push({
                                      id: e.id,
                                      type: 'google',
                                      startMinutes,
                                      endMinutes,
                                      data: e
                                    })
                                  }
                                })

                                // 開始時間でソート
                                allItems.sort((a, b) => a.startMinutes - b.startMinutes)

                                // 重なりグループを計算
                                const itemPositions: Map<string, { column: number; totalColumns: number }> = new Map()
                                
                                // イベントが重なっているかチェック
                                const isOverlapping = (item1: CalendarItem, item2: CalendarItem) => {
                                  return item1.startMinutes < item2.endMinutes && item2.startMinutes < item1.endMinutes
                                }

                                // 重なりグループを見つけてカラム位置を割り当て
                                const processedIds = new Set<string>()
                                
                                allItems.forEach((item, index) => {
                                  if (processedIds.has(item.id)) return
                                  
                                  // このアイテムと重なるすべてのアイテムを見つける
                                  const group: CalendarItem[] = [item]
                                  processedIds.add(item.id)
                                  
                                  // 後続のアイテムで重なるものを探す
                                  for (let i = index + 1; i < allItems.length; i++) {
                                    const nextItem = allItems[i]
                                    if (processedIds.has(nextItem.id)) continue
                                    
                                    // グループ内のいずれかと重なるかチェック
                                    const overlapsWithGroup = group.some(g => isOverlapping(g, nextItem))
                                    if (overlapsWithGroup) {
                                      group.push(nextItem)
                                      processedIds.add(nextItem.id)
                                    }
                                  }
                                  
                                  // グループ内のカラム位置を決定
                                  const columns: CalendarItem[][] = []
                                  
                                  group.forEach(g => {
                                    // 配置可能なカラムを見つける
                                    let placed = false
                                    for (let col = 0; col < columns.length; col++) {
                                      const canPlace = columns[col].every(existing => !isOverlapping(existing, g))
                                      if (canPlace) {
                                        columns[col].push(g)
                                        itemPositions.set(g.id, { column: col, totalColumns: 0 })
                                        placed = true
                                        break
                                      }
                                    }
                                    if (!placed) {
                                      columns.push([g])
                                      itemPositions.set(g.id, { column: columns.length - 1, totalColumns: 0 })
                                    }
                                  })
                                  
                                  // 総カラム数を更新
                                  group.forEach(g => {
                                    const pos = itemPositions.get(g.id)!
                                    pos.totalColumns = columns.length
                                  })
                                })

                                return (
                                  <div key={colIdx} className="relative h-full">
                                    {/* Hour Lines */}
                                    {[...Array(displayHours.end - displayHours.start)].map((_, i) => (
                                      <div key={i} className="h-[60px] border-b border-gray-100"></div>
                                    ))}

                                    {/* Events with overlap handling */}
                                    {allItems.map(item => {
                                      const pos = itemPositions.get(item.id)
                                      if (!pos) return null

                                      const top = item.startMinutes - (displayHours.start * 60)
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
                                              width: `calc(${width}% - 4px)`
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
                                              width: `calc(${width}% - 4px)`
                                            }}
                                            onClick={() => {
                                              setSelectedGoogleEvent(e)
                                              setIsGoogleEventModalOpen(true)
                                            }}
                                          >
                                            <div className="font-bold text-[10px]">{start.toLocaleTimeString('ja-JP', {hour: '2-digit', minute:'2-digit'})}</div>
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
        showDefaultButtons={true}
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
              
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <MessageSquare className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="w-full">
                  <div className="font-bold text-gray-700 text-xs mb-1">メモ (店舗用)</div>
                  <div className="text-gray-900 whitespace-pre-wrap min-h-[1.5em]">
                    {(selectedReservation.memo && selectedReservation.memo !== 'LINE予約' && selectedReservation.memo !== 'LINE予約(変更)') ? selectedReservation.memo : <span className="text-gray-400 text-xs">メモはありません</span>}
                  </div>
                </div>
              </div>
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

      {/* 予約登録モーダル */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="予約登録"
        confirmText={createLoading ? '登録中...' : '予約を登録'}
        onConfirm={handleCreateReservation}
        isLoading={createLoading}
      >
        <div className="space-y-5">
          {/* 顧客選択セクション */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700">顧客情報</label>
            
            {/* 顧客タイプ選択 */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsNewCustomer(false)
                  setSelectedCustomer(null)
                }}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border-2 transition ${
                  !isNewCustomer 
                    ? 'border-primary-500 bg-primary-50 text-primary-700' 
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <Search size={16} className="inline mr-1" />
                既存顧客から選択
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsNewCustomer(true)
                  setSelectedCustomer(null)
                }}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border-2 transition ${
                  isNewCustomer 
                    ? 'border-primary-500 bg-primary-50 text-primary-700' 
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <UserPlus size={16} className="inline mr-1" />
                新規顧客
              </button>
            </div>

            {/* 既存顧客検索 */}
            {!isNewCustomer && (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="顧客名・フリガナで検索..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm"
                  />
                </div>
                
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredCustomers.length === 0 ? (
                    <div className="p-3 text-center text-sm text-gray-500">
                      {customerSearch ? '該当する顧客が見つかりません' : '顧客がいません'}
                    </div>
                  ) : (
                    filteredCustomers.map(customer => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => setSelectedCustomer(customer)}
                        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-50 transition ${
                          selectedCustomer?.id === customer.id ? 'bg-primary-50 border-l-4 border-primary-500' : ''
                        }`}
                      >
                        {customer.profile_picture_url ? (
                          <img src={customer.profile_picture_url} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <User size={16} className="text-gray-500" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{customer.real_name || customer.display_name}</div>
                          <div className="text-xs text-gray-500">
                            {customer.furigana && <span>{customer.furigana}</span>}
                            {customer.furigana && customer.real_name && customer.display_name !== customer.real_name && ' / '}
                            {customer.real_name && customer.display_name !== customer.real_name && <span className="text-gray-400">LINE: {customer.display_name}</span>}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                
                {selectedCustomer && (
                  <div className="p-3 bg-primary-50 rounded-lg border border-primary-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-primary-600" />
                      <span className="text-sm font-medium text-primary-700">選択中: {selectedCustomer.real_name || selectedCustomer.display_name}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 新規顧客入力 */}
            {isNewCustomer && (
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">顧客名 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="山田 太郎"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">フリガナ</label>
                  <input
                    type="text"
                    value={newCustomerFurigana}
                    onChange={(e) => setNewCustomerFurigana(e.target.value)}
                    placeholder="ヤマダ タロウ"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 日付選択 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">予約日 <span className="text-red-500">*</span></label>
            <input 
              type="date" 
              value={createDate}
              onChange={(e) => setCreateDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* 担当スタッフ（設定で有効な場合） */}
          {bookingSettings.booking_enable_staff && staffList.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">担当スタッフ</label>
              <select
                value={createStaffId}
                onChange={(e) => setCreateStaffId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">指定なし</option>
                {staffList.map((staff: StoreStaff) => (
                  <option key={staff.id} value={staff.id}>{staff.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* メニュー（設定で有効な場合） */}
          {bookingSettings.booking_enable_menu && menuList.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">メニュー</label>
              <select
                value={createMenuId}
                onChange={(e) => setCreateMenuId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">指定なし</option>
                {menuList.map((menu: StoreMenu) => (
                  <option key={menu.id} value={menu.id}>
                    {menu.name} ({menu.duration_minutes}分) {menu.price ? `¥${menu.price.toLocaleString()}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 時間選択 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">予約時間 <span className="text-red-500">*</span></label>
            {loadingSlots ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                <span className="ml-2 text-sm text-gray-500">空き枠を確認中...</span>
              </div>
            ) : createDate && availableSlots.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                {availableSlots.map(slot => (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() => slot.available && setCreateTime(slot.time)}
                    disabled={!slot.available}
                    className={`py-2 px-1 text-sm rounded-md transition ${
                      createTime === slot.time
                        ? 'bg-primary-600 text-white'
                        : slot.available
                          ? 'bg-white border border-gray-200 text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                          : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            ) : createDate ? (
              <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-500">
                この日は予約可能な枠がありません
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-500">
                日付を選択すると空き枠が表示されます
              </div>
            )}
            
            {createTime && (
              <div className="mt-2 p-2 bg-primary-50 rounded-md">
                <span className="text-sm font-medium text-primary-700">
                  <Clock size={14} className="inline mr-1" />
                  選択中: {createTime}
                </span>
              </div>
            )}
          </div>

          {/* メモ */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">メモ</label>
            <textarea
              value={createMemo}
              onChange={(e) => setCreateMemo(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 min-h-[80px] text-sm"
              placeholder="予約に関するメモ（任意）"
            />
          </div>
        </div>
      </Modal>

      {/* Googleイベント詳細モーダル */}
      <Modal
        isOpen={isGoogleEventModalOpen}
        onClose={() => {
          setIsGoogleEventModalOpen(false)
          setSelectedGoogleEvent(null)
        }}
        title="Googleカレンダーの予定"
        showDefaultButtons={false}
        footerContent={
          selectedGoogleEvent && (
            <div className="flex gap-3 w-full">
              <button
                onClick={() => {
                  setIsGoogleEventModalOpen(false)
                  setSelectedGoogleEvent(null)
                }}
                className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 text-center text-sm font-medium rounded-lg hover:bg-gray-50 transition"
              >
                閉じる
              </button>
              <a
                href={selectedGoogleEvent.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-4 bg-primary-600 text-white text-center text-sm font-medium rounded-lg hover:bg-primary-700 transition"
              >
                Googleカレンダーで開く
              </a>
            </div>
          )
        }
      >
        {selectedGoogleEvent && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{selectedGoogleEvent.summary || '(タイトルなし)'}</h3>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock size={16} />
              <span>
                {selectedGoogleEvent.start.dateTime ? (
                  <>
                    {new Date(selectedGoogleEvent.start.dateTime).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                    {' '}
                    {new Date(selectedGoogleEvent.start.dateTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    {selectedGoogleEvent.end.dateTime && (
                      <>
                        {' - '}
                        {new Date(selectedGoogleEvent.end.dateTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </>
                    )}
                  </>
                ) : (
                  '終日'
                )}
              </span>
            </div>

            {selectedGoogleEvent.location && (
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{selectedGoogleEvent.location}</span>
              </div>
            )}

            {selectedGoogleEvent.description && (
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                <pre className="whitespace-pre-wrap font-sans">{selectedGoogleEvent.description}</pre>
              </div>
            )}
          </div>
        )}
      </Modal>
        </div>
      </div>
    </div>
  )
}
