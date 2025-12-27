import { useState, useEffect, useCallback } from 'react'
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
    booking_system_type: 'generic'
  })

  // Salon/Restaurant Data
  const { staffList, menuList, setStaffList, setMenuList } = useStoreResources(storeId)
  const [selectedStaff, setSelectedStaff] = useState<StoreStaff | null>(null)
  const [selectedMenu, setSelectedMenu] = useState<StoreMenu | null>(null)
  
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
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeReservations, setActiveReservations] = useState<ReservationSummary[]>([])
  const [modifyingReservationId, setModifyingReservationId] = useState<string | null>(null)
  
  // User Data
  const [lineUserId, setLineUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [pictureUrl, setPictureUrl] = useState('')
  const [existingCustomer, setExistingCustomer] = useState<CustomerInfo | null>(null)
  const [realName, setRealName] = useState('')
  const [furigana, setFurigana] = useState('')
  
  const fetchSlots = useCallback(async () => {
    setLoadingSlots(true)
    setTime('') // Reset selected time
    try {
      const { data, error } = await supabase.functions.invoke('booking', {
        body: {
          action: 'get_available_slots',
          store_id: storeId,
          date: date
        }
      })
      
      if (error) throw error
      
      if (data?.slots) {
        setSlots(data.slots)
      } else {
        setSlots([])
      }
    } catch (e) {
      console.error('Failed to fetch slots:', e)
      setSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [date, storeId])

  const fetchStore = useCallback(async () => {
    // In production, store_id should be passed via query param ?store_id=...
    const params = new URLSearchParams(window.location.search)
    let targetStoreId = params.get('store_id')

    if (!targetStoreId) {
        // Fallback: Get first store
        const { data } = await supabase.from('stores').select('id, name, liff_template_id, liff_theme_color, liff_logo_url, booking_system_type').limit(1).maybeSingle()
        targetStoreId = data?.id
        if (data) {
          if (data.name) document.title = data.name
          setStoreSettings({
            name: data.name || '',
            liff_template_id: data.liff_template_id || 'simple',
            liff_theme_color: data.liff_theme_color || '#00c3dc',
            liff_logo_url: data.liff_logo_url || '',
            booking_system_type: data.booking_system_type || 'generic'
          })
        }
    } else {
        // Fetch specific store settings
        const { data } = await supabase.from('stores').select('name, liff_template_id, liff_theme_color, liff_logo_url, booking_system_type').eq('id', targetStoreId).maybeSingle()
        if (data) {
          if (data.name) document.title = data.name
          setStoreSettings({
            name: data.name || '',
            liff_template_id: data.liff_template_id || 'simple',
            liff_theme_color: data.liff_theme_color || '#00c3dc',
            liff_logo_url: data.liff_logo_url || '',
            booking_system_type: data.booking_system_type || 'generic'
          })
        }
    }

    if (targetStoreId) {
      setStoreId(targetStoreId)
    } else {
        setStep('error')
        setErrorMsg('店舗情報が見つかりませんでした。')
    }
  }, [])

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

  // Fetch slots when date or storeId changes
  useEffect(() => {
    if (storeId && date) {
      fetchSlots()
    }
  }, [storeId, date, fetchSlots])

  // Listen for settings updates from parent window (LineSettings.tsx)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'UPDATE_SETTINGS' && event.data?.settings) {
        console.log('Received settings update:', event.data)
        
        const newSettings = event.data.settings
        
        setStoreSettings(prev => {
          // Check if booking system type changed
          if (prev.booking_system_type !== newSettings.booking_system_type) {
            // Reset step based on new type
            setTimeout(() => {
              if (newSettings.booking_system_type === 'salon') {
                setStep('staff_select')
              } else if (newSettings.booking_system_type === 'restaurant') {
                setStep('menu_select')
              } else {
                setStep('date')
              }
              // Reset selections
              setSelectedStaff(null)
              setSelectedMenu(null)
            }, 0)
          }
          return { ...prev, ...newSettings }
        })

        // Update Staff & Menu Lists
        if (event.data.staffList) setStaffList(event.data.staffList)
        if (event.data.menuList) setMenuList(event.data.menuList)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])


  const checkCustomer = useCallback(async () => {
    setCheckingUser(true)
    try {
      const { data, error } = await supabase.functions.invoke('booking', {
        body: {
          action: 'check_customer',
          store_id: storeId,
          line_user_id: lineUserId
        }
      })
      
      if (error) throw error
      
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
      console.error(e)
    } finally {
      setCheckingUser(false)
    }
  }, [lineUserId, storeId])

  const checkReservation = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('booking', {
        body: {
          action: 'get_active_reservation',
          store_id: storeId,
          line_user_id: lineUserId
        }
      })
      
      if (error) throw error
      
      if (data?.reservations && data.reservations.length > 0) {
        setActiveReservations(data.reservations as ReservationSummary[])
        setStep('existing_reservation')
      } else {
        // Determine initial step based on booking system type
        if (storeSettings.booking_system_type === 'salon') {
          setStep('staff_select')
        } else if (storeSettings.booking_system_type === 'restaurant') {
          setStep('menu_select')
        } else {
          setStep('date')
        }
      }
    } catch (e) {
      console.error('Failed to check reservation:', e)
      // Fallback
      if (storeSettings.booking_system_type === 'salon') {
        setStep('staff_select')
      } else if (storeSettings.booking_system_type === 'restaurant') {
        setStep('menu_select')
      } else {
        setStep('date')
      }
    }
  }, [lineUserId, storeId, storeSettings.booking_system_type])

  useEffect(() => {
    if (storeId && lineUserId) {
      const init = async () => {
        await checkCustomer()
        await checkReservation()
      }
      init()
    }
  }, [checkCustomer, checkReservation, lineUserId, storeId])

  const handleCancelReservation = async (reservationId: string) => {
    showModal(
      '予約キャンセル',
      'この予約をキャンセルしますか？',
      async () => {
        hideModal()
        setLoading(true)
        try {
          const { error } = await supabase.functions.invoke('booking', {
            body: {
              action: 'cancel_reservation',
              reservation_id: reservationId
            }
          })

          if (error) throw error

          const updated = activeReservations.filter(r => r.id !== reservationId)
          setActiveReservations(updated)
          showToast('予約をキャンセルしました。', 'success')
          
          if (updated.length === 0) {
            if (storeSettings.booking_system_type === 'salon') {
              setStep('staff_select')
            } else if (storeSettings.booking_system_type === 'restaurant') {
              setStep('menu_select')
            } else {
              setStep('date')
            }
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
    if (storeSettings.booking_system_type === 'salon') {
      setStep('staff_select')
    } else if (storeSettings.booking_system_type === 'restaurant') {
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
      // Ensure we have the latest profile info
      let currentPictureUrl = pictureUrl
      let currentDisplayName = displayName
      
      if (!currentPictureUrl && liff.isLoggedIn()) {
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
          reservation_id: modifyingReservationId // Only used if action is update_reservation
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
          buttonPrimary: 'w-full py-4 bg-[#44403C] text-[#F5F5F4] hover:bg-[#292524] uppercase tracking-[0.2em] text-xs rounded-sm shadow-sm transition-colors',
          buttonSecondary: 'w-full py-4 bg-transparent border border-[#D6D3D1] text-[#78716C] hover:bg-[#F5F5F4] uppercase tracking-[0.2em] text-xs rounded-sm transition-colors',
          slotGrid: 'grid grid-cols-3 gap-3',
          slotButton: (selected: boolean, available: boolean) => `
            py-4 text-sm font-serif tracking-wider border transition-all
            ${selected 
              ? 'bg-[#44403C] text-[#F5F5F4] border-[#44403C]' 
              : available 
                ? 'bg-white text-[#57534E] border-[#E7E5E4] hover:border-[#78716C]' 
                : 'bg-[#F5F5F4] text-[#D6D3D1] border-transparent cursor-not-allowed'}
          `,
          selectableItem: (selected: boolean) => `
            p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3
            ${selected 
              ? 'border-[#44403C] bg-[#44403C]/10' 
              : 'border-[#E7E5E4] bg-white hover:border-[#D6D3D1]'}
          `,
          selectableListItem: (selected: boolean) => `
            w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between gap-3 text-left
            ${selected 
              ? 'border-[#44403C] bg-[#44403C]/10' 
              : 'border-[#E7E5E4] bg-white hover:border-[#D6D3D1]'}
          `,
          selectableItemText: (selected: boolean) => (selected ? 'text-[#44403C]' : 'text-[#44403C]'),
          selectableItemSubText: (selected: boolean) => (selected ? 'text-[#78716C]' : 'text-[#78716C]'),
          infoBox: 'p-6 bg-[#FAFAF9] border border-[#E7E5E4] text-[#57534E]',
          actionButtonPrimary: 'flex items-center justify-center gap-1 px-3 py-2 bg-[#44403C] text-[#F5F5F4] text-xs uppercase tracking-wider rounded-sm hover:bg-[#292524] transition-colors',
          actionButtonSecondary: 'flex items-center justify-center gap-1 px-3 py-2 bg-transparent border border-[#D6D3D1] text-[#78716C] text-xs uppercase tracking-wider rounded-sm hover:bg-[#F5F5F4] transition-colors',
          iconColor: '#57534E',
          primaryStyle: {}, 
          headerStyle: {},
          titleStyle: {},
          cardStyle: {},
        }

      case 'pop':
        return {
          container: `${common.container} bg-gray-50 font-sans`,
          card: `${common.card} bg-white rounded-[40px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border-4 border-white`,
          header: 'p-8 text-center bg-gray-50 rounded-b-[40px] mb-4 mx-2',
          title: 'text-2xl font-black tracking-tight flex items-center justify-center gap-2',
          label: 'block text-sm font-bold text-gray-400 mb-2 ml-3',
          input: `${common.input} bg-gray-100 border-2 border-transparent rounded-3xl focus:bg-white focus:border-current transition-all font-bold text-gray-700 px-5`,
          buttonPrimary: 'w-full py-4 text-white font-black rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all text-lg',
          buttonSecondary: 'w-full py-4 bg-white text-gray-500 font-black rounded-full border-2 border-gray-100 hover:bg-gray-50 transition-all',
          slotGrid: 'grid grid-cols-3 gap-3',
          slotButton: (selected: boolean, available: boolean) => `
            py-3 rounded-2xl font-bold transition-all border-2
            ${selected 
              ? 'text-white shadow-md transform scale-105 border-transparent' 
              : available 
                ? 'bg-white text-gray-600 border-gray-100 hover:border-current' 
                : 'bg-gray-50 text-gray-300 border-transparent cursor-not-allowed'}
          `,
          selectableItem: (selected: boolean) => `
            p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3
            ${selected 
              ? 'border-current bg-opacity-10' 
              : 'border-gray-100 bg-white hover:border-gray-200'}
          `,
          selectableListItem: (selected: boolean) => `
            p-4 rounded-xl border-2 transition-all flex flex-row items-center gap-3
            ${selected 
              ? 'border-current bg-opacity-10' 
              : 'border-gray-100 bg-white hover:border-gray-200'}
          `,
          selectableItemText: (selected: boolean) => (selected ? 'text-gray-800' : 'text-gray-800'),
          selectableItemSubText: (selected: boolean) => (selected ? 'text-gray-500' : 'text-gray-500'),
          infoBox: 'p-5 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200',
          actionButtonPrimary: 'flex items-center justify-center gap-1 px-4 py-2 text-white font-bold rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-xs',
          actionButtonSecondary: 'flex items-center justify-center gap-1 px-4 py-2 bg-white text-gray-500 font-bold rounded-full border-2 border-gray-100 hover:bg-gray-50 transition-all text-xs',
          iconColor: c,
          primaryStyle: { backgroundColor: c, borderColor: c },
          headerStyle: { backgroundColor: `${c}15` }, // 10% opacity of theme color
          titleStyle: { color: c },
          cardStyle: {},
        }

      case 'dark':
        return {
          container: `${common.container} bg-slate-950 font-sans`,
          card: `${common.card} bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-200`,
          header: 'p-6 text-center border-b border-slate-800 bg-slate-900/50 backdrop-blur',
          title: 'text-xl font-bold text-white flex items-center justify-center gap-2',
          label: 'block text-sm font-medium text-slate-300 mb-2',
          input: `${common.input} bg-slate-950 border border-slate-800 rounded-lg text-white focus:border-white focus:ring-1 focus:ring-white placeholder-slate-500`,
          buttonPrimary: 'w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all',
          buttonSecondary: 'w-full py-3 bg-slate-800 text-slate-300 border border-slate-700 font-bold rounded-lg hover:bg-slate-700 transition-all',
          slotGrid: 'grid grid-cols-3 gap-3',
          slotButton: (selected: boolean, available: boolean) => `
            py-3 rounded-lg font-medium transition-all
            ${selected 
              ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.4)]' 
              : available 
                ? 'bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-500' 
                : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'}
          `,
          selectableItem: (selected: boolean) => `
            p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3
            ${selected 
              ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]' 
              : 'bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-500'}
          `,
          selectableListItem: (selected: boolean) => `
            p-4 rounded-xl border-2 transition-all flex flex-row items-center gap-3
            ${selected 
              ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]' 
              : 'bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-500'}
          `,
          selectableItemText: (selected: boolean) => selected ? 'text-black' : 'text-white',
          selectableItemSubText: (selected: boolean) => selected ? 'text-gray-600' : 'text-slate-400',
          infoBox: 'p-4 bg-slate-800/50 border border-slate-700 rounded-lg',
          actionButtonPrimary: 'flex items-center justify-center gap-1 px-3 py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 shadow-[0_0_10px_rgba(255,255,255,0.2)] transition-all text-xs',
          actionButtonSecondary: 'flex items-center justify-center gap-1 px-3 py-2 bg-slate-800 text-slate-300 border border-slate-700 font-bold rounded-lg hover:bg-slate-700 transition-all text-xs',
          iconColor: 'white',
          primaryStyle: {},
          headerStyle: {},
          titleStyle: { textShadow: `0 0 20px ${c}` },
          cardStyle: {},
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
          buttonPrimary: 'w-full py-3 text-white font-bold rounded-lg shadow-sm hover:opacity-90 transition-opacity',
          buttonSecondary: 'w-full py-3 bg-white text-gray-600 border border-gray-200 font-bold rounded-lg hover:bg-gray-50 transition-colors',
          slotGrid: 'grid grid-cols-3 gap-3',
          slotButton: (selected: boolean, available: boolean) => `
            py-3 rounded-lg text-sm font-bold transition-all
            ${selected 
              ? 'text-white shadow-md transform scale-105' 
              : available 
                ? 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50' 
                : 'bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed'}
          `,
          selectableItem: (selected: boolean) => `
            p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3
            ${selected 
              ? 'border-current bg-opacity-10' 
              : 'border-gray-100 bg-white hover:border-gray-200'}
          `,
          selectableListItem: (selected: boolean) => `
            p-4 rounded-xl border-2 transition-all flex flex-row items-center gap-3
            ${selected 
              ? 'border-current bg-opacity-10' 
              : 'border-gray-100 bg-white hover:border-gray-200'}
          `,
          selectableItemText: (selected: boolean) => (selected ? 'text-gray-800' : 'text-gray-800'),
          selectableItemSubText: (selected: boolean) => (selected ? 'text-gray-500' : 'text-gray-500'),
          infoBox: 'p-4 bg-gray-50 border border-gray-100 rounded-lg',
          actionButtonPrimary: 'flex items-center justify-center gap-1 px-3 py-2 text-white font-bold rounded-lg shadow-sm hover:opacity-90 transition-opacity text-xs',
          actionButtonSecondary: 'flex items-center justify-center gap-1 px-3 py-2 bg-white text-gray-600 border border-gray-200 font-bold rounded-lg hover:bg-gray-50 transition-colors text-xs',
          iconColor: c,
          primaryStyle: { backgroundColor: c },
          headerStyle: {},
          titleStyle: {},
          cardStyle: {},
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
                    
                    if (storeSettings.booking_system_type === 'salon') {
                      setStep('staff_select')
                    } else if (storeSettings.booking_system_type === 'restaurant') {
                      setStep('menu_select')
                    } else {
                      setStep('date')
                    }
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
                          setStep('menu_select')
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
                        setStep('menu_select')
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
                    if (storeSettings.booking_system_type === 'salon') {
                      setStep('staff_select')
                    } else {
                      // For restaurant, maybe go back to something else? Or just disable back if it's the first step
                      // Actually restaurant starts at menu_select, so no back button needed unless we have a home screen
                    }
                  }}
                  className={`${theme.buttonSecondary} ${storeSettings.booking_system_type === 'restaurant' ? 'hidden' : ''}`}
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
              {(selectedStaff || selectedMenu) && (
                <div className="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm space-y-1">
                  {selectedStaff && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">指名スタッフ:</span>
                      <span className="font-bold">{selectedStaff.name}</span>
                    </div>
                  )}
                  {selectedMenu && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">メニュー:</span>
                      <span className="font-bold">{selectedMenu.name}</span>
                    </div>
                  )}
                  <button 
                    onClick={() => setStep(storeSettings.booking_system_type === 'salon' ? 'staff_select' : 'menu_select')}
                    className="text-xs text-blue-500 underline w-full text-right mt-2"
                  >
                    選択し直す
                  </button>
                </div>
              )}
              
              {modifyingReservationId && (
                <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-sm rounded-lg border border-blue-100">
                  現在、予約の変更を行っています。新しい日時を選択してください。
                  <button 
                    onClick={() => {
                      setModifyingReservationId(null)
                      setStep('existing_reservation')
                    }}
                    className="block mt-1 underline font-bold"
                  >
                    変更を中止して戻る
                  </button>
                </div>
              )}
              
              <div className="space-y-6">
                <div>
                  <label className={theme.label}>日付</label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={theme.input}
                  />
                </div>
                
                <div>
                  <label className={theme.label}>時間</label>
                  
                  {loadingSlots ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="animate-spin text-gray-400" />
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                      予約可能な枠がありません
                    </div>
                  ) : (
                    <div className={theme.slotGrid}>
                      {slots.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => slot.available && setTime(slot.time)}
                          disabled={!slot.available}
                          className={theme.slotButton(time === slot.time, slot.available)}
                          style={time === slot.time && storeSettings.liff_template_id === 'simple' ? { backgroundColor: storeSettings.liff_theme_color } : {}}
                        >
                          {slot.time}
                          {!slot.available && (
                            <span className="absolute top-1 right-1 text-xs opacity-50">×</span>
                          )}
                          {slot.available && time !== slot.time && (
                            <span className="absolute top-1 right-1 text-xs opacity-50">○</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                {(storeSettings.booking_system_type === 'salon' || storeSettings.booking_system_type === 'restaurant') && (
                  <button 
                    onClick={() => setStep('menu_select')}
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
