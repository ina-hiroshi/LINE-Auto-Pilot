import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getJstDayOfWeek, getJstDateString, getJstDateStringWithOffset } from '../lib/jstDate'
import { toCustomerMessage, toErrorMessageAsync } from '../lib/errorUtils'
import { isPaidPlan } from '../lib/planUtils'
import { sendLinkMessage } from '../lib/liffLinkMessage'
import { usePublicBookingResources } from '../hooks/usePublicBookingResources'
import { fetchPublicStoreInfo } from '../lib/publicStoreInfo'
import { getBookingTheme } from '../lib/bookingTheme'
import type { StoreMenu, StoreStaff } from '../types/storeResources'
import { Calendar, User, Check, CheckCircle, Loader2, AlertCircle, Grid, Clock, Edit2, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import liff from '@line/liff'
import BookingHeader from '../components/booking/BookingHeader'
import { DEFAULT_LOGO_LAYOUT, normalizeLogoLayout, type LogoLayout } from '../lib/bookingLogoLayout'
import LiffModal from '../components/liff/LiffModal'
import LiffToast from '../components/liff/LiffToast'

/** booking Edge Function の認証系メッセージか判定 */
function isBookingLineAuthMessage(msg: string): boolean {
  return (
    msg.includes('LINE ログイン') ||
    msg.includes('認証が期限切れ') ||
    msg.includes('認証トークン')
  )
}

interface CustomerInfo {
	real_name?: string | null
	furigana?: string | null
}

interface ReservationSummary {
	id: string
	start_time: string
	end_time?: string | null
	status?: string | null
	staff_id?: string | null
	menu_id?: string | null
  staff?: StoreStaff | null
  menu?: (StoreMenu & { duration_minutes?: number }) | null
}

export default function Booking() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'loading' | 'error' | 'staff_select' | 'menu_select' | 'date' | 'info' | 'confirm' | 'complete' | 'existing_reservation'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [checkingUser, setCheckingUser] = useState(false)
  
  // Store Data
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeSettings, setStoreSettings] = useState({
    name: '',
    liff_template_id: 'simple',
    liff_theme_color: '#00c3dc',
    liff_logo_url: '',
    liff_logo_layout: DEFAULT_LOGO_LAYOUT as LogoLayout,
    booking_system_type: 'generic',
    slot_interval_minutes: 60,
    capacity_per_slot: 1,
    max_booking_days: 60,
    business_hours: null as Record<string, { start: string; end: string }[]> | null,
    booking_enable_party_size: false,
    booking_enable_staff: false,
    booking_enable_menu: false,
  })

  // Salon/Restaurant Data
  const {
    staffList,
    menuList,
    specialDates,
    error: resourcesError,
    setStaffList,
    setMenuList,
    setSpecialDates,
  } = usePublicBookingResources(storeId)
  const [selectedStaff, setSelectedStaff] = useState<StoreStaff | null>(null)
  const [selectedMenu, setSelectedMenu] = useState<StoreMenu | null>(null)
  const [partySize, setPartySize] = useState<number>(1)

  // ヘルパー関数：機能フラグに基づいて最初のステップを決定
  const getInitialStep = useCallback((): 'staff_select' | 'menu_select' | 'date' => {
    // 機能フラグを優先（booking_enable_* が設定されている場合）
    if (storeSettings.booking_enable_staff) {
      return 'staff_select'
    }
    if (storeSettings.booking_enable_menu) {
      return 'menu_select'
    }
    // フラグがすべてOFFの場合は日付選択から
    return 'date'
  }, [storeSettings.booking_enable_staff, storeSettings.booking_enable_menu])
  
  // UI State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })
  const [toastConfig, setToastConfig] = useState<{
    isVisible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({
    isVisible: false,
    message: '',
    type: 'success',
  })

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToastConfig({ isVisible: true, message, type })
  }, [])

  const hideToast = () => {
    setToastConfig(prev => ({ ...prev, isVisible: false }))
  }

  const showModal = (title: string, message: string, onConfirm: () => void, confirmText = 'はい', cancelText = 'いいえ') => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      onConfirm,
      confirmText,
      cancelText
    })
  }

  const hideModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }))
  }
  
  // Reservation Data
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeReservations, setActiveReservations] = useState<ReservationSummary[]>([])
  const [modifyingReservationId, setModifyingReservationId] = useState<string | null>(null)
  
  // 表形式用：複数日のスロット情報 { "2026-01-04": { "10:00": true, "11:00": false, ... }, ... }
  const [multiDateSlots, setMultiDateSlots] = useState<Record<string, Record<string, boolean>>>({})
  const [loadingMultiDateSlots, setLoadingMultiDateSlots] = useState(false)
  const [displayDates, setDisplayDates] = useState<string[]>([]) // 表示する日付リスト
  const [allTimeSlots, setAllTimeSlots] = useState<string[]>([]) // 全時間帯のリスト

  // Special Dates (臨時休業・営業時間上書き) は usePublicBookingResources から取得

  // User Data
  const [lineUserId, setLineUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [pictureUrl, setPictureUrl] = useState('')
  const [existingCustomer, setExistingCustomer] = useState<CustomerInfo | null>(null)
  const [realName, setRealName] = useState('')
  const [furigana, setFurigana] = useState('')

  // Helper to parse business hours (Frontend version for Preview)
  const getBusinessHoursForDate = useCallback((dateStr: string) => {
    // 特別日付をチェック (臨時休業・営業時間上書き)
    const special = specialDates[dateStr]
    if (special?.is_closed) {
      return [] // 臨時休業日
    }
    if (special?.override_hours && Array.isArray(special.override_hours) && special.override_hours.length > 0) {
      return special.override_hours // 営業時間上書き
    }
    
    if (!storeSettings.business_hours) return [{ start: '10:00', end: '20:00' }]
    
    try {
      const dayIndex = getJstDayOfWeek(dateStr)
      const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
      const dayKey = days[dayIndex]
      
      const hours = (storeSettings.business_hours as Record<string, { start: string; end: string }[]>)[dayKey]
      if (Array.isArray(hours) && hours.length > 0) {
        return hours.filter((h: { start: string; end: string }) => h.start && h.end)
      }
      return [] // Closed
    } catch (e) {
      console.error('Error parsing business hours', e)
      return []
    }
  }, [storeSettings.business_hours, specialDates])
  
  // 表形式用：複数日のスロット情報を一括取得
  const fetchMultiDateSlots = useCallback(async () => {
    if (!storeId) return
    
    setLoadingMultiDateSlots(true)
    
    // 表示する日付を生成（7日間）
    const dates: string[] = []
    const displayDays = Math.min(7, storeSettings.max_booking_days || 14)
    for (let i = 0; i < displayDays; i++) {
      dates.push(getJstDateStringWithOffset(i))
    }
    setDisplayDates(dates)
    
    // 各日のスロット情報を取得
    const slotsMap: Record<string, Record<string, boolean>> = {}
    const allTimes = new Set<string>()
    
    // プレビューモードでは営業時間からローカルでスロット生成
    if (window.self !== window.top || lineUserId === 'PREVIEW_USER') {
      const interval = storeSettings.slot_interval_minutes || 60
      
      for (const dateStr of dates) {
        const businessHours = getBusinessHoursForDate(dateStr)
        if (businessHours.length === 0) {
          slotsMap[dateStr] = {}
          continue
        }
        
        const dateSlots: Record<string, boolean> = {}
        businessHours.forEach(slot => {
          const [startH, startM] = slot.start.split(':').map(Number)
          const [endH, endM] = slot.end.split(':').map(Number)
          
          const [y, m, dd] = dateStr.split('-').map(Number)
          const startTime = new Date(y, m - 1, dd)
          startTime.setHours(startH, startM, 0, 0)
          
          const endTime = new Date(y, m - 1, dd)
          endTime.setHours(endH, endM, 0, 0)
          
          const now = new Date()
          let cursor = new Date(startTime)
          
          while (cursor < endTime) {
            const slotEnd = new Date(cursor.getTime() + interval * 60000)
            if (slotEnd > endTime) break
            
            const timeStr = `${String(cursor.getHours()).padStart(2, '0')}:${String(cursor.getMinutes()).padStart(2, '0')}`
            allTimes.add(timeStr)
            
            // 過去の時間は不可
            dateSlots[timeStr] = cursor >= now
            cursor = slotEnd
          }
        })
        slotsMap[dateStr] = dateSlots
      }
    } else {
      // 通常モード：APIから取得（並列処理）
      const modifyingRes = modifyingReservationId
        ? activeReservations.find((r) => r.id === modifyingReservationId)
        : undefined

      const results = await Promise.all(
        dates.map(async (dateStr) => {
          try {
            const { data, error, response } = await supabase.functions.invoke('booking', {
              body: {
                action: 'get_available_slots',
                store_id: storeId,
                date: dateStr,
                menu_id: selectedMenu?.id || null,
                staff_id: selectedStaff?.id ?? modifyingRes?.staff_id ?? null,
                line_user_id: lineUserId || null,
                reservation_id: modifyingReservationId ?? undefined,
                accessToken: (() => {
                  try { return liff.getAccessToken() } catch { return null }
                })(),
                idToken: (() => {
                  try { return liff.getIDToken() } catch { return null }
                })(),
              }
            })
            if (error) {
              const msg = await toErrorMessageAsync(error, response)
              console.error('[Booking] get_available_slots failed:', dateStr, msg)
              if (modifyingReservationId) {
                showToast(`空き枠の取得に失敗しました。\n${msg}`, 'error')
              }
              return { dateStr, slots: {} as Record<string, boolean> }
            }
            const dateSlots: Record<string, boolean> = {}
            if (data?.slots) {
              data.slots.forEach((s: { time: string; available: boolean }) => {
                dateSlots[s.time] = s.available
                allTimes.add(s.time)
              })
            }
            return { dateStr, slots: dateSlots }
          } catch (err) {
            console.error('[Booking] get_available_slots exception:', dateStr, err)
            return { dateStr, slots: {} as Record<string, boolean> }
          }
        })
      )
      
      results.forEach(({ dateStr, slots }) => {
        slotsMap[dateStr] = slots
      })
    }
    
    // 時間帯をソート
    const sortedTimes = Array.from(allTimes).sort((a, b) => {
      const [aH, aM] = a.split(':').map(Number)
      const [bH, bM] = b.split(':').map(Number)
      return aH * 60 + aM - (bH * 60 + bM)
    })
    
    setAllTimeSlots(sortedTimes)
    setMultiDateSlots(slotsMap)
    setLoadingMultiDateSlots(false)
  }, [storeId, storeSettings.max_booking_days, storeSettings.slot_interval_minutes, selectedMenu?.id, selectedStaff?.id, getBusinessHoursForDate, lineUserId, modifyingReservationId, activeReservations, showToast])

  const fetchStore = useCallback(async () => {
    // In production, store_id should be passed via query param ?store_id=...
    const params = new URLSearchParams(window.location.search)
    
    // Check for page redirection (e.g. Member Card)
    const page = params.get('page')
    if (page === 'member-card') {
      navigate('/member-card' + window.location.search)
      return
    }

    let targetStoreId = params.get('store_id')

    let data: Awaited<ReturnType<typeof fetchPublicStoreInfo>> = null
    try {
      data = await fetchPublicStoreInfo(targetStoreId)
    } catch (e) {
      console.error('Failed to fetch store info:', e)
    }

    if (!targetStoreId) {
      // Fallback: 店舗が1つしか無い環境に限り、その店舗を使う。
      // 複数店舗があるのに「最初の1件」を採ると、別テナントの予約ページを
      // 出してしまう（他店の予約枠・メニュー・スタッフが見えることになる）。
      // 判定自体は get_store_public_info がサーバー側（サービスロール）で行う。
      if (!data) {
        console.error('store_id が指定されておらず、店舗を一意に決められません')
        setStep('error')
        setErrorMsg('店舗情報が見つかりませんでした。お手数ですが、店舗からご案内した予約ページのリンクから開き直してください。')
        return
      }
      targetStoreId = data.id
    }

    if (targetStoreId && !data) {
      setStep('error')
      setErrorMsg('店舗情報を読み込めませんでした。予約ページのURLをご確認のうえ、時間をおいてもう一度お試しください。')
      return
    }

    if (data) {
      if (data.name) document.title = data.name

      // Check Plan
      let isPro = false
      try {
        const { data: plan, error: planError } = await supabase.rpc('get_store_plan', { p_store_id: targetStoreId })
        if (planError) {
          console.error('Failed to check plan:', planError)
        } else {
          isPro = isPaidPlan(plan)
        }
      } catch (e) {
        console.error('Error checking plan:', e)
      }

      setStoreSettings({
        name: data.name || '',
        liff_template_id: isPro ? (data.liff_template_id || 'simple') : 'simple',
        liff_theme_color: isPro ? (data.liff_theme_color || '#00c3dc') : '#00c3dc',
        liff_logo_url: isPro ? (data.liff_logo_url || '') : '',
        liff_logo_layout: normalizeLogoLayout(data.liff_logo_layout),
        booking_system_type: data.booking_system_type || 'generic',
        slot_interval_minutes: data.slot_interval_minutes || 60,
        capacity_per_slot: data.capacity_per_slot || 1,
        max_booking_days: data.max_booking_days || 60,
        business_hours: data.business_hours || null,
        booking_enable_party_size: data.booking_enable_party_size ?? false,
        booking_enable_staff: data.booking_enable_staff ?? false,
        booking_enable_menu: data.booking_enable_menu ?? false,
      })
    }

    if (targetStoreId) {
      setStoreId(targetStoreId)
    } else {
        setStep('error')
        setErrorMsg('店舗情報が見つかりませんでした。')
    }
  }, [navigate])

  const initializeLiff = useCallback(async () => {
    // Preview Mode Check (iframe)
    if (window.self !== window.top) {
      console.log('Running in Preview Mode (iframe)')
      setLineUserId('PREVIEW_USER')
      setDisplayName('プレビュー太郎')
      await fetchStore()
      return
    }

    try {
      const LIFF_ID = import.meta.env.VITE_LIFF_ID
      if (!LIFF_ID) {
        throw new Error('VITE_LIFF_ID が設定されていません')
      }
      
      if (!liff.id) {
        await liff.init({
          liffId: LIFF_ID,
          withLoginOnExternalBrowser: true,
        })
      }

      if (!liff.isLoggedIn()) {
        liff.login()
        return
      }

      const profile = await liff.getProfile()
      setLineUserId(profile.userId)
      setDisplayName(profile.displayName)
      setPictureUrl(profile.pictureUrl || '')

      // Get Store ID from LIFF context (liff.getContext().endpointUrl params?) 
      // or for now, fetch the first store as fallback
      await fetchStore()
      
    } catch (error) {
      console.error('LIFF Initialization failed', error)
      // Fallback for local development (if not in LINE)
      if (import.meta.env.DEV) {
        console.log('Running in Dev mode, using mock user')
        setLineUserId('U_MOCK_USER_ID')
        setDisplayName('Mock User')
        await fetchStore()
      } else {
        setStep('error')
        console.error('LIFF init failed:', error)
        setErrorMsg('LINEアプリの読み込みに失敗しました。LINEアプリからこのページを開き直してください。')
      }
    }
  }, [fetchStore])

  useEffect(() => {
    initializeLiff()
  }, [initializeLiff])

  // Set default date to today (Local Time)
  useEffect(() => {
    if (!date) {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      setDate(`${year}-${month}-${day}`)
    }
  }, [date])

  // 表形式：日付ステップに入ったときに複数日のスロットを取得
  useEffect(() => {
    if (step === 'date' && storeId) {
      fetchMultiDateSlots()
    }
  }, [step, storeId, fetchMultiDateSlots])

  // Listen for settings updates from parent window (LineSettings.tsx)
  // Only accept messages from trusted origins; defer changes while user is mid-flow.
  useEffect(() => {
    const TRUSTED_ORIGINS = [
      window.location.origin,
      'https://itoguchi.vercel.app',
      'https://line-auto-pilot.vercel.app',
      'http://localhost:5173',
    ]

    const activeFlowSteps = new Set(['info', 'confirm', 'complete'])

    const handleMessage = (event: MessageEvent) => {
      if (!TRUSTED_ORIGINS.includes(event.origin)) return
      if (event.data?.type !== 'UPDATE_SETTINGS' || !event.data?.settings) return

      // Defer settings changes while user is filling in info or confirming
      if (activeFlowSteps.has(step)) return
        
      const newSettings = event.data.settings
      
      const newEnablePartySize = newSettings.booking_enable_party_size ?? false
      const newEnableStaff = newSettings.booking_enable_staff ?? false
      const newEnableMenu = newSettings.booking_enable_menu ?? false
      
      setStoreSettings(prev => {
        const flagsChanged = 
          prev.booking_enable_party_size !== newEnablePartySize ||
          prev.booking_enable_staff !== newEnableStaff ||
          prev.booking_enable_menu !== newEnableMenu ||
          prev.booking_system_type !== newSettings.booking_system_type

        if (flagsChanged) {
          if (newEnableStaff) {
            setStep('staff_select')
          } else if (newEnableMenu) {
            setStep('menu_select')
          } else {
            setStep('date')
          }
          setSelectedStaff(null)
          setSelectedMenu(null)
          setPartySize(1)
        }
        return { 
          ...prev, 
          ...newSettings,
          booking_enable_party_size: newEnablePartySize,
          booking_enable_staff: newEnableStaff,
          booking_enable_menu: newEnableMenu,
        }
      })

      if (event.data.staffList) setStaffList(event.data.staffList)
      if (event.data.menuList) setMenuList(event.data.menuList)
      if (event.data.specialDates) setSpecialDates(event.data.specialDates)
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [step, setStaffList, setMenuList])

  const isPreviewMode = useCallback(() => {
    return window.self !== window.top || lineUserId === 'PREVIEW_USER'
  }, [lineUserId])

  // 設定画面のプレビュー（iframe）で、店舗情報の読み込みが終わったら親に知らせる。
  // 親は未保存の設定（ロゴ・配置・色など）をここで送り直す。
  const previewReadySent = useRef(false)
  useEffect(() => {
    if (previewReadySent.current) return
    if (window.self === window.top) return
    if (step === 'loading' || step === 'error') return
    previewReadySent.current = true
    window.parent.postMessage({ type: 'BOOKING_PREVIEW_READY' }, window.location.origin)
  }, [step])

  const getLiffAccessToken = useCallback((): string | null => {
    try {
      const t = liff.getAccessToken()
      if (t) return t
    } catch {
      // LIFF 未初期化
    }
    return null
  }, [])

  const getLiffIdToken = useCallback((): string | null => {
    try {
      const t = liff.getIDToken()
      if (t) return t
    } catch {
      // LIFF 未初期化
    }
    return null
  }, [])

  const checkCustomer = useCallback(async () => {
    setCheckingUser(true)
    try {
      const accessToken = getLiffAccessToken()
      const idToken = getLiffIdToken()


      const { data, error, response } = await supabase.functions.invoke('booking', {
        body: {
          action: 'check_customer',
          store_id: storeId,
          line_user_id: lineUserId,
          accessToken,
          idToken,
        }
      })
      
      if (error) {
        const msg = await toErrorMessageAsync(error, response)
        if (isBookingLineAuthMessage(msg)) {
          showToast(`顧客情報の取得に失敗しました。\n${msg}`, 'error')
        }
        throw error
      }
      
      
      if (data?.customer) {
        setExistingCustomer(data.customer as CustomerInfo)
        if (data.customer.real_name) setRealName(data.customer.real_name)
        if (data.customer.furigana) setFurigana(data.customer.furigana)
      } else {
        setExistingCustomer(null)
        setRealName('')
        setFurigana('')
      }
    } catch (e) {
      console.error('Failed to check customer:', e)
    } finally {
      setCheckingUser(false)
    }
  }, [lineUserId, storeId, getLiffAccessToken, getLiffIdToken, showToast])

  const checkReservation = useCallback(async () => {
    try {
      const accessToken = getLiffAccessToken()
      const idToken = getLiffIdToken()

      const { data, error, response } = await supabase.functions.invoke('booking', {
        body: {
          action: 'get_active_reservation',
          store_id: storeId,
          line_user_id: lineUserId,
          accessToken,
          idToken,
        }
      })
      
      if (error) {
        const msg = await toErrorMessageAsync(error, response)
        if (isBookingLineAuthMessage(msg)) {
          showToast(`予約状況の確認に失敗しました。\n${msg}`, 'error')
        }
        setStep(getInitialStep())
        return
      }
      
      if (data?.reservations && data.reservations.length > 0) {
        setActiveReservations(data.reservations as ReservationSummary[])
        setStep('existing_reservation')
      } else {
        // Determine initial step based on feature flags
        setStep(getInitialStep())
      }
    } catch (e) {
      console.error('Failed to check reservation:', e)
      const msg = await toErrorMessageAsync(e)
      if (isBookingLineAuthMessage(msg)) {
        showToast(`予約状況の確認に失敗しました。\n${msg}`, 'error')
      }
      setStep(getInitialStep())
    }
  }, [lineUserId, storeId, getInitialStep, getLiffAccessToken, getLiffIdToken, showToast])

  // 仮押さえ解除のヘルパー関数
  const releaseHold = useCallback(async () => {
    // プレビューモードでは仮押さえをスキップ
    if (isPreviewMode()) {
      console.log('Skipping release_hold in preview mode')
      return
    }
    if (!storeId || !lineUserId) return
    try {
      await supabase.functions.invoke('booking', {
        body: {
          action: 'release_hold',
          store_id: storeId,
          line_user_id: lineUserId,
          accessToken: getLiffAccessToken(),
          idToken: getLiffIdToken(),
        }
      })
      console.log('Hold released')
    } catch (e) {
      console.error('Failed to release hold:', e)
    }
  }, [storeId, lineUserId, isPreviewMode, getLiffAccessToken, getLiffIdToken])

  // ページ離脱時に仮押さえを解除
  useEffect(() => {
    return () => {
      releaseHold()
    }
  }, [releaseHold])

  useEffect(() => {
    if (storeId && lineUserId) {
      // Preview mode (iframe) - skip reservation check, wait for settings from parent
      if (window.self !== window.top) {
        // プレビューモードでは初期ステップを設定して待機
        setStep(getInitialStep())
        return
      }
      
      const init = async () => {
        await checkCustomer()
        await checkReservation()
      }
      init()
    }
  }, [checkCustomer, checkReservation, lineUserId, storeId, getInitialStep])

  const handleCancelReservation = async (reservationId: string) => {
    showModal(
      '予約キャンセル',
      'この予約をキャンセルしますか？',
      async () => {
        hideModal()
        setLoading(true)
        try {
          const accessToken = getLiffAccessToken()
          const idToken = getLiffIdToken()

          const { data, error, response } = await supabase.functions.invoke('booking', {
            body: {
              action: 'cancel_reservation',
              reservation_id: reservationId,
              store_id: storeId,
              line_user_id: lineUserId,
              accessToken,
              idToken,
            }
          })

          if (error) {
            const msg = await toErrorMessageAsync(error, response)
            showToast(`キャンセルに失敗しました。\n${msg}`, 'error')
            return
          }
          if (data && typeof data === 'object' && data !== null && 'error' in data) {
            const errMsg = (data as { error: unknown }).error
            if (typeof errMsg === 'string' && errMsg.length > 0) {
              showToast(`キャンセルに失敗しました。\n${errMsg}`, 'error')
              return
            }
          }

          const updated = activeReservations.filter(r => r.id !== reservationId)
          setActiveReservations(updated)
          showToast('予約をキャンセルしました。', 'success')
          void sendLinkMessage((data as { link_message?: unknown } | null)?.link_message)
          
          if (updated.length === 0) {
            setStep(getInitialStep())
          }
        } catch (e) {
          console.error('Failed to cancel reservation:', e)
          const msg = await toErrorMessageAsync(e)
          showToast(`キャンセルに失敗しました。\n${msg}`, 'error')
        } finally {
          setLoading(false)
        }
      },
      '予約をキャンセル',
      '戻る'
    )
  }

  const handleModifyStart = (reservationId: string) => {
    const res = activeReservations.find((r) => r.id === reservationId)
    setModifyingReservationId(reservationId)

    const staffId = res?.staff_id ?? res?.staff?.id
    const menuId = res?.menu_id ?? res?.menu?.id

    if (res) {
      if (staffId) {
        const staff = staffList.find((s) => s.id === staffId)
        if (staff) setSelectedStaff(staff)
      }
      if (menuId) {
        const menu = menuList.find((m) => m.id === menuId)
        if (menu) setSelectedMenu(menu)
      }
      setDate(getJstDateString(new Date(res.start_time)))
      setTime('')
    } else {
      setSelectedStaff(null)
      setSelectedMenu(null)
      setDate('')
      setTime('')
    }

    const staffReady =
      !storeSettings.booking_enable_staff ||
      staffList.length === 0 ||
      !!(staffId && staffList.some((s) => s.id === staffId))
    const menuReady =
      !storeSettings.booking_enable_menu ||
      menuList.length === 0 ||
      !!(menuId && menuList.some((m) => m.id === menuId))

    if (!staffReady) {
      setStep('staff_select')
    } else if (!menuReady) {
      setStep('menu_select')
    } else {
      setStep('date')
    }
  }

  const handleSubmit = async () => {
    // Preview mode check (running in iframe)
    if (window.self !== window.top) {
      setLoading(true)
      // Simulate network delay
      setTimeout(() => {
        setLoading(false)
        setStep('complete')
      }, 800)
      return
    }

    if (!storeId) return
    setLoading(true)
    try {
      let currentPictureUrl = pictureUrl
      let currentDisplayName = displayName

      let accessToken = getLiffAccessToken()
      let idToken = getLiffIdToken()
      if (!accessToken && !idToken) {
        showToast('LINE ログインの確認が必要です。ログイン画面を開きます。', 'error')
        try {
          liff.login()
        } catch (e) {
          console.error('liff.login failed:', e)
        }
        return
      }

      try {
        if (liff.isInClient() || liff.isLoggedIn()) {
          const profile = await liff.getProfile()
          currentPictureUrl = profile.pictureUrl || ''
          currentDisplayName = profile.displayName || ''
          setPictureUrl(currentPictureUrl)
          setDisplayName(currentDisplayName)
        }
      } catch {
        // プロフィール更新失敗は無視
      }

      accessToken = getLiffAccessToken()
      idToken = getLiffIdToken()
      if (!accessToken && !idToken) {
        showToast('LINE の認証トークンを取得できませんでした。ログイン画面を開きます。', 'error')
        try {
          liff.login()
        } catch (e) {
          console.error('liff.login failed:', e)
        }
        return
      }

      const action = modifyingReservationId ? 'update_reservation' : 'create_reservation'
      const requestBody = {
        action,
        store_id: storeId,
        line_user_id: lineUserId,
        display_name: currentDisplayName,
        profile_picture_url: currentPictureUrl,
        real_name: realName,
        furigana: furigana,
        date,
        time,
        staff_id: selectedStaff?.id,
        menu_id: selectedMenu?.id,
        reservation_id: modifyingReservationId,
        // 人数はサーバー側に専用の項目がないため、店舗が予約一覧で見られるようメモに残す
        memo: storeSettings.booking_enable_party_size ? `人数: ${partySize}名` : undefined,
        accessToken,
        idToken,
      }
      
      const { data, error, response } = await supabase.functions.invoke('booking', {
        body: requestBody
      })

      if (error) {
        const errorMessage = await toErrorMessageAsync(error, response)
        showToast(`予約に失敗しました。\n${toCustomerMessage(errorMessage)}`, 'error')
        return
      }
      if (data && typeof data === 'object' && data !== null && 'error' in data) {
        const errMsg = (data as { error: unknown }).error
        if (typeof errMsg === 'string' && errMsg.length > 0) {
          showToast(`予約に失敗しました。\n${toCustomerMessage(errMsg)}`, 'error')
          return
        }
      }

      setStep('complete')
      setModifyingReservationId(null) // Reset modification state

      // 確認メッセージをトークへ送る。Bot 側の ID との紐付けと、予約内容のリッチメッセージ返信のため。
      // 送れなくても予約は完了しているので、待たずに実行する。
      void sendLinkMessage((data as { link_message?: unknown } | null)?.link_message)
    } catch (error: unknown) {
      console.error('Booking failed:', error)
      const errorMessage = await toErrorMessageAsync(error)
      showToast(`予約に失敗しました。\n${toCustomerMessage(errorMessage)}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // 見た目は lib/bookingTheme.ts に集約（色・角丸・影は CSS 変数 --bk-*）。container の style に vars を渡す
  const theme = getBookingTheme(storeSettings.liff_template_id, storeSettings.liff_theme_color)

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: storeSettings.liff_theme_color }} />
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-6 rounded-xl shadow-sm text-center max-w-sm w-full">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">エラーが発生しました</h2>
          <p className="text-gray-600">{errorMsg}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={theme.container} style={theme.vars}>
      <LiffToast 
        isVisible={toastConfig.isVisible}
        message={toastConfig.message}
        type={toastConfig.type}
        onClose={hideToast}
        theme={theme}
      />
      <LiffModal
        isOpen={modalConfig.isOpen}
        onClose={hideModal}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
        theme={theme}
        isLoading={loading}
      />
      <div className={theme.card} style={theme.cardStyle}>
        <BookingHeader
          theme={theme}
          logoUrl={storeSettings.liff_logo_url}
          storeName={storeSettings.name}
          layout={normalizeLogoLayout(storeSettings.liff_logo_layout)}
        />

        <div className="p-6">
          {/* Debug Info (Only in Dev) */}
          {import.meta.env.DEV && (
            <div className="mb-6 p-2 bg-gray-100 rounded text-xs text-gray-600">
              <p className="font-bold">DEV MODE: {displayName}</p>
              <p className="truncate">{lineUserId}</p>
            </div>
          )}

          {step === 'existing_reservation' && activeReservations.length > 0 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className={theme.title} style={theme.titleStyle}>
                <CheckCircle color={theme.iconColor} /> 現在の予約
              </h2>

              <div className="space-y-4 mb-6">
                {activeReservations.map((res) => (
                  <div key={res.id} className={`${theme.infoBox} relative`}>
                    <dl className={theme.infoRows}>
                      <div className="flex justify-between gap-4">
                        <dt className={theme.infoLabel}>日時</dt>
                        <dd className={theme.infoValue}>
                          {new Date(res.start_time).toLocaleDateString('ja-JP')} {new Date(res.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                        </dd>
                      </div>

                      {/* 担当者表示 */}
                      {res.staff?.name && (
                        <div className="flex justify-between gap-4">
                          <dt className={theme.infoLabel}>担当</dt>
                          <dd className={theme.infoValue}>{res.staff.name}</dd>
                        </div>
                      )}

                      {/* メニュー表示 */}
                      {res.menu?.name && (
                        <div className="flex justify-between gap-4">
                          <dt className={`${theme.infoLabel} whitespace-nowrap`}>メニュー</dt>
                          <dd className={theme.infoValue}>
                            {res.menu.name}
                            {res.menu.price ? ` (¥${res.menu.price.toLocaleString()})` : ''}
                          </dd>
                        </div>
                      )}
                    </dl>

                    <div className="flex justify-end items-center mt-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleModifyStart(res.id)}
                          className={theme.actionButtonPrimary}
                        >
                          <Edit2 size={14} />
                          予約を変更
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCancelReservation(res.id)
                          }}
                          className={theme.actionButtonSecondary}
                        >
                          <XCircle size={14} />
                          予約をキャンセル
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 mt-8">
                <button 
                  onClick={() => {
                    setSelectedStaff(null)
                    setSelectedMenu(null)
                    setDate('')
                    setTime('')
                    
                    setStep(getInitialStep())
                  }}
                  className={theme.buttonPrimary}
                  style={theme.primaryStyle}
                >
                  新しい予約を追加する
                </button>
              </div>
            </motion.div>
          )}

          {step === 'staff_select' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className={theme.title} style={theme.titleStyle}>
                <User color={theme.iconColor} /> スタッフ選択
              </h2>
              
              <div className="space-y-4 mt-6">
                {staffList.length === 0 ? (
                  <div className={theme.emptySlotBox}>
                    {resourcesError
                      ? 'スタッフ情報を読み込めませんでした。時間をおいて開き直してください。'
                      : 'スタッフが登録されていません'}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {staffList.map((staff: StoreStaff) => (
                      <button
                        key={staff.id}
                        onClick={() => {
                          setSelectedStaff(staff)
                          // メニュー選択が有効なら次へ、そうでなければ日付選択へ
                          setStep(storeSettings.booking_enable_menu ? 'menu_select' : 'date')
                        }}
                        className={theme.selectableItem(selectedStaff?.id === staff.id)}
                      >
                        <div className={theme.avatar}>
                          {staff.image_url ? (
                            <img src={staff.image_url} alt={staff.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className={theme.avatarIcon} size={32} />
                          )}
                        </div>
                        <div className="text-center">
                          <div className={`font-bold text-sm ${theme.selectableItemText}`}>{staff.name}</div>
                          {staff.role && <div className={`text-xs mt-1 ${theme.selectableItemSubText}`}>{staff.role}</div>}
                        </div>
                      </button>
                    ))}
                    {/* "指名なし" Option */}
                    <button
                      onClick={() => {
                        setSelectedStaff(null)
                        // メニュー選択が有効なら次へ、そうでなければ日付選択へ
                        setStep(storeSettings.booking_enable_menu ? 'menu_select' : 'date')
                      }}
                      className={theme.selectableItem(false)}
                    >
                      <div className={theme.avatar}>
                        <User className={theme.avatarIcon} size={32} />
                      </div>
                      <div className={`font-bold text-sm ${theme.selectableItemText}`}>指名なし</div>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 'menu_select' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className={theme.title} style={theme.titleStyle}>
                <Grid color={theme.iconColor} /> {storeSettings.booking_system_type === 'restaurant' ? 'コース選択' : 'メニュー選択'}
              </h2>
              
              <div className="space-y-4 mt-6">
                {menuList.length === 0 ? (
                  <div className={theme.emptySlotBox}>
                    {resourcesError
                      ? 'メニューを読み込めませんでした。時間をおいて開き直してください。'
                      : 'メニューが登録されていません'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {menuList.map((menu: StoreMenu) => (
                      <button
                        key={menu.id}
                        onClick={() => {
                          setSelectedMenu(menu)
                          setStep('date')
                        }}
                        className={theme.selectableListItem(selectedMenu?.id === menu.id)}
                      >
                        <div>
                          <div className={`font-bold ${theme.selectableItemText}`}>{menu.name}</div>
                          {menu.description && <div className={`text-xs mt-1 line-clamp-2 ${theme.selectableItemSubText}`}>{menu.description}</div>}
                          <div className={`text-xs mt-2 flex gap-3 ${theme.selectableItemSubText}`}>
                            {menu.duration_minutes && <span className="flex items-center gap-1"><Clock size={12} /> {menu.duration_minutes}分</span>}
                            {menu.price && <span>¥{menu.price.toLocaleString()}</span>}
                          </div>
                        </div>
                        <div className={theme.radio(selectedMenu?.id === menu.id)}>
                          {selectedMenu?.id === menu.id && <Check size={14} strokeWidth={3} />}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => {
                    // スタッフ選択が有効なら戻る
                    if (storeSettings.booking_enable_staff) {
                      setStep('staff_select')
                    }
                  }}
                  className={`${theme.buttonSecondary} ${!storeSettings.booking_enable_staff ? 'hidden' : ''}`}
                >
                  戻る
                </button>
              </div>
            </motion.div>
          )}

          {step === 'date' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              {pictureUrl && (
                <div className="flex justify-center mb-4">
                  <img src={pictureUrl} alt={displayName} className="w-16 h-16 rounded-full object-cover" />
                </div>
              )}
              <h2 className={theme.title} style={theme.titleStyle}>
                <Calendar color={theme.iconColor} /> {modifyingReservationId ? '予約日時の変更' : '日時を選択'}
              </h2>
              
              {/* Selected Info Summary */}
              {(selectedStaff || selectedMenu || (storeSettings.booking_enable_party_size && partySize > 1)) && (
                <div className={theme.summaryBox}>
                  {storeSettings.booking_enable_party_size && (
                    <div className="flex justify-between">
                      <span className={theme.summaryLabel}>人数:</span>
                      <span className={theme.summaryValue}>{partySize}名</span>
                    </div>
                  )}
                  {selectedStaff && (
                    <div className="flex justify-between">
                      <span className={theme.summaryLabel}>指名スタッフ:</span>
                      <span className={theme.summaryValue}>{selectedStaff.name}</span>
                    </div>
                  )}
                  {selectedMenu && (
                    <>
                      <div className="flex justify-between">
                        <span className={theme.summaryLabel}>メニュー:</span>
                        <span className={theme.summaryValue}>{selectedMenu.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={theme.summaryLabel}>詳細:</span>
                        <span className={`${theme.summaryValue} flex items-center gap-2 text-sm`}>
                          {selectedMenu.duration_minutes && (
                            <span className="flex items-center gap-1">
                              <Clock size={14} /> {selectedMenu.duration_minutes}分
                            </span>
                          )}
                          {selectedMenu.price && (
                            <span>¥{selectedMenu.price.toLocaleString()}</span>
                          )}
                        </span>
                      </div>
                    </>
                  )}
                  {(selectedStaff || selectedMenu) && (
                    <button 
                      onClick={() => setStep(getInitialStep())}
                      className={theme.summaryLink}
                    >
                      選択し直す
                    </button>
                  )}
                </div>
              )}
              
              {modifyingReservationId && (
                <div className={theme.noticeBox}>
                  現在、予約の変更を行っています。新しい日時を選択してください。
                  <button 
                    onClick={() => {
                      setModifyingReservationId(null)
                      setStep('existing_reservation')
                    }}
                    className={theme.noticeLink}
                  >
                    変更を中止して戻る
                  </button>
                </div>
              )}
              
              <div className="space-y-6">
                {/* 人数選択（booking_enable_party_size が true の場合のみ表示） */}
                {storeSettings.booking_enable_party_size && (
                  <div>
                    <label className={theme.label}>人数</label>
                    <div className="flex items-center gap-4 mt-2">
                      <button
                        type="button"
                        onClick={() => setPartySize(Math.max(1, partySize - 1))}
                        disabled={partySize <= 1}
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-colors ${
                          partySize <= 1 
                            ? theme.partySizeDisabled 
                            : theme.partySizeEnabled
                        }`}
                      >
                        −
                      </button>
                      <div className={theme.partySizeText}>
                        {partySize}<span className="text-base font-normal ml-1">名</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPartySize(Math.min(20, partySize + 1))}
                        disabled={partySize >= 20}
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-colors ${
                          partySize >= 20 
                            ? theme.partySizeDisabled 
                            : theme.partySizePlus
                        }`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* ホットペッパー風：日時選択テーブル */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={theme.label}>日時を選択 {loadingMultiDateSlots && <span className="text-xs opacity-60 ml-2">読込中...</span>}</label>
                    {/* 凡例（上部右側） */}
                    <div className={`flex items-center gap-3 text-xs ${theme.slotTable.legendText}`}>
                      <span className="flex items-center gap-1">
                        <span className={`w-5 h-5 text-xs flex items-center justify-center font-bold [border-radius:var(--bk-r-chip)] ${theme.slotTable.legendAvailable}`}>◯</span>
                        可
                      </span>
                      <span className="flex items-center gap-1">
                        <span className={`w-5 h-5 text-xs flex items-center justify-center font-bold ${theme.slotTable.legendUnavailable}`}>×</span>
                        不可
                      </span>
                    </div>
                  </div>
                  
                  {loadingMultiDateSlots ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="animate-spin opacity-60" />
                    </div>
                  ) : allTimeSlots.length === 0 ? (
                    <div className={theme.emptySlotBox}>
                      予約可能な枠がありません
                    </div>
                  ) : (
                    <div className="overflow-x-auto -mx-2 px-2 max-h-[60vh] overflow-y-auto">
                      <table className="w-full border-collapse min-w-max">
                        {/* ヘッダー：日付（スティッキー） */}
                        <thead className="sticky top-0 z-20">
                          <tr>
                            <th className={`sticky left-0 z-30 p-2 text-xs font-semibold min-w-[50px] [background-color:var(--bk-card)] ${theme.slotTable.headerText}`}>
                              時間
                            </th>
                            {displayDates.map((dateStr) => {
                              const [, month, day] = dateStr.split('-').map(Number)
                              const dayIndex = getJstDayOfWeek(dateStr)
                              const dayName = ['日', '月', '火', '水', '木', '金', '土'][dayIndex]
                              const isSelected = date === dateStr
                              const isSunday = dayIndex === 0
                              const isSaturday = dayIndex === 6
                              return (
                                <th key={dateStr} className="p-0.5">
                                  <div className={`${theme.slotTable.headerCell} ${isSelected ? theme.slotTable.headerCellSelected : ''}`}>
                                    <div className={`text-[10px] font-semibold ${isSunday ? theme.slotTable.sundayText : isSaturday ? theme.slotTable.saturdayText : theme.slotTable.headerText}`}>
                                      {month}/{day}
                                    </div>
                                    <div className={`text-xs font-bold ${isSunday ? theme.slotTable.sundayText : isSaturday ? theme.slotTable.saturdayText : theme.slotTable.weekdayText}`}>
                                      {dayName}
                                    </div>
                                  </div>
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        {/* ボディ：時間帯 × 日付 */}
                        <tbody>
                          {allTimeSlots.map((timeStr) => (
                            <tr key={timeStr}>
                              <td className={theme.slotTable.timeCell}>
                                {timeStr}
                              </td>
                              {displayDates.map((dateStr) => {
                                const slotAvailable = multiDateSlots[dateStr]?.[timeStr]
                                const isSelected = date === dateStr && time === timeStr
                                const isAvailable = slotAvailable === true
                                const hasSlot = slotAvailable !== undefined
                                
                                return (
                                  <td key={`${dateStr}-${timeStr}`} className="p-0.5 text-center">
                                    {hasSlot ? (
                                      <button
                                        onClick={async () => {
                                          if (!isAvailable) return
                                          setDate(dateStr)
                                          setTime(timeStr)
                                          
                                          // プレビュー・予約変更時は仮押さえをスキップ（変更確定時に容量チェック）
                                          if (isPreviewMode() || modifyingReservationId) {
                                            return
                                          }
                                          
                                          // 仮押さえを実行
                                          try {
                                            const { data: holdData, error: holdError, response: holdResponse } =
                                              await supabase.functions.invoke('booking', {
                                                body: {
                                                  action: 'hold_slot',
                                                  store_id: storeId,
                                                  line_user_id: lineUserId,
                                                  display_name: displayName,
                                                  date: dateStr,
                                                  time: timeStr,
                                                  staff_id: selectedStaff?.id || null,
                                                  menu_id: selectedMenu?.id || null,
                                                  reservation_id: modifyingReservationId || null,
                                                  accessToken: getLiffAccessToken(),
                                                  idToken: getLiffIdToken(),
                                                }
                                              })
                                            if (holdError) {
                                              const msg = await toErrorMessageAsync(holdError, holdResponse)
                                              showToast(`仮押さえに失敗しました。\n${msg}`, 'error')
                                              if (isBookingLineAuthMessage(msg)) {
                                                try {
                                                  liff.login()
                                                } catch (loginErr) {
                                                  console.error('liff.login failed:', loginErr)
                                                }
                                              }
                                              return
                                            }
                                            if (
                                              holdData &&
                                              typeof holdData === 'object' &&
                                              holdData !== null &&
                                              'error' in holdData
                                            ) {
                                              const errMsg = (holdData as { error: unknown }).error
                                              if (typeof errMsg === 'string' && errMsg.length > 0) {
                                                showToast(`仮押さえに失敗しました。\n${errMsg}`, 'error')
                                                if (isBookingLineAuthMessage(errMsg)) {
                                                  try {
                                                    liff.login()
                                                  } catch (loginErr) {
                                                    console.error('liff.login failed:', loginErr)
                                                  }
                                                }
                                                return
                                              }
                                            }
                                            console.log('Slot held successfully')
                                          } catch (e) {
                                            console.error('Failed to hold slot:', e)
                                            const msg = await toErrorMessageAsync(e)
                                            showToast(`仮押さえに失敗しました。\n${msg}`, 'error')
                                          }
                                        }}
                                        disabled={!isAvailable}
                                        className={`w-10 h-10 text-base font-bold transition [border-radius:var(--bk-r-chip)] ${
                                          isSelected
                                            ? theme.slotTable.selectedBtn
                                            : isAvailable
                                              ? theme.slotTable.availableBtn
                                              : theme.slotTable.unavailableBtn
                                        }`}
                                      >
                                        {isSelected ? '✓' : isAvailable ? '◯' : '×'}
                                      </button>
                                    ) : (
                                      <div className={`w-10 h-10 flex items-center justify-center ${theme.slotTable.emptyCell}`}>
                                        −
                                      </div>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {/* 選択中の日時表示 */}
                  {date && time && (
                    <div className={theme.selectedDateBox}>
                      <span className={theme.selectedDateLabel}>選択中：</span>
                      <span className={theme.selectedDateValue}>
                        {(() => {
                          const [, month, day] = date.split('-').map(Number)
                          const dayName = ['日', '月', '火', '水', '木', '金', '土'][getJstDayOfWeek(date)]
                          return `${month}月${day}日(${dayName}) ${time}`
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                {(storeSettings.booking_enable_staff || storeSettings.booking_enable_menu) && (
                  <button 
                    onClick={() => {
                      setTime('') // 時間選択をクリア
                      releaseHold() // 仮押さえを解除
                      // メニュー選択が有効ならメニューへ、そうでなければスタッフへ
                      if (storeSettings.booking_enable_menu) {
                        setStep('menu_select')
                      } else if (storeSettings.booking_enable_staff) {
                        setStep('staff_select')
                      }
                    }}
                    className={theme.buttonSecondary}
                  >
                    戻る
                  </button>
                )}
                <button 
                  onClick={() => {
                    if (date && time) setStep('info')
                  }}
                  disabled={!date || !time}
                  className={`${theme.buttonPrimary} disabled:opacity-50 disabled:cursor-not-allowed`}
                  style={theme.primaryStyle}
                >
                  次へ進む
                </button>
              </div>
            </motion.div>
          )}

          {step === 'info' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className={theme.title} style={theme.titleStyle}>
                <User color={theme.iconColor} /> お客様情報
              </h2>

              {checkingUser ? (
                <div className="py-8 flex justify-center"><Loader2 className="animate-spin" color={theme.iconColor} /></div>
              ) : (
                <div className="space-y-4">
                  {existingCustomer?.real_name ? (
                    <div className={theme.infoBox}>
                      <p className={`text-sm mb-1 ${theme.infoLabel}`}>ようこそ、</p>
                      <p className="font-bold text-lg">{existingCustomer.real_name} 様</p>
                      <p className={`text-xs mt-2 ${theme.infoLabel}`}>※ご登録済みのお名前を使用します</p>
                    </div>
                  ) : (
                    <>
                      <div className={`${theme.infoBox} text-sm`}>
                        初回予約のため、お名前を入力してください。
                      </div>
                      <div>
                        <label className={theme.label}>お名前 (漢字)</label>
                        <input 
                          type="text" 
                          placeholder="例: 山田 太郎"
                          value={realName}
                          onChange={(e) => setRealName(e.target.value)}
                          className={theme.input}
                        />
                      </div>
                      <div>
                        <label className={theme.label}>フリガナ</label>
                        <input 
                          type="text" 
                          placeholder="例: ヤマダ タロウ"
                          value={furigana}
                          onChange={(e) => setFurigana(e.target.value)}
                          className={theme.input}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setStep('date')}
                  className={theme.buttonSecondary}
                >
                  戻る
                </button>
                <button 
                  onClick={() => {
                    if (existingCustomer?.real_name || (realName && furigana)) {
                      setStep('confirm')
                    }
                  }}
                  disabled={!existingCustomer?.real_name && (!realName || !furigana)}
                  className={`${theme.buttonPrimary} disabled:opacity-50 disabled:cursor-not-allowed`}
                  style={theme.primaryStyle}
                >
                  確認へ
                </button>
              </div>
            </motion.div>
          )}

          {step === 'confirm' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className={theme.title} style={theme.titleStyle}>
                <CheckCircle color={theme.iconColor} /> {modifyingReservationId ? '変更内容の確認' : '予約内容の確認'}
              </h2>

              <div className={`${theme.infoBox} mb-6`}>
                <dl className={theme.infoRows}>
                  <div className="flex justify-between gap-4">
                    <dt className={theme.infoLabel}>日時</dt>
                    <dd className={theme.infoValue}>{date} {time}</dd>
                  </div>
                  {storeSettings.booking_enable_party_size && (
                    <div className="flex justify-between gap-4">
                      <dt className={theme.infoLabel}>人数</dt>
                      <dd className={theme.infoValue}>{partySize}名</dd>
                    </div>
                  )}
                  {selectedStaff && (
                    <div className="flex justify-between gap-4">
                      <dt className={theme.infoLabel}>指名スタッフ</dt>
                      <dd className={theme.infoValue}>{selectedStaff.name}</dd>
                    </div>
                  )}
                  {selectedMenu && (
                    <div className="flex justify-between gap-4">
                      <dt className={theme.infoLabel}>メニュー</dt>
                      <dd className={theme.infoValue}>
                        {selectedMenu.name}
                        {selectedMenu.price ? ` (¥${selectedMenu.price.toLocaleString()})` : ''}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className={theme.infoLabel}>お名前</dt>
                    <dd className={theme.infoValue}>{realName}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className={theme.infoLabel}>フリガナ</dt>
                    <dd className={theme.infoValue}>{furigana}</dd>
                  </div>
                </dl>
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setStep('info')}
                  className={theme.buttonSecondary}
                >
                  修正する
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={loading}
                  className={`${theme.buttonPrimary} disabled:opacity-50`}
                  style={theme.primaryStyle}
                >
                  {loading ? <Loader2 className="animate-spin" /> : (modifyingReservationId ? '変更を確定する' : '予約を確定する')}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'complete' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 [background-color:var(--bk-accent)] [color:var(--bk-on-accent)]">
                <Check size={32} strokeWidth={3} />
              </div>
              <h2 className={theme.title} style={theme.titleStyle}>{modifyingReservationId ? '変更完了' : '予約完了'}</h2>
              <p className={`mt-2 mb-6 text-sm whitespace-nowrap ${theme.selectableItemSubText}`}>{modifyingReservationId ? '予約の変更が完了しました。' : 'ご予約ありがとうございます。'}</p>

              {/* Reservation Details Card for Screenshot */}
              <div className={`${theme.infoBox} text-left mb-8`}>
                {/* 予約日時 */}
                <div className="mb-4">
                  <div className={`text-xs mb-1 ${theme.infoLabel}`}>予約日時</div>
                  <div className="text-xl font-bold">{date} {time}</div>
                </div>

                {/* お名前 */}
                <div className="mb-4">
                  <div className={`text-xs mb-1 ${theme.infoLabel}`}>お名前</div>
                  <div className="text-lg font-bold">{realName} 様</div>
                </div>

                {/* 担当者（選択されている場合のみ表示） */}
                {selectedStaff && (
                  <div className="mb-4">
                    <div className={`text-xs mb-1 ${theme.infoLabel}`}>担当</div>
                    <div className="text-base font-semibold">{selectedStaff.name}</div>
                  </div>
                )}

                {/* メニュー（選択されている場合のみ表示） */}
                {selectedMenu && (
                  <div className="mb-4">
                    <div className={`text-xs mb-1 ${theme.infoLabel}`}>メニュー</div>
                    <div className="text-base font-semibold">{selectedMenu.name}</div>
                    <div className={`text-sm mt-1 ${theme.selectableItemSubText}`}>
                      {selectedMenu.duration_minutes && `${selectedMenu.duration_minutes}分`}
                      {selectedMenu.duration_minutes && selectedMenu.price && ' / '}
                      {selectedMenu.price && `¥${selectedMenu.price.toLocaleString()}`}
                    </div>
                  </div>
                )}

                {/* 人数（人数選択が有効で2名以上の場合のみ表示） */}
                {storeSettings.booking_enable_party_size && partySize > 1 && (
                  <div className="mb-4">
                    <div className={`text-xs mb-1 ${theme.infoLabel}`}>人数</div>
                    <div className="text-base font-semibold">{partySize}名</div>
                  </div>
                )}

                {/* 人数選択が有効で1名の場合も表示 */}
                {storeSettings.booking_enable_party_size && partySize === 1 && (
                  <div>
                    <div className={`text-xs mb-1 ${theme.infoLabel}`}>人数</div>
                    <div className="text-base font-semibold">{partySize}名</div>
                  </div>
                )}
              </div>

              <button 
                onClick={() => liff.closeWindow()}
                className="font-bold hover:underline [color:var(--bk-accent-text)]"
              >
                閉じる
              </button>
            </motion.div>
          )}
        </div>
      </div>
      
      {/* Debug Info / Store Name Footer */}
      <div className="mt-4 text-center text-[10px] pb-4 [color:var(--bk-muted)]">
        {storeSettings.name}
      </div>
    </div>
  )
}
