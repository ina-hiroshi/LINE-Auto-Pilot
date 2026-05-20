import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Clock, Calendar, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toErrorMessage, toErrorMessageAsync } from '../lib/errorUtils'
import { isPaidPlan } from '../lib/planUtils'
import { isLineCustomer } from '../lib/reservationStatus'
import { useStoreResources } from '../hooks/useStoreResources'
import { usePointOperation, type MembershipCardSettings } from '../hooks/usePointOperation'
import Toast from '../components/Toast'
import { UnderlineTabs } from '../components/UnderlineTabs'
import Modal from '../components/Modal'
import ProLockOverlay from '../components/ProLockOverlay'
import ProBadge from '../components/ProBadge'
import { ReservationList, type ListFilter } from '../features/reservations/components/ReservationList'
import { ReservationCalendar } from '../features/reservations/components/ReservationCalendar'
import { ReservationModifyForm, ReservationCreateForm } from '../features/reservations/components/ReservationForm'
import { ReservationConfirmModal } from '../features/reservations/components/ReservationConfirmModal'
import { PaymentModal } from '../features/reservations/components/PaymentModal'
import { PaymentPointPrompt } from '../features/reservations/components/PaymentPointPrompt'
import { PointsModal } from '../features/reservations/components/PointsModal'
import { SalesSummaryTab } from '../features/sales/components/SalesSummaryTab'
import { GoogleCalendarSyncConnect, GoogleCalendarSyncSelect } from '../features/reservations/components/GoogleCalendarSync'
import type { Customer, Reservation, GoogleCalendar, GoogleEvent } from '../features/reservations/types'


