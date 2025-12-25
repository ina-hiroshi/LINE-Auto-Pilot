import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { supabase } from '../lib/supabase'
import { Save, Lock, User, Store as StoreIcon, MessageSquare, Loader2, ExternalLink, Smartphone, Palette, Image as ImageIcon, Grid, MousePointerClick, Calendar, Layout, Instagram, Globe, MapPin, Phone, Ticket, CreditCard, Twitter, Facebook, Youtube, Mail } from 'lucide-react'
import { motion } from 'framer-motion'
import Toast from '../components/Toast'

// Icon mapping for selection
const AVAILABLE_ICONS = [
  { id: 'instagram', icon: Instagram, label: 'Instagram' },
  { id: 'globe', icon: Globe, label: 'Web' },
  { id: 'map-pin', icon: MapPin, label: 'Map' },
  { id: 'phone', icon: Phone, label: 'Phone' },
  { id: 'ticket', icon: Ticket, label: 'Coupon' },
  { id: 'credit-card', icon: CreditCard, label: 'Card' },
  { id: 'twitter', icon: Twitter, label: 'X (Twitter)' },
  { id: 'facebook', icon: Facebook, label: 'Facebook' },
  { id: 'youtube', icon: Youtube, label: 'YouTube' },
  { id: 'mail', icon: Mail, label: 'Mail' },
  { id: 'external-link', icon: ExternalLink, label: 'Link' }
]

// Layout Definitions
const RICH_MENU_LAYOUTS = [
  { id: 'large_4', name: '標準 (2×2)', type: 'large', slots: 4, grid: 'grid-cols-2 grid-rows-2' },
  { id: 'large_6', name: '多機能 (3×2)', type: 'large', slots: 6, grid: 'grid-cols-3 grid-rows-2' },
  { id: 'large_3_upper', name: '上部強調 (1+2)', type: 'large', slots: 3, grid: 'grid-cols-2 grid-rows-2', customGrid: true },
  { id: 'compact_2', name: 'コンパクト (2列)', type: 'compact', slots: 2, grid: 'grid-cols-2 grid-rows-1' },
  { id: 'compact_3', name: 'コンパクト (3列)', type: 'compact', slots: 3, grid: 'grid-cols-3 grid-rows-1' },
]

