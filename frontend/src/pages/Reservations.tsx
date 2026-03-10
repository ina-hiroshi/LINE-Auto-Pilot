import { useState, useEffect, useCallback } from 'react'
import { Clock, User, XCircle, FileText, MessageSquare, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toErrorMessage } from '../lib/errorUtils'
import { isPaidPlan } from '../lib/planUtils'
import { useStoreResources } from '../hooks/useStoreResources'
import Toast from '../components/Toast'
import Modal from '../components/Modal'
import ProLockOverlay from '../components/ProLockOverlay'
import ProBadge from '../components/ProBadge'
import { ReservationList } from '../features/reservations/components/ReservationList'
import { ReservationCalendar } from '../features/reservations/components/ReservationCalendar'
import { ReservationModifyForm, ReservationCreateForm } from '../features/reservations/components/ReservationForm'
import { GoogleCalendarSyncConnect, GoogleCalendarSyncSelect } from '../features/reservations/components/GoogleCalendarSync'
import type { Customer, Reservation, GoogleCalendar, GoogleEvent } from '../features/reservations/types'


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
      
      // Google Calendar未接続の場合はエラーを表示しない
      if (result.error === 'Google Calendar not connected') {
        console.log('Google Calendar not connected yet')
        setIsGoogleConnected(false)
        return
      }
      
      // トークンが期限切れの場合（バックエンド側で既にDBクリア済み）
      if (result.error === 'TOKEN_EXPIRED') {
        console.log('Google token expired, connection cleared by server')
        setIsGoogleConnected(false)
        setCalendars([])
        setSelectedCalendarId('')
        setGoogleEvents([])
        setToast({ message: result.message || 'Googleカレンダーの認証が期限切れです。再連携してください。', type: 'error' })
        return
      }
      
      // トークンが期限切れまたは取り消された場合（旧エラーフォーマット対応）
      if (result.error && (result.error.includes('expired or revoked') || result.error.includes('Token has been') || result.error.includes('invalid_grant'))) {
        console.log('Google token expired, clearing connection')
        await supabase
          .from('google_calendar_settings')
          .delete()
          .eq('user_id', session.user.id)
        
        setIsGoogleConnected(false)
        setCalendars([])
        setSelectedCalendarId('')
        setGoogleEvents([])
        setToast({ message: 'Googleカレンダーの認証が期限切れです。再連携してください。', type: 'error' })
        return
      }
      
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
      setToast({ message: `カレンダー一覧の取得に失敗しました: ${toErrorMessage(error)}`, type: 'error' })
    } finally {
      setCalendarLoading(false)
    }
  }, [selectedCalendarId])

  const checkGoogleConnection = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: settings } = await supabase
      .from('google_calendar_settings')
      .select('calendar_id, refresh_token')
      .eq('user_id', user.id)
      .maybeSingle()
    
    // refresh_tokenがある場合のみ接続済みとみなす
    if (settings && settings.refresh_token) {
      setIsGoogleConnected(true)
      // setSelectedCalendarId(settings.calendar_id) // fetchCalendars内で設定するため削除
      await fetchCalendars(settings.calendar_id)
    } else {
      setIsGoogleConnected(false)
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
      
      setIsPro(isPaidPlan(profile?.plan))
      
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
        <div className="px-4 sm:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">予約管理</h1>
              <p className="text-sm text-gray-500">予約の確認・編集・キャンセルなどの管理を行います。</p>
            </div>
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

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="w-full">
      {viewMode === 'list' ? (
        <ReservationList
          reservations={reservations}
          listFilter={listFilter}
          onListFilterChange={setListFilter}
          loading={loading}
          onReservationClick={openDetailModal}
          onCancelClick={(r) => {
            setSelectedReservation(r)
            setIsCancelModalOpen(true)
          }}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[600px] relative">
          {!isPro && (
            <ProLockOverlay
              title="Googleカレンダー連携"
              description={
                <>
                  Googleカレンダー連携機能を使用するには、Proプランへのアップグレードが必要です。
                  <br />
                  予約の自動同期やダブルブッキング防止機能が利用可能になります。
                </>
              }
            />
          )}
          {!isGoogleConnected ? (
            <GoogleCalendarSyncConnect
              calendarLoading={calendarLoading}
              isPro={isPro}
              onConnect={handleGoogleConnect}
            />
          ) : !selectedCalendarId ? (
            <GoogleCalendarSyncSelect
              calendars={calendars}
              selectedCalendarId={selectedCalendarId}
              onSelectedCalendarIdChange={setSelectedCalendarId}
              calendarLoading={calendarLoading}
              onSave={() => handleSaveCalendarSettings()}
            />
          ) : (
            <ReservationCalendar
              currentDate={currentDate}
              onCurrentDateChange={setCurrentDate}
              calendarView={calendarView}
              onCalendarViewChange={setCalendarView}
              calendars={calendars}
              selectedCalendarId={selectedCalendarId}
              displayHours={displayHours}
              reservations={reservations}
              googleEvents={googleEvents}
              onReservationClick={openDetailModal}
              onGoogleEventClick={(e) => {
                setSelectedGoogleEvent(e)
                setIsGoogleEventModalOpen(true)
              }}
              onDisconnect={handleDisconnect}
            />
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
        <ReservationModifyForm
          modifyDate={modifyDate}
          modifyTime={modifyTime}
          modifyStaffId={modifyStaffId}
          modifyMenuId={modifyMenuId}
          modifyMemo={modifyMemo}
          onModifyDateChange={setModifyDate}
          onModifyTimeChange={setModifyTime}
          onModifyStaffIdChange={setModifyStaffId}
          onModifyMenuIdChange={setModifyMenuId}
          onModifyMemoChange={setModifyMemo}
          staffList={staffList}
          menuList={menuList}
        />
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
        <ReservationCreateForm
          customerSearch={customerSearch}
          selectedCustomer={selectedCustomer}
          isNewCustomer={isNewCustomer}
          newCustomerName={newCustomerName}
          newCustomerFurigana={newCustomerFurigana}
          createDate={createDate}
          createTime={createTime}
          createStaffId={createStaffId}
          createMenuId={createMenuId}
          createMemo={createMemo}
          availableSlots={availableSlots}
          loadingSlots={loadingSlots}
          bookingSettings={bookingSettings}
          staffList={staffList}
          menuList={menuList}
          filteredCustomers={filteredCustomers}
          onCustomerSearchChange={setCustomerSearch}
          onSelectedCustomerChange={setSelectedCustomer}
          onIsNewCustomerChange={setIsNewCustomer}
          onNewCustomerNameChange={setNewCustomerName}
          onNewCustomerFuriganaChange={setNewCustomerFurigana}
          onCreateDateChange={setCreateDate}
          onCreateTimeChange={setCreateTime}
          onCreateStaffIdChange={setCreateStaffId}
          onCreateMenuIdChange={setCreateMenuId}
          onCreateMemoChange={setCreateMemo}
        />
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