export default function Reservations() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [pageTab, setPageTab] = useState<'bookings' | 'sales'>('bookings')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [listFilter, setListFilter] = useState<ListFilter>('all')
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
  const [createQuotedAmount, setCreateQuotedAmount] = useState('')
  const [createMemo, setCreateMemo] = useState('')
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [isPointPromptOpen, setIsPointPromptOpen] = useState(false)
  const [isPointsModalOpen, setIsPointsModalOpen] = useState(false)
  const [lastPaidAmount, setLastPaidAmount] = useState(0)
  const [customerPointBalance, setCustomerPointBalance] = useState(0)
  const [membershipSettings, setMembershipSettings] = useState<MembershipCardSettings | null>(null)
  const { updatePoints, saving: pointSaving } = usePointOperation(storeId, membershipSettings)
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

  useEffect(() => {
    const openId = searchParams.get('reservation')
    if (!openId || reservations.length === 0) return
    const target = reservations.find((r) => r.id === openId)
    if (target) {
      void openDetailModal(target)
      setSearchParams({}, { replace: true })
    }
  }, [reservations, searchParams, setSearchParams])

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
      const { data, error, response } = await supabase.functions.invoke('booking', {
        body: {
          action: 'cancel_reservation',
          reservation_id: selectedReservation.id,
          store_id: storeId,
          is_manual: true
        }
      })
      if (error) {
        setToast({ message: `キャンセルに失敗しました: ${await toErrorMessageAsync(error, response)}`, type: 'error' })
        return
      }
      if (data && typeof data === 'object' && data !== null && 'error' in data) {
        const msg = (data as { error: unknown }).error
        if (typeof msg === 'string' && msg.length > 0) {
          setToast({ message: `キャンセルに失敗しました: ${msg}`, type: 'error' })
          return
        }
      }

      setToast({ message: '予約をキャンセルしました', type: 'success' })
      setIsCancelModalOpen(false)
      fetchReservations()
      fetchGoogleEvents()
    } catch (error) {
      console.error('Cancel Error:', error)
      setToast({ message: `キャンセルに失敗しました: ${await toErrorMessageAsync(error)}`, type: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleModifyReservation = async () => {
    if (!selectedReservation || !modifyDate || !modifyTime) return
    setActionLoading(true)
    try {
      const { data, error, response } = await supabase.functions.invoke('booking', {
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
      if (error) {
        setToast({ message: `変更に失敗しました: ${await toErrorMessageAsync(error, response)}`, type: 'error' })
        return
      }
      if (data && typeof data === 'object' && data !== null && 'error' in data) {
        const msg = (data as { error: unknown }).error
        if (typeof msg === 'string' && msg.length > 0) {
          setToast({ message: `変更に失敗しました: ${msg}`, type: 'error' })
          return
        }
      }
      setToast({ message: '予約を変更しました', type: 'success' })
      setIsModifyModalOpen(false)
      fetchReservations()
      fetchGoogleEvents()
    } catch (error) {
      console.error('Modify Error:', error)
      setToast({ message: `変更に失敗しました: ${await toErrorMessageAsync(error)}`, type: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const loadMembershipSettings = useCallback(async () => {
    if (!storeId) return
    const { data } = await supabase
      .from('stores')
      .select('membership_card_settings')
      .eq('id', storeId)
      .single()
    setMembershipSettings((data?.membership_card_settings as MembershipCardSettings) ?? null)
  }, [storeId])

  const loadCustomerPoints = useCallback(
    async (lineUserId: string) => {
      if (!storeId) return 0
      const { data } = await supabase
        .from('points')
        .select('balance')
        .eq('store_id', storeId)
        .eq('line_user_id', lineUserId)
        .maybeSingle()
      const balance = data?.balance ?? 0
      setCustomerPointBalance(balance)
      return balance
    },
    [storeId],
  )

  const openDetailModal = async (reservation: Reservation) => {
    setSelectedReservation(reservation)
    setIsDetailModalOpen(true)
    await loadMembershipSettings()
    if (isLineCustomer(reservation.line_user_id)) {
      await loadCustomerPoints(reservation.line_user_id)
    } else {
      setCustomerPointBalance(0)
    }
  }

  const handlePaymentSuccess = async (paidAmount: number) => {
    setIsPaymentModalOpen(false)
    setLastPaidAmount(paidAmount)
    if (selectedReservation) {
      setSelectedReservation({
        ...selectedReservation,
        status: 'paid',
        paid_amount: paidAmount,
        paid_at: new Date().toISOString(),
      })
    }
    await fetchReservations()
    if (selectedReservation && isLineCustomer(selectedReservation.line_user_id)) {
      setIsPointPromptOpen(true)
    } else {
      setToast({ message: '決済が完了しました', type: 'success' })
    }
  }

  const handlePointGrantFromPrompt = async (amount: number) => {
    if (!selectedReservation?.line_user_id) return
    const result = await updatePoints(selectedReservation.line_user_id, customerPointBalance, amount, 'add')
    setIsPointPromptOpen(false)
    if (result.success) {
      setToast({
        message: result.stampCompleted ? 'スタンプカードが満了しました！' : 'ポイントを付与しました',
        type: 'success',
      })
      setCustomerPointBalance(result.newBalance)
    } else {
      setToast({ message: 'ポイント更新に失敗しました', type: 'error' })
    }
  }

  const handlePointsModalSubmit = async (amount: number, type: 'add' | 'use') => {
    if (!selectedReservation?.line_user_id) return
    const result = await updatePoints(selectedReservation.line_user_id, customerPointBalance, amount, type)
    if (result.success) {
      setCustomerPointBalance(result.newBalance)
      setToast({ message: type === 'add' ? 'ポイントを更新しました' : 'ポイントを利用しました', type: 'success' })
    } else {
      setToast({ message: 'ポイント更新に失敗しました', type: 'error' })
    }
  }

  const openModifyModal = (reservation: Reservation) => {
    if (reservation.status === 'paid') return
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
    setCreateQuotedAmount('')
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

    const menu = menuList.find((m) => m.id === createMenuId)
    let quotedAmount: number | undefined
    if (createMenuId && menu?.price != null) {
      quotedAmount = menu.price
    } else if (createQuotedAmount !== '') {
      const parsed = parseInt(createQuotedAmount, 10)
      if (isNaN(parsed) || parsed < 0) {
        setToast({ message: '見込み金額（税込）を入力してください', type: 'error' })
        return
      }
      quotedAmount = parsed
    } else if (!createMenuId || bookingSettings.booking_enable_menu) {
      setToast({ message: 'メニュー未選択の場合は見込み金額（税込）が必要です', type: 'error' })
      return
    }

    setCreateLoading(true)
    try {
      const lineUserId = selectedCustomer?.line_user_id || `MANUAL_${Date.now()}`

      // 予約作成（バックエンド側で顧客 upsert も実行される）
      const { data, error, response } = await supabase.functions.invoke('booking', {
        body: {
          action: 'create_reservation',
          store_id: storeId,
          line_user_id: lineUserId,
          display_name: selectedCustomer?.display_name || newCustomerName,
          real_name: selectedCustomer?.real_name || newCustomerName,
          furigana: selectedCustomer?.furigana || newCustomerFurigana,
          date: createDate,
          time: createTime,
          staff_id: createStaffId || null,
          menu_id: createMenuId || null,
          memo: createMemo || null,
          quoted_amount: quotedAmount,
          is_manual: true,
        }
      })

      if (error) {
        setToast({ message: `予約登録に失敗しました: ${await toErrorMessageAsync(error, response)}`, type: 'error' })
        return
      }
      if (data && typeof data === 'object' && data !== null && 'error' in data) {
        const msg = (data as { error: unknown }).error
        if (typeof msg === 'string' && msg.length > 0) {
          setToast({ message: `予約登録に失敗しました: ${msg}`, type: 'error' })
          return
        }
      }

      setToast({ message: '予約を登録しました', type: 'success' })
      setIsCreateModalOpen(false)
      
      // 予約一覧を再取得
      fetchReservations()
    } catch (error) {
      console.error('Create Reservation Error:', error)
      setToast({ message: `予約登録に失敗しました: ${await toErrorMessageAsync(error)}`, type: 'error' })
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
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">予約売上管理</h1>
              <p className="text-sm text-gray-500">予約の確認・決済・売上の管理を行います。</p>
            </div>
            <div className="flex gap-2 shrink-0">
              {pageTab === 'bookings' && (
              <>
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
              </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="w-full">
          <UnderlineTabs
            activeId={pageTab}
            onChange={setPageTab}
            items={[
              { id: 'bookings', label: '予約', icon: Calendar },
              { id: 'sales', label: '売上', icon: TrendingUp },
            ]}
          />
      {pageTab === 'sales' ? (
        <SalesSummaryTab storeId={storeId} />
      ) : viewMode === 'list' ? (
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

      <ReservationConfirmModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        reservation={selectedReservation}
        onPay={() => setIsPaymentModalOpen(true)}
        onPoints={() => setIsPointsModalOpen(true)}
        onModify={() => selectedReservation && openModifyModal(selectedReservation)}
        onCancel={() => {
          setIsDetailModalOpen(false)
          setIsCancelModalOpen(true)
        }}
        pointsDisabled={!selectedReservation || !isLineCustomer(selectedReservation.line_user_id)}
        pointsDisabledReason="LINE連携顧客のみポイント操作できます"
      />

      {selectedReservation && storeId && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          reservation={selectedReservation}
          storeId={storeId}
          staffList={staffList}
          menuList={menuList}
          onSuccess={handlePaymentSuccess}
        />
      )}

      <PaymentPointPrompt
        isOpen={isPointPromptOpen}
        paidAmount={lastPaidAmount}
        balance={customerPointBalance}
        storeSettings={membershipSettings}
        saving={pointSaving}
        onGrant={handlePointGrantFromPrompt}
        onSkip={() => {
          setIsPointPromptOpen(false)
          setToast({ message: '決済が完了しました', type: 'success' })
        }}
      />

      <PointsModal
        isOpen={isPointsModalOpen}
        onClose={() => setIsPointsModalOpen(false)}
        customerName={
          selectedReservation?.customer?.real_name ||
          selectedReservation?.customer?.display_name ||
          'ゲスト'
        }
        balance={customerPointBalance}
        storeSettings={membershipSettings}
        saving={pointSaving}
        onSubmit={handlePointsModalSubmit}
      />

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
          createQuotedAmount={createQuotedAmount}
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
          onCreateQuotedAmountChange={setCreateQuotedAmount}
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