export default function LineSettings() {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState<'connection' | 'guide' | 'basic' | 'password' | 'booking_page' | 'rich_menu' | 'calendar'>('connection')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Google Calendar State
  const [googleCalendarSettings, setGoogleCalendarSettings] = useState<{
    connected: boolean
    calendar_id?: string
    updated_at?: string
  }>({ connected: false })
  
  // Line Settings State
  const [lineSettings, setLineSettings] = useState({
    channel_id: '',
    channel_secret: '',
    channel_token: '',
    bot_id: ''
  })

  // Profile & Store State
  const [storeId, setStoreId] = useState<string | null>(null)
  const [profileData, setProfileData] = useState({
    full_name: '',
    full_name_kana: '',
    user_phone_number: '',
    store_name: '',
    postal_code: '',
    address: '',
    store_phone_number: '',
    industry: ''
  })

  // Booking Page Settings State
  const [bookingSettings, setBookingSettings] = useState({
    liff_template_id: 'simple',
    liff_theme_color: '#00c3dc',
    liff_logo_url: ''
  })

  // Rich Menu Settings State
  const [richMenuSettings, setRichMenuSettings] = useState({
    template_id: 'simple', // Design Theme: simple, elegant, pop, dark
    layout_id: 'large_4', // Layout: large_4, large_6, etc.
    custom_image_url: '',
    // Dynamic actions based on slots. 
    // Slot 1 & 2 are always Booking & Keyboard.
    // Slots 3+ are optional.
    actions: {} as Record<number, { label: string, url: string, icon: string }>
  })

  // Password State
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  })

  // Icon Selector State
  const [openIconSelector, setOpenIconSelector] = useState<number | null>(null)

  // Preview Refresh State
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const richMenuRef = useRef<HTMLDivElement>(null)

  // Send settings to iframe when they change
  useEffect(() => {
    if (activeTab === 'booking_page' && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'UPDATE_SETTINGS',
        settings: bookingSettings
      }, '*')
    }
  }, [bookingSettings, activeTab])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    const code = params.get('code')

    if (code) {
      handleGoogleCallback(code)
      // Remove code from URL
      window.history.replaceState({}, '', window.location.pathname + (tab ? `?tab=${tab}` : ''))
    }

    if (tab === 'connection' || tab === 'guide' || tab === 'basic' || tab === 'password' || tab === 'booking_page' || tab === 'rich_menu' || tab === 'calendar') {
      setActiveTab(tab as any)
    }
  }, [location])

  const handleGoogleConnect = async () => {
    try {
      setSaving(true)
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
      setMessage({ type: 'error', text: 'Google連携の開始に失敗しました: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleGoogleCallback = async (code: string) => {
    try {
      setSaving(true)
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
      
      setMessage({ type: 'success', text: 'Googleカレンダーと連携しました。' })
      fetchData()
    } catch (error: any) {
      console.error('Google Callback Error:', error)
      setMessage({ type: 'error', text: 'Google連携に失敗しました: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // 10秒のタイムアウトを設定
      const getUserWithTimeout = async () => {
        const timeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 10000)
        })
        return Promise.race([supabase.auth.getUser(), timeout])
      }

      const { data: { user } } = await (getUserWithTimeout() as Promise<{ data: { user: import('@supabase/supabase-js').User | null } }>)
      
      if (!user) {
        window.location.href = '/'
        return
      }

      // Fetch Google Calendar Settings
      const { data: calendarSettings } = await supabase
        .from('google_calendar_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (calendarSettings) {
        setGoogleCalendarSettings({
          connected: true,
          calendar_id: calendarSettings.calendar_id,
          updated_at: calendarSettings.updated_at
        })
      } else {
        setGoogleCalendarSettings({ connected: false })
      }

      // Fetch Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      // Fetch Store
      const { data: stores } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', user.id)
        .limit(1)
      
      const store = stores && stores.length > 0 ? stores[0] : null
      if (store) {
        setStoreId(store.id)
        setBookingSettings({
          liff_template_id: store.liff_template_id || 'simple',
          liff_theme_color: store.liff_theme_color || '#00c3dc',
          liff_logo_url: store.liff_logo_url || ''
        })
        // Load Rich Menu Settings (Mock for now, assuming stored in JSON or separate columns)
        // In real implementation, parse store.rich_menu_custom_json
        setRichMenuSettings({
            template_id: store.rich_menu_template_id || 'simple',
            layout_id: store.rich_menu_layout_id || 'large_4',
            custom_image_url: store.rich_menu_custom_image_url || '',
            actions: store.rich_menu_actions || {}
        })
      }

      // Fetch Line Account
      const { data: lineAccounts } = await supabase
        .from('line_accounts')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)
      
      const lineAccount = lineAccounts && lineAccounts.length > 0 ? lineAccounts[0] : null

      if (lineAccount) {
        setLineSettings({
          channel_id: lineAccount.channel_id || '',
          channel_secret: lineAccount.channel_secret || '',
          channel_token: lineAccount.channel_access_token || '',
          bot_id: lineAccount.bot_id || ''
        })
      }

      if (profile || store) {
        setProfileData({
          full_name: profile?.full_name || '',
          full_name_kana: profile?.full_name_kana || '',
          user_phone_number: profile?.phone_number || '',
          store_name: store?.name || '',
          postal_code: store?.postal_code || '',
          address: store?.address || '',
          store_phone_number: store?.phone_number || '',
          industry: store?.industry || ''
        })
      }
    } catch (error: unknown) {
      console.error('Error fetching data:', error)
      // タイムアウトや認証エラー（セッション切れ）の場合のみトップページへ
      // ネットワークエラーなどの一時的なエラーでリダイレクトされないようにする
      const err = error as { message?: string, status?: number }
      if (err.message === 'Timeout' || err.status === 401) {
        window.location.href = '/'
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePostalCodeSearch = async () => {
    if (!profileData.postal_code || profileData.postal_code.length < 7) return
    
    try {
      const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${profileData.postal_code}`)
      const data = await response.json()
      if (data.results) {
        const result = data.results[0]
        const fullAddress = `${result.address1}${result.address2}${result.address3}`
        setProfileData(prev => ({ ...prev, address: fullAddress }))
      } else {
        alert('住所が見つかりませんでした。')
      }
    } catch (error) {
      console.error('Address search error:', error)
    }
  }

  const handleUpdateBookingSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { error } = await supabase
        .from('stores')
        .update({
          liff_template_id: bookingSettings.liff_template_id,
          liff_theme_color: bookingSettings.liff_theme_color,
          liff_logo_url: bookingSettings.liff_logo_url
        })
        .eq('owner_id', user.id)

      if (error) throw error

      setMessage({ type: 'success', text: '予約ページ設定を保存しました' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '不明なエラー'
      setMessage({ type: 'error', text: '保存に失敗しました: ' + message })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateRichMenuSettings = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!import.meta.env.VITE_LIFF_ID) {
      setMessage({ type: 'error', text: '環境変数 VITE_LIFF_ID が設定されていません。.envファイルにLIFF IDを追加してください。' })
      return
    }

    console.log('Sending LIFF ID to backend:', import.meta.env.VITE_LIFF_ID)

    setSaving(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      // 0. Generate Image using Canvas API (No html2canvas)
      let generatedImageUrl = null
      
      const generateImage = async (): Promise<Blob> => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas context not supported')

        const layout = RICH_MENU_LAYOUTS.find(l => l.id === richMenuSettings.layout_id) || RICH_MENU_LAYOUTS[0]
        const width = 1200
        const height = layout.id.startsWith('compact') ? 405 : 810
        canvas.width = width
        canvas.height = height

        // Colors
        const colors = {
          simple: { bg: '#e5e7eb', slot: '#ffffff', text: '#1f2937' },
          elegant: { bg: '#D4C4B7', slot: '#F5F5F0', text: '#5D4037' },
          pop: { bg: '#00B8A9', slot: '#f0fdfa', text: '#0f766e' },
          dark: { bg: '#334155', slot: '#1e293b', text: '#ffffff' }
        }
        const theme = colors[richMenuSettings.template_id as keyof typeof colors] || colors.simple

        // Fill Background
        ctx.fillStyle = theme.bg
        ctx.fillRect(0, 0, width, height)

        // Custom Image
        if (richMenuSettings.custom_image_url) {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          await new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = reject
            img.src = richMenuSettings.custom_image_url
          })
          // Cover
          const scale = Math.max(width / img.width, height / img.height)
          const x = (width - img.width * scale) / 2
          const y = (height - img.height * scale) / 2
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
          
          return new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Blob failed')), 'image/png'))
        }

        // Draw Slots
        const gap = 4
        
        const drawSlot = async (slotNum: number, x: number, y: number, w: number, h: number) => {
          ctx.fillStyle = theme.slot
          ctx.fillRect(x, y, w, h)

          let IconComp = ExternalLink
          let label = '未設定'
          let isSet = false

          if (slotNum === 1) {
            IconComp = Smartphone
            label = '予約する'
            isSet = true
          } else if (slotNum === 2) {
            IconComp = MessageSquare
            label = 'メッセージ入力'
            isSet = true
          } else {
            const action = richMenuSettings.actions[slotNum]
            if (action) {
              const found = AVAILABLE_ICONS.find(i => i.id === action.icon)
              if (found) IconComp = found.icon
              label = action.label || '未設定'
              isSet = true
            }
          }

          if (!isSet) ctx.globalAlpha = 0.5

          // Icon
          const svgString = renderToStaticMarkup(
            <IconComp 
              size={64} 
              color={theme.text} 
              strokeWidth={2}
            />
          )
          const img = new Image()
          const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
          const url = URL.createObjectURL(svgBlob)
          
          await new Promise((resolve) => {
            img.onload = resolve
            img.src = url
          })
          
          const iconSize = 64
          const iconX = x + (w - iconSize) / 2
          const iconY = y + (h - iconSize) / 2 - 20

          ctx.drawImage(img, iconX, iconY, iconSize, iconSize)
          URL.revokeObjectURL(url)

          // Text
          ctx.fillStyle = theme.text
          ctx.font = 'bold 36px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText(label, x + w / 2, iconY + iconSize + 16)

          ctx.globalAlpha = 1.0
        }

        // Grid Logic
        if (layout.id === 'large_3_upper') {
          const h = (height - gap) / 2
          const w = (width - gap) / 2
          await drawSlot(1, 0, 0, width, h)
          await drawSlot(2, 0, h + gap, w, h)
          await drawSlot(3, w + gap, h + gap, w, h)
        } else {
          const rows = layout.id.startsWith('compact') ? 1 : 2
          const cols = (layout.id.includes('3') && !layout.id.includes('upper')) || layout.id.includes('6') ? 3 : 2
          
          const cellW = (width - (cols - 1) * gap) / cols
          const cellH = (height - (rows - 1) * gap) / rows

          let slotCount = 1
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const x = c * (cellW + gap)
              const y = r * (cellH + gap)
              await drawSlot(slotCount, x, y, cellW, cellH)
              slotCount++
            }
          }
        }

        return new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Blob failed')), 'image/png'))
      }

      try {
        const blob = await generateImage()
        const fileName = `rich-menu-${storeId}-${Date.now()}.png`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('rich_menus')
          .upload(fileName, blob, {
            upsert: true,
            contentType: 'image/png'
          })
        
        if (uploadError) throw uploadError
        
        const { data: { publicUrl } } = supabase.storage
          .from('rich_menus')
          .getPublicUrl(fileName)
        
        generatedImageUrl = publicUrl
      } catch (imgError: any) {
        console.error('Image generation failed:', imgError)
        throw new Error('リッチメニュー画像の生成に失敗しました: ' + (imgError?.message || String(imgError)))
      }

      // 1. Save Settings to DB
      const { error } = await supabase
        .from('stores')
        .update({
          rich_menu_template_id: richMenuSettings.template_id,
          rich_menu_layout_id: richMenuSettings.layout_id,
          rich_menu_custom_image_url: richMenuSettings.custom_image_url,
          rich_menu_actions: richMenuSettings.actions
          // Store other settings in JSON if needed
        })
        .eq('owner_id', user.id)

      if (error) throw error

      // 2. Call Edge Function to Apply Rich Menu to LINE
      const { error: apiError } = await supabase.functions.invoke('apply-rich-menu', {
        body: { 
          store_id: storeId,
          generated_image_url: generatedImageUrl,
          liff_id: import.meta.env.VITE_LIFF_ID
        }
      })
      if (apiError) throw apiError

      setMessage({ type: 'success', text: 'リッチメニュー設定を保存・反映しました' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '不明なエラー'
      setMessage({ type: 'error', text: '保存に失敗しました: ' + message })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateLineSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      // Verify token and get Bot User ID
      let lineUserId = null
      let basicId = null
      if (lineSettings.channel_token) {
        const { data: botInfo, error: botError } = await supabase.functions.invoke('get-line-bot-info', {
          body: { channel_token: lineSettings.channel_token }
        })

        if (botError) throw new Error('LINEアクセストークンの検証に失敗しました: ' + botError.message)
        if (botInfo?.userId) {
          lineUserId = botInfo.userId
          basicId = botInfo.basicId
        } else {
          throw new Error('LINE Bot情報の取得に失敗しました。アクセストークンを確認してください。')
        }
      }

      // Check if line account exists
      const { data: existing } = await supabase
        .from('line_accounts')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      let error
      if (existing) {
        const { error: updateError } = await supabase
          .from('line_accounts')
          .update({
            channel_id: lineSettings.channel_id,
            channel_secret: lineSettings.channel_secret,
            channel_access_token: lineSettings.channel_token,
            line_user_id: lineUserId,
            bot_id: basicId,
            store_id: storeId,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
        error = updateError
      } else {
        const { error: insertError } = await supabase
          .from('line_accounts')
          .insert({
            user_id: user.id,
            channel_id: lineSettings.channel_id,
            channel_secret: lineSettings.channel_secret,
            channel_access_token: lineSettings.channel_token,
            line_user_id: lineUserId,
            bot_id: basicId,
            store_id: storeId
          })
        error = insertError
      }

      if (error) throw error

      // Update local state with new bot_id if available
      if (basicId) {
        setLineSettings(prev => ({ ...prev, bot_id: basicId }))
      }

      setMessage({ type: 'success', text: 'LINE設定を保存しました' })
    } catch (error: unknown) {
      console.error('Save error:', error)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message = error instanceof Error ? error.message : (error as any)?.message || '不明なエラー'
      setMessage({ type: 'error', text: '保存に失敗しました: ' + message })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      // Update Profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          full_name_kana: profileData.full_name_kana,
          phone_number: profileData.user_phone_number
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // Update Store
      const { error: storeError } = await supabase
        .from('stores')
        .update({
          name: profileData.store_name,
          postal_code: profileData.postal_code,
          address: profileData.address,
          phone_number: profileData.store_phone_number,
          industry: profileData.industry
        })
        .eq('owner_id', user.id)

      if (storeError) throw storeError

      // Notify other components (like Layout) that profile has changed
      window.dispatchEvent(new Event('profile-updated'))

      setMessage({ type: 'success', text: '基本情報を更新しました' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '不明なエラー'
      setMessage({ type: 'error', text: '更新に失敗しました: ' + message })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'パスワードが一致しません' })
      return
    }
    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'パスワードは6文字以上で設定してください' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (error) throw error

      setMessage({ type: 'success', text: 'パスワードを更新しました' })
      setPasswordData({ newPassword: '', confirmPassword: '' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '不明なエラー'
      setMessage({ type: 'error', text: 'パスワード更新に失敗しました: ' + message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="mb-4"
        >
          <Loader2 className="w-10 h-10 text-primary-600" />
        </motion.div>
        <p className="text-slate-600 font-medium">読み込み中...</p>
      </div>
    )
  }

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-webhook`

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-8 text-gray-800">
        設定
      </h1>

      {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-8 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-4 sm:px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'basic' ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            店舗情報
            {activeTab === 'basic' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />}
          </button>
          <button
            onClick={() => setActiveTab('booking_page')}
            className={`px-4 sm:px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'booking_page' ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            予約ページ
            {activeTab === 'booking_page' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />}
          </button>
          <button
            onClick={() => setActiveTab('rich_menu')}
            className={`px-4 sm:px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'rich_menu' ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            リッチメニュー
            {activeTab === 'rich_menu' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />}
          </button>
          <button
            onClick={() => setActiveTab('connection')}
            className={`px-4 sm:px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'connection' ? 'text-[#06C755]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            LINE連携
            {activeTab === 'connection' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06C755]" />}
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-4 sm:px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'guide' ? 'text-[#06C755]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            導入ガイド
            {activeTab === 'guide' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#06C755]" />}
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`px-4 sm:px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'password' ? 'text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            パスワード変更
            {activeTab === 'password' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-800" />}
          </button>
        </div>

        <div className="space-y-8">
        {/* 予約ページ設定 */}
        {activeTab === 'booking_page' && (
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 pb-2 border-b">
              <Smartphone className="text-primary-600" size={24} />
              <h2 className="text-xl font-bold text-gray-800">予約ページ設定</h2>
            </div>
            
            <form onSubmit={handleUpdateBookingSettings} className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 左カラム：設定 */}
                <div className="space-y-8">
                  {/* テンプレート選択 */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                      <Palette size={16} /> デザインテーマ選択
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { id: 'simple', name: 'シンプル', color: 'bg-gray-50 border-gray-200' },
                        { id: 'elegant', name: 'エレガント', color: 'bg-[#F5F5F0] border-[#E0E0D0]' },
                        { id: 'pop', name: 'ポップ', color: 'bg-primary-50 border-primary-200' },
                        { id: 'dark', name: 'ダーク', color: 'bg-slate-800 text-white border-slate-700' }
                      ].map((template) => (
                        <label 
                          key={template.id}
                          className={`
                            relative cursor-pointer rounded-lg border-2 p-4 transition-all flex flex-col items-center justify-center gap-2 h-24
                            ${bookingSettings.liff_template_id === template.id 
                              ? 'border-primary-500 ring-2 ring-primary-100' 
                              : 'border-gray-200 hover:border-gray-300'}
                            ${template.color}
                          `}
                        >
                          <input
                            type="radio"
                            name="template"
                            value={template.id}
                            checked={bookingSettings.liff_template_id === template.id}
                            onChange={(e) => setBookingSettings({...bookingSettings, liff_template_id: e.target.value})}
                            className="sr-only"
                          />
                          <div className="text-center text-sm font-medium">{template.name}</div>
                          {bookingSettings.liff_template_id === template.id && (
                            <div className="absolute top-2 right-2 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full" />
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 右カラム：プレビュー */}
                <div className="lg:sticky lg:top-8 h-fit">
                  <div className="mb-4 flex items-center justify-between w-full max-w-[320px] mx-auto">
                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Smartphone size={16} /> プレビュー
                    </h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewRefreshKey(prev => prev + 1)}
                        className="text-xs flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50"
                      >
                        <ExternalLink size={12} /> リロード
                      </button>
                      <a
                        href={`/booking${storeId ? `?store_id=${storeId}` : ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 rounded hover:bg-primary-100"
                      >
                        <ExternalLink size={12} /> 別タブ
                      </a>
                    </div>
                  </div>
                  
                  <div className="bg-gray-800 rounded-[3rem] p-4 border-4 border-gray-900 shadow-2xl max-w-[320px] mx-auto">
                    <div className="bg-white rounded-[2rem] overflow-hidden h-[600px] relative flex flex-col">
                      {/* Header */}
                      <div className="bg-slate-100 p-4 border-b flex items-center justify-between shrink-0">
                        <div className="w-4 h-4 rounded-full bg-slate-300" />
                        <div className="w-20 h-2 rounded-full bg-slate-300" />
                        <div className="w-4 h-4 rounded-full bg-slate-300" />
                      </div>

                      {/* Content */}
                      <iframe
                        ref={iframeRef}
                        key={previewRefreshKey}
                        src={`/booking${storeId ? `?store_id=${storeId}` : ''}`}
                        className="w-full h-full bg-white"
                        title="LIFF Booking Preview"
                      />
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-gray-500 text-center max-w-md mx-auto">
                    ※設定を保存した後、リロードボタンを押すと変更が反映されます。
                  </p>
                </div>
              </div>

              {/* カスタマイズ (Proプラン) */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <ImageIcon size={16} /> カスタマイズ
                  </h3>
                  <span className="text-xs font-bold px-2 py-1 bg-gradient-to-r from-amber-200 to-yellow-400 text-yellow-900 rounded-full">
                    Proプラン機能
                  </span>
                </div>
                
                <div className="grid grid-cols-1 gap-6 max-w-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">テーマカラー</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={bookingSettings.liff_theme_color}
                        onChange={(e) => setBookingSettings({...bookingSettings, liff_theme_color: e.target.value})}
                        className="h-10 w-20 p-1 rounded border border-gray-300 cursor-pointer"
                      />
                      <span className="text-sm text-gray-500 font-mono">{bookingSettings.liff_theme_color}</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ロゴ画像 URL</label>
                    <input
                      type="text"
                      value={bookingSettings.liff_logo_url}
                      onChange={(e) => setBookingSettings({...bookingSettings, liff_logo_url: e.target.value})}
                      placeholder="https://example.com/logo.png"
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">※現在はURL直接入力のみ対応</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
                  {saving ? '保存中...' : '設定を保存'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* リッチメニュー設定 */}
        {activeTab === 'rich_menu' && (
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 pb-2 border-b">
              <Grid className="text-primary-600" size={24} />
              <h2 className="text-xl font-bold text-gray-800">リッチメニュー設定</h2>
            </div>
            
            <form onSubmit={handleUpdateRichMenuSettings} className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                  {/* レイアウト選択 */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                      <Layout size={16} /> レイアウト
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {RICH_MENU_LAYOUTS.map((layout) => (
                        <label 
                          key={layout.id}
                          className={`
                            relative cursor-pointer rounded-lg border-2 p-4 transition-all flex flex-col items-center justify-center gap-2 h-24
                            ${richMenuSettings.layout_id === layout.id 
                              ? 'border-primary-500 ring-2 ring-primary-100 bg-primary-50' 
                              : 'border-gray-200 hover:border-gray-300 bg-gray-50'}
                          `}
                        >
                          <input
                            type="radio"
                            name="rm_layout"
                            value={layout.id}
                            checked={richMenuSettings.layout_id === layout.id}
                            onChange={(e) => setRichMenuSettings({...richMenuSettings, layout_id: e.target.value})}
                            className="sr-only"
                          />
                          <div className="text-center text-sm font-medium">{layout.name}</div>
                          {richMenuSettings.layout_id === layout.id && (
                            <div className="absolute top-2 right-2 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full" />
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* テンプレート選択 */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                      <Palette size={16} /> デザインテーマ
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { id: 'simple', name: 'シンプル', color: 'bg-gray-50 border-gray-200' },
                        { id: 'elegant', name: 'エレガント', color: 'bg-[#F5F5F0] border-[#E0E0D0]' },
                        { id: 'pop', name: 'ポップ', color: 'bg-primary-50 border-primary-200' },
                        { id: 'dark', name: 'ダーク', color: 'bg-slate-800 text-white border-slate-700' }
                      ].map((template) => (
                        <label 
                          key={template.id}
                          className={`
                            relative cursor-pointer rounded-lg border-2 p-4 transition-all flex flex-col items-center justify-center gap-2 h-24
                            ${richMenuSettings.template_id === template.id 
                              ? 'border-primary-500 ring-2 ring-primary-100' 
                              : 'border-gray-200 hover:border-gray-300'}
                            ${template.color}
                          `}
                        >
                          <input
                            type="radio"
                            name="rm_template"
                            value={template.id}
                            checked={richMenuSettings.template_id === template.id}
                            onChange={(e) => setRichMenuSettings({...richMenuSettings, template_id: e.target.value})}
                            className="sr-only"
                          />
                          <div className="text-center text-sm font-medium">{template.name}</div>
                          {richMenuSettings.template_id === template.id && (
                            <div className="absolute top-2 right-2 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full" />
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* ボタン設定 */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                      <MousePointerClick size={16} /> ボタン設定
                    </h3>
                    
                    <div className="space-y-4">
                      {/* Dynamic Slots based on Layout */}
                      {(() => {
                        const layout = RICH_MENU_LAYOUTS.find(l => l.id === richMenuSettings.layout_id) || RICH_MENU_LAYOUTS[0]
                        const slots = Array.from({ length: layout.slots }, (_, i) => i + 1)
                        
                        return slots.map(slotNum => {
                          // Slot 1 & 2 are fixed
                          if (slotNum === 1) {
                            return (
                              <div key={slotNum} className="p-3 bg-gray-50 rounded-lg border border-gray-200 relative">
                                <div className="absolute -top-2.5 left-3 bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                  ボタン 1 (必須)
                                </div>
                                <div className="mt-2 flex items-center gap-3">
                                  <div className="w-8 h-8 bg-primary-100 rounded flex items-center justify-center text-primary-600">
                                    <Smartphone size={16} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-800">予約する</p>
                                  </div>
                                </div>
                              </div>
                            )
                          }
                          if (slotNum === 2) {
                            return (
                              <div key={slotNum} className="p-3 bg-gray-50 rounded-lg border border-gray-200 relative">
                                <div className="absolute -top-2.5 left-3 bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                  ボタン 2 (必須)
                                </div>
                                <div className="mt-2 flex items-center gap-3">
                                  <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-gray-600">
                                    <MessageSquare size={16} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-800">メッセージ入力</p>
                                  </div>
                                </div>
                              </div>
                            )
                          }

                          // Optional Slots
                          const action = richMenuSettings.actions[slotNum] || { label: '', url: '', icon: 'external-link' }
                          
                          return (
                            <div key={slotNum} className="p-3 bg-white rounded-lg border border-gray-200 relative">
                              <div className="absolute -top-2.5 left-3 bg-gray-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                ボタン {slotNum} (任意)
                              </div>
                              <div className="mt-2 space-y-3">
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">ラベル</label>
                                    <input
                                      type="text"
                                      value={action.label}
                                      onChange={(e) => {
                                        const newActions = { ...richMenuSettings.actions }
                                        newActions[slotNum] = { ...action, label: e.target.value }
                                        setRichMenuSettings({ ...richMenuSettings, actions: newActions })
                                      }}
                                      className="w-full p-1.5 border rounded text-sm"
                                      placeholder="例: Instagram"
                                    />
                                  </div>
                                  <div className="relative">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">アイコン</label>
                                    <button
                                      type="button"
                                      onClick={() => setOpenIconSelector(openIconSelector === slotNum ? null : slotNum)}
                                      className="w-28 p-1.5 border rounded text-sm flex items-center justify-between bg-white hover:bg-gray-50"
                                    >
                                      <div className="flex items-center gap-2 overflow-hidden">
                                        {(() => {
                                          const SelectedIcon = AVAILABLE_ICONS.find(i => i.id === action.icon)?.icon || ExternalLink
                                          return <SelectedIcon size={16} className="shrink-0" />
                                        })()}
                                        <span className="truncate text-xs">
                                          {AVAILABLE_ICONS.find(i => i.id === action.icon)?.label || 'Link'}
                                        </span>
                                      </div>
                                    </button>
                                    
                                    {openIconSelector === slotNum && (
                                      <>
                                        <div className="fixed inset-0 z-40" onClick={() => setOpenIconSelector(null)} />
                                        <div className="absolute z-50 top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl p-2 grid grid-cols-4 gap-2">
                                          {AVAILABLE_ICONS.map(iconItem => (
                                            <button
                                              key={iconItem.id}
                                              type="button"
                                              onClick={() => {
                                                const newActions = { ...richMenuSettings.actions }
                                                newActions[slotNum] = { ...action, icon: iconItem.id }
                                                setRichMenuSettings({ ...richMenuSettings, actions: newActions })
                                                setOpenIconSelector(null)
                                              }}
                                              className={`flex flex-col items-center justify-center p-2 rounded hover:bg-gray-100 ${action.icon === iconItem.id ? 'bg-primary-50 text-primary-600' : 'text-gray-600'}`}
                                              title={iconItem.label}
                                            >
                                              <iconItem.icon size={20} className="mb-1" />
                                              <span className="text-[10px] truncate w-full text-center">{iconItem.label}</span>
                                            </button>
                                          ))}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
                                  <input
                                    type="text"
                                    value={action.url}
                                    onChange={(e) => {
                                      const newActions = { ...richMenuSettings.actions }
                                      newActions[slotNum] = { ...action, url: e.target.value }
                                      setRichMenuSettings({ ...richMenuSettings, actions: newActions })
                                    }}
                                    className="w-full p-1.5 border rounded text-sm"
                                    placeholder="https://..."
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  </div>
                </div>

                {/* プレビューエリア */}
                <div className="lg:sticky lg:top-8 h-fit">
                  <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Smartphone size={16} /> プレビュー
                  </h3>
                  <div className="bg-gray-800 rounded-[3rem] p-4 border-4 border-gray-900 shadow-2xl max-w-[320px] mx-auto">
                    <div className="bg-white rounded-[2rem] overflow-hidden h-[600px] relative flex flex-col">
                      {/* Header */}
                      <div className="bg-slate-100 p-4 border-b flex items-center justify-between shrink-0">
                        <div className="w-4 h-4 rounded-full bg-slate-300" />
                        <div className="w-20 h-2 rounded-full bg-slate-300" />
                        <div className="w-4 h-4 rounded-full bg-slate-300" />
                      </div>
                      
                      {/* Chat Area */}
                      <div className="flex-1 bg-[#8C9DA9] p-4 overflow-hidden relative">
                        <div className="flex gap-2 mb-4">
                          <div className="w-8 h-8 rounded-full bg-white shrink-0" />
                          <div className="bg-white p-2 rounded-lg rounded-tl-none text-xs max-w-[70%] shadow-sm">
                            いらっしゃいませ！<br/>
                            下のメニューからご予約いただけます。
                          </div>
                        </div>
                      </div>

                      {/* Rich Menu Preview */}
                      <div className="shrink-0 border-t border-gray-200">
                        <div className="bg-gray-100 px-4 py-1 flex justify-between items-center text-[10px] text-gray-500 border-b border-gray-200">
                          <span>メニュー ▲</span>
                          <span>キーボード</span>
                        </div>
                        <div className={`w-full relative ${richMenuSettings.layout_id.startsWith('compact') ? 'aspect-[3/1]' : 'aspect-[1.5/1]'}`}>
                          {/* Custom Image Background if set */}
                          {richMenuSettings.custom_image_url ? (
                            <img 
                              src={richMenuSettings.custom_image_url} 
                              alt="Rich Menu Background" 
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          ) : (
                            // Template Backgrounds
                            <div className={`absolute inset-0 w-full h-full grid gap-0.5 p-0.5
                              ${(() => {
                                const layout = RICH_MENU_LAYOUTS.find(l => l.id === richMenuSettings.layout_id)
                                if (layout?.id === 'large_3_upper') return 'grid-cols-2 grid-rows-2' // Special handling
                                return layout?.grid || 'grid-cols-2 grid-rows-2'
                              })()}
                              ${richMenuSettings.template_id === 'simple' ? 'bg-gray-200' : ''}
                              ${richMenuSettings.template_id === 'elegant' ? 'bg-[#D4C4B7]' : ''}
                              ${richMenuSettings.template_id === 'pop' ? 'bg-primary-500' : ''}
                              ${richMenuSettings.template_id === 'dark' ? 'bg-slate-700' : ''}
                            `}>
                              {(() => {
                                const layout = RICH_MENU_LAYOUTS.find(l => l.id === richMenuSettings.layout_id) || RICH_MENU_LAYOUTS[0]
                                const slots = Array.from({ length: layout.slots }, (_, i) => i + 1)
                                
                                return slots.map(slotNum => {
                                  // Determine content
                                  let icon = <ExternalLink size={20} className="mb-1" />
                                  let label = '未設定'
                                  let isSet = false

                                  if (slotNum === 1) {
                                    icon = <Smartphone size={20} className="mb-1" />
                                    label = '予約する'
                                    isSet = true
                                  } else if (slotNum === 2) {
                                    icon = <MessageSquare size={20} className="mb-1" />
                                    label = 'メッセージ入力'
                                    isSet = true
                                  } else {
                                    const action = richMenuSettings.actions[slotNum]
                                    if (action) {
                                      const IconComp = AVAILABLE_ICONS.find(i => i.id === action.icon)?.icon || ExternalLink
                                      icon = <IconComp size={20} className="mb-1" />
                                      label = action.label || '未設定'
                                      isSet = true
                                    }
                                  }

                                  // Determine style
                                  const styleClass = `
                                    flex flex-col items-center justify-center p-2 overflow-hidden
                                    ${richMenuSettings.template_id === 'simple' ? 'bg-white text-gray-800' : ''}
                                    ${richMenuSettings.template_id === 'elegant' ? 'bg-[#F5F5F0] text-[#5D4037]' : ''}
                                    ${richMenuSettings.template_id === 'pop' ? 'bg-primary-50 text-primary-700' : ''}
                                    ${richMenuSettings.template_id === 'dark' ? 'bg-slate-800 text-white' : ''}
                                    ${!isSet ? 'opacity-50' : ''}
                                  `

                                  // Special Grid Handling for large_3_upper
                                  let gridSpan = ''
                                  if (layout.id === 'large_3_upper') {
                                    if (slotNum === 1) gridSpan = 'col-span-2'
                                  }

                                  return (
                                    <div key={slotNum} className={`${styleClass} ${gridSpan}`}>
                                      {icon}
                                      <span className="text-[10px] font-bold truncate w-full text-center">{label}</span>
                                    </div>
                                  )
                                })
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-xs text-gray-500 mt-4">
                    ※実際の表示は端末により多少異なる場合があります
                  </p>
                </div>
              </div>

              {/* カスタム画像 (Pro) */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <ImageIcon size={16} /> 背景画像カスタマイズ
                  </h3>
                  <span className="text-xs font-bold px-2 py-1 bg-gradient-to-r from-amber-200 to-yellow-400 text-yellow-900 rounded-full">
                    Proプラン機能
                  </span>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">画像 URL</label>
                  <input
                    type="text"
                    value={richMenuSettings.custom_image_url}
                    onChange={(e) => setRichMenuSettings({...richMenuSettings, custom_image_url: e.target.value})}
                    placeholder="https://example.com/richmenu.png"
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">※未設定の場合はシステム標準の画像が使用されます</p>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
                  {saving ? '保存中...' : '設定を保存してLINEに反映'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Google Calendar Settings */}
        {activeTab === 'calendar' && (
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
                      Googleカレンダーと正常に連携しています。<br/>
                      カレンダーID: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{googleCalendarSettings.calendar_id || 'primary'}</span>
                    </p>
                    <div className="text-xs text-gray-400 mb-6">
                      最終更新: {new Date(googleCalendarSettings.updated_at || '').toLocaleString()}
                    </div>
                    <button
                      onClick={() => {
                        if (confirm('連携を解除してもよろしいですか？')) {
                          // TODO: Implement disconnect
                          alert('連携解除機能は現在開発中です。');
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
                      Googleアカウントにログインして、<br/>
                      カレンダーへのアクセスを許可してください。
                    </p>
                    <button
                      onClick={handleGoogleConnect}
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
        )}

        {/* 接続設定 */}
        {activeTab === 'connection' && (
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 pb-2 border-b">
              <MessageSquare className="text-[#06C755]" size={24} />
              <h2 className="text-xl font-bold text-gray-800">接続設定</h2>
            </div>
            <form className="space-y-4" onSubmit={handleUpdateLineSettings} autoComplete="off">
              {lineSettings.bot_id && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg mb-2 flex items-center gap-3">
                  <div className="bg-[#06C755] p-2 rounded-full text-white">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">連携中のアカウント (Basic ID)</p>
                    <p className="text-lg font-bold text-gray-800">{lineSettings.bot_id}</p>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel ID</label>
                <input 
                  type="text" 
                  value={lineSettings.channel_id}
                  onChange={(e) => setLineSettings({...lineSettings, channel_id: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#06C755]/20 outline-none" 
                  placeholder="1234567890" 
                  autoComplete="off"
                  name="line_channel_id_field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel Secret</label>
                <input 
                  type="password" 
                  value={lineSettings.channel_secret}
                  onChange={(e) => setLineSettings({...lineSettings, channel_secret: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#06C755]/20 outline-none" 
                  placeholder="••••••••" 
                  autoComplete="new-password"
                  name="line_channel_secret_field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel Access Token</label>
                <textarea 
                  value={lineSettings.channel_token}
                  onChange={(e) => setLineSettings({...lineSettings, channel_token: e.target.value})}
                  className="w-full p-2 border rounded-lg h-24 focus:ring-2 focus:ring-[#06C755]/20 outline-none" 
                  placeholder="Long lived access token..."
                  autoComplete="off"
                  name="line_channel_token_field"
                ></textarea>
              </div>
              
              <div className="flex justify-end pt-4">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="flex items-center gap-2 bg-[#06C755] text-white px-6 py-2.5 rounded-lg hover:bg-[#05b34c] transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
                  設定を保存
                </button>
              </div>
            </form>
          </section>
        )}

        {/* 導入ガイド */}
        {activeTab === 'guide' && (
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 pb-2 border-b">
              <MessageSquare className="text-[#06C755]" size={24} />
              <h2 className="text-xl font-bold text-gray-800">導入ガイド</h2>
            </div>
            <div className="space-y-8">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="bg-[#06C755] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                  LINE公式アカウントの作成
                </h3>
                <p className="text-sm text-gray-600 mb-4 ml-8">
                  まだLINE公式アカウントをお持ちでない場合は、以下のリンクから作成してください。
                  すでにお持ちの方はスキップしてください。
                </p>
                <div className="ml-8">
                  <a 
                    href="https://www.linebiz.com/jp/entry/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[#06C755] hover:underline font-medium"
                  >
                    LINE公式アカウント開設ページ <ExternalLink size={16} />
                  </a>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="bg-[#06C755] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                  LINE Developersへの登録とチャネル作成
                </h3>
                <p className="text-sm text-gray-600 mb-4 ml-8">
                  Messaging APIを利用するために、LINE Developersへの登録が必要です。
                </p>
                <ol className="list-decimal list-inside text-sm text-gray-600 ml-8 space-y-2 mb-4">
                  <li><a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="text-[#06C755] hover:underline">LINE Developers Console</a>にログインします。</li>
                  <li>初めての場合は「プロバイダー作成」を行います（店舗名などでOK）。</li>
                  <li>「新規チャネル作成」をクリックし、「Messaging API」を選択します。</li>
                  <li>必要な情報を入力してチャネルを作成します。</li>
                </ol>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="bg-[#06C755] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
                  設定情報の取得と入力
                </h3>
                <p className="text-sm text-gray-600 mb-2 ml-8">
                  作成したチャネルの「チャネル基本設定」および「Messaging API設定」タブから以下の情報を取得し、
                  <button onClick={() => setActiveTab('connection')} className="text-[#06C755] hover:underline font-medium mx-1">接続設定</button>
                  に入力してください。
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 ml-8 space-y-1">
                  <li><strong>Channel ID</strong> (チャネル基本設定タブ)</li>
                  <li><strong>Channel Secret</strong> (チャネル基本設定タブ)</li>
                  <li><strong>Channel Access Token</strong> (Messaging API設定タブ &gt; チャネルアクセストークン発行)</li>
                </ul>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="bg-[#06C755] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">4</span>
                  Webhookの設定
                </h3>
                <p className="text-sm text-gray-600 mb-4 ml-8">
                  LINEからのメッセージを受け取るための設定を行います。
                </p>
                <ol className="list-decimal list-inside text-sm text-gray-600 ml-8 space-y-2">
                  <li>
                    以下の <strong>Webhook URL</strong> をコピーします。
                    <div className="flex gap-2 mt-2 mb-2">
                      <input 
                        type="text" 
                        readOnly
                        value={webhookUrl}
                        className="w-full p-2 border rounded-lg bg-white text-gray-600 outline-none text-xs" 
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(webhookUrl)
                          setMessage({ type: 'success', text: 'Webhook URLをコピーしました' })
                        }}
                        className="px-3 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-xs whitespace-nowrap"
                      >
                        コピー
                      </button>
                    </div>
                  </li>
                  <li>LINE Developers Consoleの「Messaging API設定」タブを開きます。</li>
                  <li>「Webhook設定」の「編集」をクリックし、コピーしたURLを貼り付けて「更新」します。</li>
                  <li><strong>「Webhookの利用」をオン</strong>にします。</li>
                  <li>「検証」ボタンを押して、成功することを確認します。</li>
                </ol>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="bg-[#06C755] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">5</span>
                  応答設定の変更
                </h3>
                <p className="text-sm text-gray-600 mb-4 ml-8">
                  LINE公式アカウントの自動応答と競合しないように設定を変更します。
                </p>
                <ol className="list-decimal list-inside text-sm text-gray-600 ml-8 space-y-2">
                  <li>LINE Developers Consoleの「Messaging API設定」タブにある「LINE公式アカウント機能」の「応答メッセージ」をクリックします（LINE Official Account Managerが開きます）。</li>
                  <li>「応答設定」で以下のように設定します。
                    <ul className="list-disc list-inside ml-4 mt-1 text-gray-500">
                      <li><strong>応答メッセージ</strong>: オフ</li>
                      <li><strong>Webhook</strong>: オン</li>
                    </ul>
                  </li>
                </ol>
              </div>
            </div>
          </section>
        )}

        {/* 基本情報設定 */}
        {activeTab === 'basic' && (
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 pb-2 border-b">
              <User className="text-primary-600" size={24} />
              <h2 className="text-xl font-bold text-gray-800">基本情報設定</h2>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">氏名</label>
                  <input
                    type="text"
                    value={profileData.full_name}
                    onChange={e => setProfileData({...profileData, full_name: e.target.value})}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">フリガナ</label>
                  <input
                    type="text"
                    value={profileData.full_name_kana}
                    onChange={e => setProfileData({...profileData, full_name_kana: e.target.value})}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">電話番号 (個人)</label>
                  <input
                    type="tel"
                    value={profileData.user_phone_number}
                    onChange={e => setProfileData({...profileData, user_phone_number: e.target.value})}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                  />
                </div>
              </div>

              <div className="border-t pt-6 mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <StoreIcon className="text-primary-600" size={20} />
                  <h3 className="text-lg font-semibold text-gray-800">店舗情報</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">店舗名</label>
                    <input
                      type="text"
                      value={profileData.store_name}
                      onChange={e => setProfileData({...profileData, store_name: e.target.value})}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">郵便番号</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={profileData.postal_code}
                        onChange={e => setProfileData({...profileData, postal_code: e.target.value})}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                        placeholder="123-4567"
                      />
                      <button
                        type="button"
                        onClick={handlePostalCodeSearch}
                        className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm whitespace-nowrap"
                      >
                        住所検索
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">業種</label>
                    <select
                      value={profileData.industry}
                      onChange={e => setProfileData({...profileData, industry: e.target.value})}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                    >
                      <option value="">選択してください</option>
                      <option value="restaurant">飲食</option>
                      <option value="retail">小売</option>
                      <option value="beauty">美容・サロン</option>
                      <option value="service">サービス</option>
                      <option value="other">その他</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">住所</label>
                    <input
                      type="text"
                      value={profileData.address}
                      onChange={e => setProfileData({...profileData, address: e.target.value})}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">電話番号 (店舗)</label>
                    <input
                      type="tel"
                      value={profileData.store_phone_number}
                      onChange={e => setProfileData({...profileData, store_phone_number: e.target.value})}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
                  {saving ? '保存中...' : '基本情報を保存'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* パスワード変更 */}
        {activeTab === 'password' && (
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 pb-2 border-b">
              <Lock className="text-gray-600" size={24} />
              <h2 className="text-xl font-bold text-gray-800">パスワード変更</h2>
            </div>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-gray-200 outline-none"
                  placeholder="6文字以上"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード（確認）</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-gray-200 outline-none"
                  placeholder="もう一度入力してください"
                />
              </div>
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-gray-800 text-white px-6 py-2.5 rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock size={18} />}
                  {saving ? '変更中...' : 'パスワードを変更'}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>

      {message && (
        <Toast
          isVisible={true}
          message={message.text}
          type={message.type}
          onClose={() => setMessage(null)}
        />
      )}


    </div>
  )
}
