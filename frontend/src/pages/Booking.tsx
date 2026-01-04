import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStoreResources } from '../hooks/useStoreResources'
import type { StoreMenu, StoreStaff } from '../types/storeResources'
import { Calendar, User, CheckCircle, Loader2, AlertCircle, Grid, Clock, Edit2, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import liff from '@line/liff'
import LiffModal from '../components/liff/LiffModal'
import LiffToast from '../components/liff/LiffToast'

interface CustomerInfo {
	real_name?: string | null
	furigana?: string | null
}

interface ReservationSummary {
	id: string
	start_time: string
	end_time?: string | null
	status?: string | null
  staff?: StoreStaff | null
  menu?: StoreMenu | null
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
  const { staffList, menuList, setStaffList, setMenuList } = useStoreResources(storeId)
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

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastConfig({ isVisible: true, message, type })
  }

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
  
  // Special Dates (臨時休業・営業時間上書き)
  const [specialDates, setSpecialDates] = useState<Record<string, { is_closed: boolean; override_hours: { start: string; end: string }[] | null }>>({})
  
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
      // Parse YYYY-MM-DD as local date to get correct day of week
      const [y, m, d] = dateStr.split('-').map(Number)
      const dateObj = new Date(y, m - 1, d)
      const dayIndex = dateObj.getDay() // 0=Sun, 1=Mon...
      const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
      const dayKey = days[dayIndex]
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hours = (storeSettings.business_hours as any)[dayKey]
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
      const d = new Date()
      d.setDate(d.getDate() + i)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      dates.push(dateStr)
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
      const results = await Promise.all(
        dates.map(async (dateStr) => {
          try {
            const { data } = await supabase.functions.invoke('booking', {
              body: {
                action: 'get_available_slots',
                store_id: storeId,
                date: dateStr,
                menu_id: selectedMenu?.id || null,
                staff_id: selectedStaff?.id || null,
              }
            })
            const dateSlots: Record<string, boolean> = {}
            if (data?.slots) {
              data.slots.forEach((s: { time: string; available: boolean }) => {
                dateSlots[s.time] = s.available
                allTimes.add(s.time)
              })
            }
            return { dateStr, slots: dateSlots }
          } catch {
            return { dateStr, slots: {} }
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
  }, [storeId, storeSettings.max_booking_days, storeSettings.slot_interval_minutes, selectedMenu?.id, selectedStaff?.id, getBusinessHoursForDate, lineUserId])

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

    if (!targetStoreId) {
        // Fallback: Get first store
        const { data } = await supabase.from('stores').select('id, name, liff_template_id, liff_theme_color, liff_logo_url, booking_system_type, slot_interval_minutes, capacity_per_slot, max_booking_days, business_hours, booking_enable_party_size, booking_enable_staff, booking_enable_menu').limit(1).maybeSingle()
        targetStoreId = data?.id
        if (data) {
          if (data.name) document.title = data.name
          
          // Check Plan
          let isPro = false
          try {
            const { data: plan, error: planError } = await supabase.rpc('get_store_plan', { p_store_id: data.id })
            if (planError) {
              console.error('Failed to check plan:', planError)
            } else {
              isPro = plan === 'pro'
            }
          } catch (e) {
            console.error('Error checking plan:', e)
          }

          setStoreSettings({
            name: data.name || '',
            liff_template_id: isPro ? (data.liff_template_id || 'simple') : 'simple',
            liff_theme_color: isPro ? (data.liff_theme_color || '#00c3dc') : '#00c3dc',
            liff_logo_url: isPro ? (data.liff_logo_url || '') : '',
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
    } else {
        // Fetch specific store settings
        const { data } = await supabase.from('stores').select('name, liff_template_id, liff_theme_color, liff_logo_url, booking_system_type, slot_interval_minutes, capacity_per_slot, max_booking_days, business_hours, booking_enable_party_size, booking_enable_staff, booking_enable_menu').eq('id', targetStoreId).maybeSingle()
        if (data) {
          if (data.name) document.title = data.name

          // Check Plan
          let isPro = false
          try {
            const { data: plan, error: planError } = await supabase.rpc('get_store_plan', { p_store_id: targetStoreId })
            if (planError) {
              console.error('Failed to check plan:', planError)
            } else {
              isPro = plan === 'pro'
            }
          } catch (e) {
            console.error('Error checking plan:', e)
          }

          setStoreSettings({
            name: data.name || '',
            liff_template_id: isPro ? (data.liff_template_id || 'simple') : 'simple',
            liff_theme_color: isPro ? (data.liff_theme_color || '#00c3dc') : '#00c3dc',
            liff_logo_url: isPro ? (data.liff_logo_url || '') : '',
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
      
      await liff.init({ liffId: LIFF_ID })

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
        const msg = error instanceof Error ? error.message : String(error)
        setErrorMsg(`エラーが発生しました: ${msg}`)
      }
    }
  }, [fetchStore])

  useEffect(() => {
    initializeLiff()
  }, [initializeLiff])

  // Fetch special dates when storeId changes
  useEffect(() => {
    const fetchSpecialDates = async () => {
      if (!storeId) return
      
      try {
        const { data: dates } = await supabase
          .from('booking_special_dates')
          .select('date, is_closed, override_hours')
          .eq('store_id', storeId)
        
        if (dates) {
          const datesMap: Record<string, { is_closed: boolean; override_hours: { start: string; end: string }[] | null }> = {}
          dates.forEach((d: { date: string; is_closed: boolean; override_hours: { start: string; end: string }[] | null }) => {
            datesMap[d.date] = { is_closed: d.is_closed, override_hours: d.override_hours }
          })
          setSpecialDates(datesMap)
        }
      } catch (e) {
        console.error('Failed to fetch special dates:', e)
      }
    }
    
    fetchSpecialDates()
  }, [storeId])

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
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'UPDATE_SETTINGS' && event.data?.settings) {
        console.log('Received settings update:', event.data)
        
        const newSettings = event.data.settings
        
        // フラグの値を取得（undefined の場合は false）
        const newEnablePartySize = newSettings.booking_enable_party_size ?? false
        const newEnableStaff = newSettings.booking_enable_staff ?? false
        const newEnableMenu = newSettings.booking_enable_menu ?? false
        
        setStoreSettings(prev => {
          // Check if feature flags changed
          const flagsChanged = 
            prev.booking_enable_party_size !== newEnablePartySize ||
            prev.booking_enable_staff !== newEnableStaff ||
            prev.booking_enable_menu !== newEnableMenu ||
            prev.booking_system_type !== newSettings.booking_system_type

          // Always reset step based on new feature flags when they change
          if (flagsChanged) {
            // Reset step based on new feature flags
            setTimeout(() => {
              if (newEnableStaff) {
                setStep('staff_select')
              } else if (newEnableMenu) {
                setStep('menu_select')
              } else {
                setStep('date')
              }
              // Reset selections
              setSelectedStaff(null)
              setSelectedMenu(null)
              setPartySize(1)
            }, 0)
          }
          return { 
            ...prev, 
            ...newSettings,
            booking_enable_party_size: newEnablePartySize,
            booking_enable_staff: newEnableStaff,
            booking_enable_menu: newEnableMenu,
          }
        })

        // Update Staff & Menu Lists
        if (event.data.staffList) setStaffList(event.data.staffList)
        if (event.data.menuList) setMenuList(event.data.menuList)
        
        // Update Special Dates
        if (event.data.specialDates) {
          setSpecialDates(event.data.specialDates)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [setStaffList, setMenuList])

  const checkCustomer = useCallback(async () => {
    setCheckingUser(true)
    try {
      // Get access token for authentication
      let accessToken: string | null = null
      try {
        // LIFFが初期化されているか確認
        if (liff.isInClient() || liff.isLoggedIn()) {
          accessToken = liff.getAccessToken()
          console.log('[Booking] checkCustomer - accessToken:', accessToken ? 'obtained' : 'null')
        }
      } catch (liffError) {
        console.warn('[Booking] LIFF not initialized yet:', liffError)
      }

      console.log('[Booking] checkCustomer - store_id:', storeId, 'line_user_id:', lineUserId)

      const { data, error } = await supabase.functions.invoke('booking', {
        body: {
          action: 'check_customer',
          store_id: storeId,
          line_user_id: lineUserId,
          accessToken
        }
      })
      
      if (error) throw error
      
      console.log('[Booking] checkCustomer - response:', data)
      
      if (data?.customer) {
        setExistingCustomer(data.customer as CustomerInfo)
        if (data.customer.real_name) setRealName(data.customer.real_name)
        if (data.customer.furigana) setFurigana(data.customer.furigana)
        console.log('[Booking] Customer found:', data.customer.real_name, data.customer.furigana)
      } else {
        setExistingCustomer(null)
        setRealName('')
        setFurigana('')
        console.log('[Booking] Customer not found')
      }
    } catch (e) {
      console.error('Failed to check customer:', e)
    } finally {
      setCheckingUser(false)
    }
  }, [lineUserId, storeId])

  const checkReservation = useCallback(async () => {
    try {
      // Get access token for authentication
      let accessToken: string | null = null
      if (liff.isLoggedIn()) {
        accessToken = liff.getAccessToken()
      }

      const { data, error } = await supabase.functions.invoke('booking', {
        body: {
          action: 'get_active_reservation',
          store_id: storeId,
          line_user_id: lineUserId,
          accessToken
        }
      })
      
      if (error) throw error
      
      if (data?.reservations && data.reservations.length > 0) {
        setActiveReservations(data.reservations as ReservationSummary[])
        setStep('existing_reservation')
      } else {
        // Determine initial step based on feature flags
        setStep(getInitialStep())
      }
    } catch (e) {
      console.error('Failed to check reservation:', e)
      // Fallback
      setStep(getInitialStep())
    }
  }, [lineUserId, storeId, getInitialStep])

  // プレビューモードかどうかの判定
  const isPreviewMode = useCallback(() => {
    return window.self !== window.top || lineUserId === 'PREVIEW_USER'
  }, [lineUserId])

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
          line_user_id: lineUserId
        }
      })
      console.log('Hold released')
    } catch (e) {
      console.error('Failed to release hold:', e)
    }
  }, [storeId, lineUserId, isPreviewMode])

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
          // Get access token for authentication
          let accessToken: string | null = null
          if (liff.isLoggedIn()) {
            accessToken = liff.getAccessToken()
          }

          const { data, error } = await supabase.functions.invoke('booking', {
            body: {
              action: 'cancel_reservation',
              reservation_id: reservationId,
              store_id: storeId,
              line_user_id: lineUserId,
              accessToken
            }
          })

          if (error) throw error
          if (data?.error) throw new Error(data.error)

          const updated = activeReservations.filter(r => r.id !== reservationId)
          setActiveReservations(updated)
          showToast('予約をキャンセルしました。', 'success')
          
          if (updated.length === 0) {
            setStep(getInitialStep())
          }
        } catch (e) {
          console.error('Failed to cancel reservation:', e)
          showToast('キャンセルに失敗しました。', 'error')
        } finally {
          setLoading(false)
        }
      },
      '予約をキャンセル',
      '戻る'
    )
  }

  const handleModifyStart = (reservationId: string) => {
    setModifyingReservationId(reservationId)
    setStep(getInitialStep())
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
      // Ensure we have the latest profile info
      let currentPictureUrl = pictureUrl
      let currentDisplayName = displayName
      
      // Get access token for authentication
      let accessToken: string | null = null
      if (liff.isLoggedIn()) {
        accessToken = liff.getAccessToken()
        try {
          const profile = await liff.getProfile()
          currentPictureUrl = profile.pictureUrl || ''
          currentDisplayName = profile.displayName || ''
          setPictureUrl(currentPictureUrl)
          setDisplayName(currentDisplayName)
        } catch (e) {
          console.error('Failed to refresh profile:', e)
        }
      }

      const action = modifyingReservationId ? 'update_reservation' : 'create_reservation'
      const { data, error } = await supabase.functions.invoke('booking', {
        body: {
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
          reservation_id: modifyingReservationId, // Only used if action is update_reservation
          accessToken
        }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      setStep('complete')
      setModifyingReservationId(null) // Reset modification state
    } catch (error: unknown) {
      console.error('Booking failed:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      showToast(`予約に失敗しました。\n詳細: ${errorMessage}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Dynamic Styles based on Template
  const theme = (() => {
    const t = storeSettings.liff_template_id
    const c = storeSettings.liff_theme_color

    const common = {
      container: 'min-h-screen py-8 px-4 transition-colors duration-300 flex flex-col items-center justify-center',
      card: 'w-full max-w-md mx-auto overflow-hidden transition-all duration-300 relative',
      input: 'w-full p-3 outline-none transition-all duration-200',
    }

    switch (t) {
      case 'elegant':
        return {
          container: `${common.container} bg-[#F5F5F4] font-serif`,
          card: `${common.card} bg-white shadow-xl border border-[#E7E5E4] rounded-sm`,
          header: 'p-8 text-center border-b border-[#E7E5E4]',
          title: 'text-xl tracking-[0.2em] text-[#44403C] font-medium flex items-center justify-center gap-3',
          label: 'block text-xs font-bold text-[#78716C] mb-2 tracking-widest uppercase',
          input: `${common.input} bg-transparent border-b border-[#D6D3D1] focus:border-[#44403C] rounded-none px-0 text-[#44403C] placeholder-[#A8A29E]`,
          buttonPrimary: 'w-full py-4 bg-[#44403C] text-[#F5F5F4] uppercase tracking-[0.2em] text-xs rounded-sm shadow-sm transition-colors active:bg-[#292524]',
          buttonSecondary: 'w-full py-4 bg-transparent border border-[#D6D3D1] text-[#78716C] uppercase tracking-[0.2em] text-xs rounded-sm transition-colors active:bg-[#F5F5F4]',
          slotGrid: 'grid grid-cols-3 gap-3',
          slotButton: (selected: boolean, available: boolean) => `
            py-4 text-sm font-serif tracking-wider border transition-all
            ${selected 
              ? 'bg-[#44403C] text-[#F5F5F4] border-[#44403C]' 
              : available 
                ? 'bg-white text-[#57534E] border-[#E7E5E4] active:border-[#78716C]' 
                : 'bg-[#F5F5F4] text-[#D6D3D1] border-transparent cursor-not-allowed'}
          `,
          selectableItem: (selected: boolean) => `
            p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3
            ${selected 
              ? 'border-[#44403C] bg-[#44403C]/10' 
              : 'border-[#E7E5E4] bg-white active:border-[#D6D3D1]'}
          `,
          selectableListItem: (selected: boolean) => `
            w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between gap-3 text-left
            ${selected 
              ? 'border-[#44403C] bg-[#44403C]/10' 
              : 'border-[#E7E5E4] bg-white active:border-[#D6D3D1]'}
          `,
          selectableItemText: (selected: boolean) => (selected ? 'text-[#44403C]' : 'text-[#44403C]'),
          selectableItemSubText: (selected: boolean) => (selected ? 'text-[#78716C]' : 'text-[#78716C]'),
          infoBox: 'p-6 bg-[#FAFAF9] border border-[#E7E5E4] text-[#57534E]',
          actionButtonPrimary: 'flex items-center justify-center gap-1 px-3 py-2 bg-[#44403C] text-[#F5F5F4] text-xs uppercase tracking-wider rounded-sm active:bg-[#292524] transition-colors',
          actionButtonSecondary: 'flex items-center justify-center gap-1 px-3 py-2 bg-transparent border border-[#D6D3D1] text-[#78716C] text-xs uppercase tracking-wider rounded-sm active:bg-[#F5F5F4] transition-colors',
          // 追加：選択サマリー・通知用スタイル
          summaryBox: 'mb-6 p-4 bg-[#FAFAF9] rounded-sm border border-[#E7E5E4] text-sm space-y-1',
          summaryLabel: 'text-[#78716C]',
          summaryValue: 'font-medium text-[#44403C]',
          summaryLink: 'text-xs text-[#57534E] underline w-full text-right mt-2',
          noticeBox: 'mb-4 p-4 bg-[#F0F9FF] text-[#0369A1] text-sm rounded-sm border border-[#BAE6FD]',
          noticeLink: 'block mt-1 underline font-medium',
          emptySlotBox: 'text-center py-8 text-[#78716C] bg-[#FAFAF9] rounded-sm border border-dashed border-[#D6D3D1]',
          selectedDateBox: 'mt-4 p-3 rounded-sm border-2 text-center',
          selectedDateLabel: 'text-sm text-[#78716C]',
          partySizeDisabled: 'bg-[#F5F5F4] text-[#D6D3D1] cursor-not-allowed',
          partySizeEnabled: 'bg-[#E7E5E4] text-[#44403C]',
          partySizeText: 'text-2xl font-medium min-w-[60px] text-center text-[#44403C]',
          iconColor: '#57534E',
          primaryStyle: {}, 
          headerStyle: {},
          titleStyle: {},
          cardStyle: {},
          // 表形式用スタイル
          slotTable: {
            headerBg: 'bg-[#FAFAF9]',
            headerText: 'text-[#78716C]',
            headerBorder: 'border-[#E7E5E4]',
            timeCellBg: 'bg-[#FAFAF9]',
            timeCellText: 'text-[#57534E]',
            timeCellBorder: 'border-[#E7E5E4]',
            rowBorder: 'border-[#E7E5E4]',
            availableBtn: 'bg-white border border-[#D6D3D1] text-[#44403C]',
            availableBtnActive: 'bg-[#F5F5F4] border-[#44403C]',
            unavailableBtn: 'bg-[#F5F5F4] text-[#D6D3D1]',
            emptyCell: 'text-[#D6D3D1]',
            sundayText: 'text-[#B91C1C]',
            saturdayText: 'text-[#1D4ED8]',
            weekdayText: 'text-[#57534E]',
            legendText: 'text-[#78716C]',
            legendAvailable: 'border-[#D6D3D1] bg-white text-[#44403C]',
            legendUnavailable: 'bg-[#F5F5F4] text-[#D6D3D1]',
          },
        }

      case 'pop':
        return {
          container: `${common.container} bg-gray-50 font-sans`,
          card: `${common.card} bg-white rounded-[40px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border-4 border-white`,
          header: 'p-8 text-center bg-gray-50 rounded-b-[40px] mb-4 mx-2',
          title: 'text-2xl font-black tracking-tight flex items-center justify-center gap-2',
          label: 'block text-sm font-bold text-gray-400 mb-2 ml-3',
          input: `${common.input} bg-gray-100 border-2 border-transparent rounded-3xl focus:bg-white focus:border-current transition-all font-bold text-gray-700 px-5`,
          buttonPrimary: 'w-full py-4 text-white font-black rounded-full shadow-lg active:shadow-xl active:-translate-y-1 transition-all text-lg',
          buttonSecondary: 'w-full py-4 bg-white text-gray-500 font-black rounded-full border-2 border-gray-100 active:bg-gray-50 transition-all',
          slotGrid: 'grid grid-cols-3 gap-3',
          slotButton: (selected: boolean, available: boolean) => `
            py-3 rounded-2xl font-bold transition-all border-2
            ${selected 
              ? 'text-white shadow-md transform scale-105 border-transparent' 
              : available 
                ? 'bg-white text-gray-600 border-gray-100 active:border-current' 
                : 'bg-gray-50 text-gray-300 border-transparent cursor-not-allowed'}
          `,
          selectableItem: (selected: boolean) => `
            p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3
            ${selected 
              ? 'border-current bg-opacity-10' 
              : 'border-gray-100 bg-white active:border-gray-200'}
          `,
          selectableListItem: (selected: boolean) => `
            p-4 rounded-xl border-2 transition-all flex flex-row items-center gap-3
            ${selected 
              ? 'border-current bg-opacity-10' 
              : 'border-gray-100 bg-white active:border-gray-200'}
          `,
          selectableItemText: (selected: boolean) => (selected ? 'text-gray-800' : 'text-gray-800'),
          selectableItemSubText: (selected: boolean) => (selected ? 'text-gray-500' : 'text-gray-500'),
          infoBox: 'p-5 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200',
          actionButtonPrimary: 'flex items-center justify-center gap-1 px-4 py-2 text-white font-bold rounded-full shadow-md active:shadow-lg active:-translate-y-0.5 transition-all text-xs',
          actionButtonSecondary: 'flex items-center justify-center gap-1 px-4 py-2 bg-white text-gray-500 font-bold rounded-full border-2 border-gray-100 active:bg-gray-50 transition-all text-xs',
          // 追加：選択サマリー・通知用スタイル
          summaryBox: 'mb-6 p-4 bg-gray-50 rounded-3xl border-2 border-gray-100 text-sm space-y-1',
          summaryLabel: 'text-gray-500',
          summaryValue: 'font-bold text-gray-800',
          summaryLink: 'text-xs text-blue-500 underline w-full text-right mt-2',
          noticeBox: 'mb-4 p-4 bg-blue-50 text-blue-700 text-sm rounded-2xl border-2 border-blue-100',
          noticeLink: 'block mt-1 underline font-bold',
          emptySlotBox: 'text-center py-8 text-gray-500 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200',
          selectedDateBox: 'mt-4 p-3 rounded-2xl border-2 text-center',
          selectedDateLabel: 'text-sm text-gray-600',
          partySizeDisabled: 'bg-gray-100 text-gray-300 cursor-not-allowed',
          partySizeEnabled: 'bg-gray-200 text-gray-700',
          partySizeText: 'text-2xl font-black min-w-[60px] text-center',
          iconColor: c,
          primaryStyle: { backgroundColor: c, borderColor: c },
          headerStyle: { backgroundColor: `${c}15` }, // 10% opacity of theme color
          titleStyle: { color: c },
          cardStyle: {},
          // 表形式用スタイル
          slotTable: {
            headerBg: 'bg-white',
            headerText: 'text-gray-500',
            headerBorder: 'border-gray-200',
            timeCellBg: 'bg-white',
            timeCellText: 'text-gray-600',
            timeCellBorder: 'border-gray-100',
            rowBorder: 'border-gray-100',
            availableBtn: 'bg-white border-2 border-gray-200 text-emerald-500',
            availableBtnActive: 'bg-emerald-50 border-emerald-400',
            unavailableBtn: 'bg-gray-100 text-gray-300',
            emptyCell: 'text-gray-200',
            sundayText: 'text-red-500',
            saturdayText: 'text-blue-500',
            weekdayText: 'text-gray-700',
            legendText: 'text-gray-500',
            legendAvailable: 'border-2 border-gray-200 bg-white text-emerald-500',
            legendUnavailable: 'bg-gray-100 text-gray-300',
          },
        }

      case 'dark':
        return {
          container: `${common.container} bg-slate-950 font-sans`,
          card: `${common.card} bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-200`,
          header: 'p-6 text-center border-b border-slate-800 bg-slate-900/50 backdrop-blur',
          title: 'text-xl font-bold text-white flex items-center justify-center gap-2',
          label: 'block text-sm font-medium text-slate-300 mb-2',
          input: `${common.input} bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-slate-500 focus:ring-1 focus:ring-slate-500 placeholder-slate-500`,
          buttonPrimary: 'w-full py-3 bg-white text-slate-900 font-bold rounded-lg active:bg-slate-200 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all',
          buttonSecondary: 'w-full py-3 bg-slate-800 text-slate-200 border border-slate-700 font-bold rounded-lg active:bg-slate-700 transition-all',
          slotGrid: 'grid grid-cols-3 gap-3',
          slotButton: (selected: boolean, available: boolean) => `
            py-3 rounded-lg font-medium transition-all
            ${selected 
              ? 'bg-white text-slate-900 shadow-[0_0_15px_rgba(255,255,255,0.4)]' 
              : available 
                ? 'bg-slate-800 text-slate-200 border border-slate-700 active:border-slate-500' 
                : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'}
          `,
          selectableItem: (selected: boolean) => `
            p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3
            ${selected 
              ? 'bg-white text-slate-900 border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]' 
              : 'bg-slate-800 text-slate-200 border-slate-700 active:border-slate-500'}
          `,
          selectableListItem: (selected: boolean) => `
            p-4 rounded-xl border-2 transition-all flex flex-row items-center gap-3
            ${selected 
              ? 'bg-white text-slate-900 border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]' 
              : 'bg-slate-800 text-slate-200 border-slate-700 active:border-slate-500'}
          `,
          selectableItemText: (selected: boolean) => selected ? 'text-slate-900' : 'text-white',
          selectableItemSubText: (selected: boolean) => selected ? 'text-slate-600' : 'text-slate-400',
          infoBox: 'p-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-200',
          actionButtonPrimary: 'flex items-center justify-center gap-1 px-3 py-2 bg-white text-slate-900 font-bold rounded-lg active:bg-slate-200 shadow-[0_0_10px_rgba(255,255,255,0.2)] transition-all text-xs',
          actionButtonSecondary: 'flex items-center justify-center gap-1 px-3 py-2 bg-slate-800 text-slate-200 border border-slate-700 font-bold rounded-lg active:bg-slate-700 transition-all text-xs',
          // 追加：選択サマリー・通知用スタイル
          summaryBox: 'mb-6 p-3 bg-slate-800 rounded-lg border border-slate-700 text-sm space-y-1',
          summaryLabel: 'text-slate-400',
          summaryValue: 'font-bold text-white',
          summaryLink: 'text-xs text-cyan-400 underline w-full text-right mt-2',
          noticeBox: 'mb-4 p-3 bg-cyan-900/30 text-cyan-300 text-sm rounded-lg border border-cyan-700/50',
          noticeLink: 'block mt-1 underline font-bold text-cyan-200',
          emptySlotBox: 'text-center py-8 text-slate-400 bg-slate-800/50 rounded-lg border border-dashed border-slate-700',
          selectedDateBox: 'mt-4 p-3 rounded-lg border-2 text-center',
          selectedDateLabel: 'text-sm text-slate-400',
          partySizeDisabled: 'bg-slate-800 text-slate-600 cursor-not-allowed',
          partySizeEnabled: 'bg-slate-700 text-white',
          partySizeText: 'text-2xl font-bold min-w-[60px] text-center text-white',
          iconColor: 'white',
          primaryStyle: {},
          headerStyle: {},
          titleStyle: { textShadow: `0 0 20px ${c}` },
          cardStyle: {},
          // 表形式用スタイル
          slotTable: {
            headerBg: 'bg-slate-900',
            headerText: 'text-slate-400',
            headerBorder: 'border-slate-700',
            timeCellBg: 'bg-slate-900',
            timeCellText: 'text-slate-300',
            timeCellBorder: 'border-slate-800',
            rowBorder: 'border-slate-800',
            availableBtn: 'bg-slate-800 border border-slate-600 text-emerald-400',
            availableBtnActive: 'bg-slate-700 border-emerald-400',
            unavailableBtn: 'bg-slate-900 text-slate-600',
            emptyCell: 'text-slate-700',
            sundayText: 'text-red-400',
            saturdayText: 'text-blue-400',
            weekdayText: 'text-slate-300',
            legendText: 'text-slate-400',
            legendAvailable: 'border border-slate-600 bg-slate-800 text-emerald-400',
            legendUnavailable: 'bg-slate-900 text-slate-600',
          },
        }

      case 'luxury':
        return {
          container: `${common.container} bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950 font-serif`,
          card: `${common.card} bg-gradient-to-br from-stone-900 to-stone-950 border border-amber-600/30 rounded-lg shadow-[0_0_60px_-15px_rgba(217,119,6,0.3)]`,
          header: 'p-8 text-center border-b border-amber-600/20 bg-gradient-to-r from-amber-900/10 via-amber-600/10 to-amber-900/10',
          title: 'text-xl font-light tracking-[0.15em] text-amber-100 flex items-center justify-center gap-3',
          label: 'block text-xs font-medium text-amber-200/70 mb-2 tracking-wider uppercase',
          input: `${common.input} bg-stone-900/50 border border-amber-600/30 rounded text-amber-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 placeholder-amber-200/30`,
          buttonPrimary: 'w-full py-4 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-stone-900 font-semibold tracking-wider rounded shadow-lg shadow-amber-600/20 active:from-amber-500 active:to-amber-500 transition-all',
          buttonSecondary: 'w-full py-4 bg-transparent border border-amber-600/50 text-amber-200 font-medium tracking-wider rounded active:bg-amber-600/10 transition-all',
          slotGrid: 'grid grid-cols-3 gap-3',
          slotButton: (selected: boolean, available: boolean) => `
            py-4 rounded text-sm font-medium tracking-wide transition-all border
            ${selected 
              ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-stone-900 border-amber-500 shadow-lg shadow-amber-600/30' 
              : available 
                ? 'bg-stone-900/50 text-amber-100 border-amber-600/30 active:border-amber-500 active:bg-amber-900/20' 
                : 'bg-stone-950 text-amber-200/30 border-stone-800 cursor-not-allowed'}
          `,
          selectableItem: (selected: boolean) => `
            p-5 rounded-lg border transition-all flex flex-col items-center gap-3
            ${selected 
              ? 'bg-gradient-to-br from-amber-600/20 to-amber-900/20 border-amber-500 shadow-lg shadow-amber-600/20' 
              : 'bg-stone-900/50 border-amber-600/20 active:border-amber-500'}
          `,
          selectableListItem: (selected: boolean) => `
            w-full p-5 rounded-lg border transition-all flex items-center justify-between gap-3 text-left
            ${selected 
              ? 'bg-gradient-to-br from-amber-600/20 to-amber-900/20 border-amber-500 shadow-lg shadow-amber-600/20' 
              : 'bg-stone-900/50 border-amber-600/20 active:border-amber-500'}
          `,
          selectableItemText: (selected: boolean) => selected ? 'text-amber-100' : 'text-amber-100',
          selectableItemSubText: (selected: boolean) => selected ? 'text-amber-200/70' : 'text-amber-200/50',
          infoBox: 'p-6 bg-stone-900/50 border border-amber-600/20 rounded-lg text-amber-100',
          actionButtonPrimary: 'flex items-center justify-center gap-1 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 text-stone-900 font-semibold rounded shadow-lg shadow-amber-600/20 active:from-amber-500 transition-all text-xs tracking-wide',
          actionButtonSecondary: 'flex items-center justify-center gap-1 px-4 py-2 bg-transparent border border-amber-600/50 text-amber-200 font-medium rounded active:bg-amber-600/10 transition-all text-xs tracking-wide',
          summaryBox: 'mb-6 p-4 bg-stone-900/50 rounded-lg border border-amber-600/20 text-sm space-y-2',
          summaryLabel: 'text-amber-200/60',
          summaryValue: 'font-medium text-amber-100',
          summaryLink: 'text-xs text-amber-400 underline w-full text-right mt-2',
          noticeBox: 'mb-4 p-4 bg-amber-900/20 text-amber-200 text-sm rounded-lg border border-amber-600/30',
          noticeLink: 'block mt-1 underline font-medium text-amber-300',
          emptySlotBox: 'text-center py-8 text-amber-200/50 bg-stone-900/30 rounded-lg border border-dashed border-amber-600/30',
          selectedDateBox: 'mt-4 p-3 rounded-lg border text-center',
          selectedDateLabel: 'text-sm text-amber-200/60',
          partySizeDisabled: 'bg-stone-900 text-amber-200/30 cursor-not-allowed',
          partySizeEnabled: 'bg-amber-900/30 text-amber-200',
          partySizeText: 'text-2xl font-light min-w-[60px] text-center text-amber-100 tracking-wider',
          iconColor: '#fbbf24',
          primaryStyle: {},
          headerStyle: {},
          titleStyle: {},
          cardStyle: {},
          slotTable: {
            headerBg: 'bg-stone-900/50',
            headerText: 'text-amber-200/60',
            headerBorder: 'border-amber-600/20',
            timeCellBg: 'bg-stone-900/50',
            timeCellText: 'text-amber-100',
            timeCellBorder: 'border-amber-600/10',
            rowBorder: 'border-amber-600/10',
            availableBtn: 'bg-stone-900/30 border border-amber-600/30 text-amber-400',
            availableBtnActive: 'bg-amber-600/20 border-amber-500',
            unavailableBtn: 'bg-stone-950 text-amber-200/20',
            emptyCell: 'text-amber-200/10',
            sundayText: 'text-red-400',
            saturdayText: 'text-blue-400',
            weekdayText: 'text-amber-100',
            legendText: 'text-amber-200/60',
            legendAvailable: 'border border-amber-600/30 bg-stone-900/30 text-amber-400',
            legendUnavailable: 'bg-stone-950 text-amber-200/20',
          },
        }

      case 'natural':
        // 木目調・自然を感じさせるブラウン×グリーンのハーモニー
        return {
          container: `${common.container} bg-gradient-to-b from-amber-100/60 via-orange-50/40 to-lime-50/30 font-sans`,
          card: `${common.card} bg-gradient-to-br from-orange-50/95 to-amber-50/90 backdrop-blur border border-amber-300/40 rounded-2xl shadow-xl shadow-amber-900/10`,
          header: 'p-6 text-center border-b border-amber-200/60 bg-gradient-to-r from-amber-100/50 via-orange-50/30 to-lime-50/40',
          title: 'text-lg font-semibold text-amber-950 flex items-center justify-center gap-2',
          label: 'block text-sm font-medium text-amber-900 mb-2',
          input: `${common.input} bg-white/70 border border-amber-300/60 rounded-xl text-amber-950 focus:border-lime-600 focus:ring-2 focus:ring-lime-200 placeholder-amber-500`,
          buttonPrimary: 'w-full py-3.5 bg-gradient-to-r from-lime-700 via-lime-600 to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-lime-700/25 active:from-lime-800 active:to-emerald-700 transition-all',
          buttonSecondary: 'w-full py-3.5 bg-gradient-to-r from-amber-100/80 to-orange-100/60 border border-amber-300/50 text-amber-900 font-medium rounded-xl active:from-amber-200/80 transition-all',
          slotGrid: 'grid grid-cols-3 gap-3',
          slotButton: (selected: boolean, available: boolean) => `
            py-3 rounded-xl text-sm font-medium transition-all border
            ${selected 
              ? 'bg-gradient-to-r from-lime-600 to-emerald-600 text-white border-lime-500 shadow-lg shadow-lime-600/25' 
              : available 
                ? 'bg-gradient-to-br from-amber-50/80 to-orange-50/60 text-amber-900 border-amber-300/50 active:border-lime-500 active:bg-lime-50/50' 
                : 'bg-stone-100/40 text-stone-400 border-stone-200/50 cursor-not-allowed'}
          `,
          selectableItem: (selected: boolean) => `
            p-4 rounded-xl border transition-all flex flex-col items-center gap-3
            ${selected 
              ? 'bg-gradient-to-br from-lime-100/80 to-emerald-100/60 border-lime-500 shadow-lg shadow-lime-600/15' 
              : 'bg-gradient-to-br from-amber-50/60 to-orange-50/40 border-amber-300/40 active:border-lime-400'}
          `,
          selectableListItem: (selected: boolean) => `
            w-full p-4 rounded-xl border transition-all flex items-center justify-between gap-3 text-left
            ${selected 
              ? 'bg-gradient-to-br from-lime-100/80 to-emerald-100/60 border-lime-500 shadow-lg shadow-lime-600/15' 
              : 'bg-gradient-to-br from-amber-50/60 to-orange-50/40 border-amber-300/40 active:border-lime-400'}
          `,
          selectableItemText: (selected: boolean) => selected ? 'text-lime-900' : 'text-amber-950',
          selectableItemSubText: (selected: boolean) => selected ? 'text-lime-800' : 'text-amber-800',
          infoBox: 'p-5 bg-gradient-to-br from-amber-100/60 to-orange-100/40 border border-amber-300/50 rounded-xl text-amber-950',
          actionButtonPrimary: 'flex items-center justify-center gap-1 px-4 py-2 bg-gradient-to-r from-lime-700 to-emerald-600 text-white font-medium rounded-lg shadow-md shadow-lime-600/20 active:from-lime-800 transition-all text-xs',
          actionButtonSecondary: 'flex items-center justify-center gap-1 px-4 py-2 bg-gradient-to-r from-amber-100/80 to-orange-100/60 border border-amber-300/50 text-amber-900 font-medium rounded-lg active:from-amber-200/80 transition-all text-xs',
          summaryBox: 'mb-6 p-4 bg-gradient-to-br from-amber-100/50 via-orange-50/40 to-lime-100/30 rounded-xl border border-amber-300/40 text-sm space-y-1',
          summaryLabel: 'text-amber-800',
          summaryValue: 'font-semibold text-amber-950',
          summaryLink: 'text-xs text-lime-700 underline w-full text-right mt-2',
          noticeBox: 'mb-4 p-4 bg-gradient-to-r from-amber-100/60 to-orange-100/40 text-amber-900 text-sm rounded-xl border border-amber-300/50',
          noticeLink: 'block mt-1 underline font-semibold text-lime-700',
          emptySlotBox: 'text-center py-8 text-amber-600 bg-amber-100/30 rounded-xl border border-dashed border-amber-300/50',
          selectedDateBox: 'mt-4 p-3 rounded-xl border text-center',
          selectedDateLabel: 'text-sm text-amber-800',
          partySizeDisabled: 'bg-stone-100/50 text-stone-400 cursor-not-allowed',
          partySizeEnabled: 'bg-gradient-to-r from-amber-200/80 to-orange-200/60 text-amber-900',
          partySizeText: 'text-2xl font-semibold min-w-[60px] text-center text-amber-950',
          iconColor: '#92400e',
          primaryStyle: {},
          headerStyle: {},
          titleStyle: {},
          cardStyle: {},
          slotTable: {
            headerBg: 'bg-gradient-to-r from-amber-100/70 to-orange-100/50',
            headerText: 'text-amber-800',
            headerBorder: 'border-amber-300/40',
            timeCellBg: 'bg-gradient-to-r from-amber-100/50 to-orange-50/40',
            timeCellText: 'text-amber-900',
            timeCellBorder: 'border-amber-200/50',
            rowBorder: 'border-amber-200/40',
            availableBtn: 'bg-gradient-to-br from-amber-50/70 to-orange-50/50 border border-amber-300/40 text-lime-800',
            availableBtnActive: 'bg-gradient-to-br from-lime-100 to-emerald-100 border-lime-500',
            unavailableBtn: 'bg-stone-100/40 text-stone-400',
            emptyCell: 'text-amber-300',
            sundayText: 'text-red-600',
            saturdayText: 'text-blue-600',
            weekdayText: 'text-amber-950',
            legendText: 'text-amber-800',
            legendAvailable: 'border border-amber-300/40 bg-gradient-to-br from-amber-50/70 to-orange-50/50 text-lime-800',
            legendUnavailable: 'bg-stone-100/40 text-stone-400',
          },
        }

      case 'simple':
      default:
        return {
          container: `${common.container} bg-gray-50 font-sans`,
          card: `${common.card} bg-white shadow-sm border border-gray-100 rounded-xl`,
          header: 'p-5 text-center border-b border-gray-100',
          title: 'text-lg font-bold text-gray-800 flex items-center justify-center gap-2',
          label: 'block text-sm font-medium text-gray-700 mb-2',
          input: `${common.input} bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:border-transparent`,
          buttonPrimary: 'w-full py-3 text-white font-bold rounded-lg shadow-sm active:opacity-90 transition-opacity',
          buttonSecondary: 'w-full py-3 bg-white text-gray-600 border border-gray-200 font-bold rounded-lg active:bg-gray-50 transition-colors',
          slotGrid: 'grid grid-cols-3 gap-3',
          slotButton: (selected: boolean, available: boolean) => `
            py-3 rounded-lg text-sm font-bold transition-all
            ${selected 
              ? 'text-white shadow-md transform scale-105' 
              : available 
                ? 'bg-white border border-gray-200 text-gray-700 active:border-gray-300 active:bg-gray-50' 
                : 'bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed'}
          `,
          selectableItem: (selected: boolean) => `
            p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3
            ${selected 
              ? 'border-current bg-opacity-10' 
              : 'border-gray-100 bg-white active:border-gray-200'}
          `,
          selectableListItem: (selected: boolean) => `
            p-4 rounded-xl border-2 transition-all flex flex-row items-center gap-3
            ${selected 
              ? 'border-current bg-opacity-10' 
              : 'border-gray-100 bg-white active:border-gray-200'}
          `,
          selectableItemText: (selected: boolean) => (selected ? 'text-gray-800' : 'text-gray-800'),
          selectableItemSubText: (selected: boolean) => (selected ? 'text-gray-500' : 'text-gray-500'),
          infoBox: 'p-4 bg-gray-50 border border-gray-100 rounded-lg',
          actionButtonPrimary: 'flex items-center justify-center gap-1 px-3 py-2 text-white font-bold rounded-lg shadow-sm active:opacity-90 transition-opacity text-xs',
          actionButtonSecondary: 'flex items-center justify-center gap-1 px-3 py-2 bg-white text-gray-600 border border-gray-200 font-bold rounded-lg active:bg-gray-50 transition-colors text-xs',
          // 追加：選択サマリー・通知用スタイル
          summaryBox: 'mb-6 p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm space-y-1',
          summaryLabel: 'text-gray-500',
          summaryValue: 'font-bold text-gray-800',
          summaryLink: 'text-xs text-blue-500 underline w-full text-right mt-2',
          noticeBox: 'mb-4 p-3 bg-blue-50 text-blue-700 text-sm rounded-lg border border-blue-100',
          noticeLink: 'block mt-1 underline font-bold',
          emptySlotBox: 'text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300',
          selectedDateBox: 'mt-4 p-3 rounded-lg border-2 text-center',
          selectedDateLabel: 'text-sm text-gray-600',
          partySizeDisabled: 'bg-gray-100 text-gray-300 cursor-not-allowed',
          partySizeEnabled: 'bg-gray-200 text-gray-700',
          partySizeText: 'text-2xl font-bold min-w-[60px] text-center',
          iconColor: c,
          primaryStyle: { backgroundColor: c },
          headerStyle: {},
          titleStyle: {},
          cardStyle: {},
          // 表形式用スタイル
          slotTable: {
            headerBg: 'bg-white',
            headerText: 'text-gray-500',
            headerBorder: 'border-gray-200',
            timeCellBg: 'bg-white',
            timeCellText: 'text-gray-600',
            timeCellBorder: 'border-gray-100',
            rowBorder: 'border-gray-100',
            availableBtn: 'bg-white border border-gray-200 text-emerald-600',
            availableBtnActive: 'bg-emerald-50 border-emerald-400',
            unavailableBtn: 'bg-gray-100 text-gray-300',
            emptyCell: 'text-gray-200',
            sundayText: 'text-red-500',
            saturdayText: 'text-blue-500',
            weekdayText: 'text-gray-700',
            legendText: 'text-gray-500',
            legendAvailable: 'border border-gray-200 bg-white text-emerald-600',
            legendUnavailable: 'bg-gray-100 text-gray-300',
          },
        }
    }
  })()

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
    <div className={theme.container}>
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
        <div className={theme.header} style={theme.headerStyle}>
          {storeSettings.liff_logo_url ? (
            <img src={storeSettings.liff_logo_url} alt="Logo" className="h-8 mx-auto object-contain" />
          ) : (
            <h1 className={theme.title} style={theme.titleStyle}>予約フォーム</h1>
          )}
        </div>

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
                    <div className="flex justify-between border-b border-current pb-2 border-opacity-20 mb-2">
                      <span className="opacity-70">日時</span>
                      <span className="font-bold text-right">
                        {new Date(res.start_time).toLocaleDateString('ja-JP')} {new Date(res.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    {/* 担当者表示 */}
                    {res.staff?.name && (
                      <div className="flex justify-between border-b border-current pb-2 border-opacity-20 mb-2">
                        <span className="opacity-70">担当</span>
                        <span className="font-bold text-right">{res.staff.name}</span>
                      </div>
                    )}

                    {/* メニュー表示 */}
                    {res.menu?.name && (
                      <div className="flex justify-between border-b border-current pb-2 border-opacity-20 mb-2">
                        <span className="opacity-70 whitespace-nowrap">メニュー</span>
                        <span className="font-bold text-right">
                          {res.menu.name}
                          {res.menu.price ? ` (¥${res.menu.price.toLocaleString()})` : ''}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-end items-center mt-2">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleModifyStart(res.id)}
                          className={theme.actionButtonPrimary}
                          style={storeSettings.liff_template_id === 'simple' ? { backgroundColor: storeSettings.liff_theme_color } : {}}
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
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    スタッフが登録されていません
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
                        style={selectedStaff?.id === staff.id && storeSettings.liff_template_id !== 'dark' ? { borderColor: storeSettings.liff_theme_color, backgroundColor: `${storeSettings.liff_theme_color}10` } : {}}
                      >
                        <div className={`w-16 h-16 rounded-full overflow-hidden flex items-center justify-center ${storeSettings.liff_template_id === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}>
                          {staff.image_url ? (
                            <img src={staff.image_url} alt={staff.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className={storeSettings.liff_template_id === 'dark' ? 'text-slate-400' : 'text-gray-400'} size={32} />
                          )}
                        </div>
                        <div className="text-center">
                          <div className={`font-bold text-sm ${theme.selectableItemText(selectedStaff?.id === staff.id)}`}>{staff.name}</div>
                          {staff.role && <div className={`text-xs mt-1 ${theme.selectableItemSubText(selectedStaff?.id === staff.id)}`}>{staff.role}</div>}
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
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center ${storeSettings.liff_template_id === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}>
                        <User className={storeSettings.liff_template_id === 'dark' ? 'text-slate-400' : 'text-gray-400'} size={32} />
                      </div>
                      <div className={`font-bold text-sm ${theme.selectableItemText(false)}`}>指名なし</div>
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
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    メニューが登録されていません
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
                        className={`
                          w-full text-left flex justify-between items-center
                          ${theme.selectableListItem(selectedMenu?.id === menu.id)}
                        `}
                        style={selectedMenu?.id === menu.id && storeSettings.liff_template_id !== 'dark' ? { borderColor: storeSettings.liff_theme_color, backgroundColor: `${storeSettings.liff_theme_color}10` } : {}}
                      >
                        <div>
                          <div className={`font-bold ${theme.selectableItemText(selectedMenu?.id === menu.id)}`}>{menu.name}</div>
                          {menu.description && <div className={`text-xs mt-1 line-clamp-2 ${theme.selectableItemSubText(selectedMenu?.id === menu.id)}`}>{menu.description}</div>}
                          <div className={`text-xs mt-2 flex gap-3 ${theme.selectableItemSubText(selectedMenu?.id === menu.id)}`}>
                            {menu.duration_minutes && <span className="flex items-center gap-1"><Clock size={12} /> {menu.duration_minutes}分</span>}
                            {menu.price && <span>¥{menu.price.toLocaleString()}</span>}
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedMenu?.id === menu.id ? 'border-current' : (storeSettings.liff_template_id === 'dark' ? 'border-slate-600' : 'border-gray-300')}`}
                             style={selectedMenu?.id === menu.id ? { borderColor: storeSettings.liff_theme_color } : {}}>
                          {selectedMenu?.id === menu.id && <div className="w-3 h-3 rounded-full bg-current" style={{ backgroundColor: storeSettings.liff_theme_color }} />}
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
                  <img src={pictureUrl} alt={displayName} className="w-16 h-16 rounded-full border-2 border-white shadow-md" />
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
                            : theme.partySizeEnabled
                        }`}
                        style={partySize < 20 ? { backgroundColor: `${storeSettings.liff_theme_color}20`, color: storeSettings.liff_theme_color } : {}}
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
                        <span className={`w-4 h-4 rounded text-xs flex items-center justify-center font-bold ${theme.slotTable.legendAvailable}`}>◯</span>
                        可
                      </span>
                      <span className="flex items-center gap-1">
                        <span className={`w-4 h-4 rounded text-xs flex items-center justify-center font-bold ${theme.slotTable.legendUnavailable}`}>×</span>
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
                            <th className={`sticky left-0 z-30 ${theme.slotTable.headerBg} p-2 text-xs font-bold ${theme.slotTable.headerText} border-b ${theme.slotTable.headerBorder} min-w-[50px]`}>
                              時間
                            </th>
                            {displayDates.map((dateStr) => {
                              const d = new Date(dateStr + 'T00:00:00')
                              const dayName = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
                              const isSelected = date === dateStr
                              const isSunday = d.getDay() === 0
                              const isSaturday = d.getDay() === 6
                              return (
                                <th 
                                  key={dateStr} 
                                  className={`${theme.slotTable.headerBg} p-2 text-center border-b ${theme.slotTable.headerBorder} min-w-[52px]`}
                                  style={isSelected ? { backgroundColor: `${storeSettings.liff_theme_color}20` } : {}}
                                >
                                  <div className={`text-[10px] font-bold ${isSunday ? theme.slotTable.sundayText : isSaturday ? theme.slotTable.saturdayText : theme.slotTable.headerText}`}>
                                    {d.getMonth() + 1}/{d.getDate()}
                                  </div>
                                  <div className={`text-xs font-bold ${isSunday ? theme.slotTable.sundayText : isSaturday ? theme.slotTable.saturdayText : theme.slotTable.weekdayText}`}>
                                    {dayName}
                                  </div>
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        {/* ボディ：時間帯 × 日付 */}
                        <tbody>
                          {allTimeSlots.map((timeStr) => (
                            <tr key={timeStr} className={`border-b ${theme.slotTable.rowBorder} last:border-b-0`}>
                              <td className={`sticky left-0 z-10 ${theme.slotTable.timeCellBg} p-2 text-xs font-bold ${theme.slotTable.timeCellText} border-r ${theme.slotTable.timeCellBorder}`}>
                                {timeStr}
                              </td>
                              {displayDates.map((dateStr) => {
                                const slotAvailable = multiDateSlots[dateStr]?.[timeStr]
                                const isSelected = date === dateStr && time === timeStr
                                const isAvailable = slotAvailable === true
                                const hasSlot = slotAvailable !== undefined
                                
                                return (
                                  <td key={`${dateStr}-${timeStr}`} className="p-1 text-center">
                                    {hasSlot ? (
                                      <button
                                        onClick={async () => {
                                          if (!isAvailable) return
                                          setDate(dateStr)
                                          setTime(timeStr)
                                          
                                          // プレビューモードでは仮押さえをスキップ
                                          if (isPreviewMode()) {
                                            console.log('Skipping hold_slot in preview mode')
                                            return
                                          }
                                          
                                          // 仮押さえを実行
                                          try {
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
                                              }
                                            })
                                            console.log('Slot held successfully')
                                          } catch (e) {
                                            console.error('Failed to hold slot:', e)
                                          }
                                        }}
                                        disabled={!isAvailable}
                                        className={`
                                          w-10 h-10 rounded-lg text-lg font-bold transition-all
                                          ${isSelected 
                                            ? 'text-white shadow-md transform scale-105' 
                                            : isAvailable 
                                              ? `${theme.slotTable.availableBtn} active:${theme.slotTable.availableBtnActive} cursor-pointer` 
                                              : `${theme.slotTable.unavailableBtn} cursor-not-allowed`}
                                        `}
                                        style={isSelected ? { backgroundColor: storeSettings.liff_theme_color } : {}}
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
                    <div 
                      className={theme.selectedDateBox}
                      style={{ 
                        borderColor: storeSettings.liff_theme_color, 
                        backgroundColor: `${storeSettings.liff_theme_color}10` 
                      }}
                    >
                      <span className={theme.selectedDateLabel}>選択中：</span>
                      <span className="font-bold ml-2" style={{ color: storeSettings.liff_theme_color }}>
                        {(() => {
                          const d = new Date(date + 'T00:00:00')
                          const dayName = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
                          return `${d.getMonth() + 1}月${d.getDate()}日(${dayName}) ${time}`
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
                      <p className="text-sm mb-1 opacity-70">ようこそ、</p>
                      <p className="font-bold text-lg">{existingCustomer.real_name} 様</p>
                      <p className="text-xs mt-2 opacity-70">※ご登録済みのお名前を使用します</p>
                    </div>
                  ) : (
                    <>
                      <div className={theme.infoBox}>
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

              <div className={`${theme.infoBox} space-y-3 mb-6`}>
                <div className="flex justify-between border-b border-current pb-2 border-opacity-20">
                  <span className="opacity-70">日時</span>
                  <span className="font-bold text-right">{date} {time}</span>
                </div>
                {storeSettings.booking_enable_party_size && (
                  <div className="flex justify-between border-b border-current pb-2 border-opacity-20">
                    <span className="opacity-70">人数</span>
                    <span className="font-bold text-right">{partySize}名</span>
                  </div>
                )}
                {selectedStaff && (
                  <div className="flex justify-between border-b border-current pb-2 border-opacity-20">
                    <span className="opacity-70">指名スタッフ</span>
                    <span className="font-bold text-right">{selectedStaff.name}</span>
                  </div>
                )}
                {selectedMenu && (
                  <div className="flex justify-between border-b border-current pb-2 border-opacity-20">
                    <span className="opacity-70">メニュー</span>
                    <span className="font-bold text-right">
                      {selectedMenu.name}
                      {selectedMenu.price ? ` (¥${selectedMenu.price.toLocaleString()})` : ''}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-b border-current pb-2 border-opacity-20">
                  <span className="opacity-70">お名前</span>
                  <span className="font-bold text-right">{realName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">フリガナ</span>
                  <span className="font-bold text-right">{furigana}</span>
                </div>
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
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-green-100 text-green-600">
                <CheckCircle size={40} />
              </div>
              <h2 className={theme.title} style={theme.titleStyle}>{modifyingReservationId ? '変更完了' : '予約完了'}</h2>
              <p className="mb-8 opacity-70 whitespace-nowrap">{modifyingReservationId ? '予約の変更が完了しました。' : 'ご予約ありがとうございます。'}</p>
              
              {/* Reservation Details Card for Screenshot */}
              <div className={`${theme.infoBox} text-left mb-8`}>
                 <div className="text-xs opacity-70 mb-1">予約日時</div>
                 <div className="text-xl font-bold mb-4">{date} {time}</div>
                 <div className="text-xs opacity-70 mb-1">お名前</div>
                 <div className="text-lg font-bold">{realName} 様</div>
              </div>

              <button 
                onClick={() => liff.closeWindow()}
                className="font-bold hover:underline"
                style={{ color: theme.iconColor }}
              >
                閉じる
              </button>
            </motion.div>
          )}
        </div>
      </div>
      
      {/* Debug Info / Store Name Footer */}
      <div className="mt-4 text-center text-[10px] text-gray-400 pb-4">
        {storeSettings.name}
      </div>
    </div>
  )
}
