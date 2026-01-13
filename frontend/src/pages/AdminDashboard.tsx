/**
 * 管理者専用ダッシュボード
 * 
 * タブ形式で以下の機能を提供:
 * - 初期設定依頼: 設定代行サービスの注文管理
 * - プラン変更: デバッグ用のプラン切り替え
 * 
 * 将来的にはユーザーごとの独自機能もここで管理可能
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  Search, 
  Loader2, 
  Check, 
  X, 
  ExternalLink,
  MessageSquare,
  User,
  Mail,
  AlertTriangle,
  Crown,
  Zap,
  Shield,
  ClipboardList,
  Users,
  TrendingUp,
  BarChart3,
  Calendar
} from 'lucide-react'
import Toast from '../components/Toast'
import Modal from '../components/Modal'
import { useUserFeatures } from '../hooks/useUserFeatures'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts'

// タブの定義
type AdminTab = 'setup_orders' | 'plan_switcher' | 'user_analytics'

interface SetupOrder {
  id: string
  user_id: string
  store_id: string | null
  status: string
  amount: number
  contact_email: string | null
  has_line_account: boolean
  line_account_basic_id: string | null
  additional_notes: string | null
  admin_notes: string | null
  assigned_to: string | null
  paid_at: string | null
  completed_at: string | null
  created_at: string
  profiles?: {
    email: string
    full_name: string | null
  }
  stores?: {
    store_name: string
  }
}

interface LineSettings {
  channel_id: string
  channel_secret: string
  channel_token: string
}

type StoreDetail = {
  store_id: string
  store_name: string
  owner_id: string
  has_line_connection: boolean
  bot_id: string | null
  channel_id: string | null
  line_connected_at: string | null
  store_created_at: string
  user_email: string | null
  user_name: string | null
  user_created_at: string | null
  plan: string
  bot_picture_url: string | null
  store_message_count: number
  store_auto_reply_count: number
  store_ai_reply_count: number
  store_reservation_count: number
}

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-webhook`

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { isAdmin, isLoading: featuresLoading } = useUserFeatures()
  const [activeTab, setActiveTab] = useState<AdminTab>('setup_orders')
  
  // 設定代行注文管理の状態
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<SetupOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<SetupOrder | null>(null)
  const [lineSettings, setLineSettings] = useState<LineSettings>({
    channel_id: '',
    channel_secret: '',
    channel_token: ''
  })
  const [adminNotes, setAdminNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  // プラン切り替えの状態
  const [currentPlan, setCurrentPlan] = useState<string>('free')
  const [planLoading, setPlanLoading] = useState(false)
  
  // ユーザー統計の状態
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsData, setAnalyticsData] = useState<{
    summary: {
      totalUsers: number
      paidPlanRate: string
      lineConnectionRate: string
      autoResponseRate: string
    }
    registrations: {
      daily: Array<{ date: string; count: number }>
    }
    plans: {
      distribution: Array<{ name: string; value: number; color: string }>
      counts: Record<string, number>
    }
    messages: {
      total: number
      daily: Array<{ date: string; count: number }>
      statusCounts: Record<string, number>
      autoResponseRate: string
    }
    reservations: {
      total: number
      daily: Array<{ date: string; count: number }>
      statusCounts: Record<string, number>
      registrationTypeCounts: Record<string, number>
    }
    lineConnections: {
      totalStores: number
      connectedStoresCount: number
      connectionRate: string
      details: Array<{
        store_id: string
        store_name: string
        owner_id: string
        has_line_connection: boolean
        bot_id: string | null
        channel_id: string | null
        line_connected_at: string | null
        store_created_at: string
        user_email: string | null
        user_name: string | null
        user_created_at: string | null
        plan: string
        bot_picture_url: string | null
        store_message_count: number
        store_auto_reply_count: number
        store_ai_reply_count: number
        store_reservation_count: number
      }>
    }
  } | null>(null)
  const [lineConnectionSearch, setLineConnectionSearch] = useState('')
  const [lineConnectionFilter, setLineConnectionFilter] = useState<'all' | 'connected' | 'not_connected'>('all')
  const [selectedStoreDetail, setSelectedStoreDetail] = useState<StoreDetail | null>(null)
  const [storeDetailModalOpen, setStoreDetailModalOpen] = useState(false)
  
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success',
  })

  useEffect(() => {
    if (!featuresLoading && !isAdmin) {
      navigate('/')
    }
  }, [featuresLoading, isAdmin, navigate])

  // ===== 設定代行注文管理 =====
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
      
      // まず現在のユーザーと管理者権限を確認
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('User not found')
        setToast({ isVisible: true, message: 'ユーザー情報が見つかりません', type: 'error' })
        return
      }

      // 管理者権限を確認
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      // 注文を取得（リレーションを使わずに）
      const { data: ordersData, error } = await supabase
        .from('setup_service_orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setToast({ isVisible: true, message: '注文の読み込みに失敗しました', type: 'error' })
        return
      }
      
      if (!ordersData || ordersData.length === 0) {
        setOrders([])
        return
      }
      
      // 未決済（pending）の注文を除外
      const filteredOrdersData = ordersData.filter(order => order.status !== 'pending')
      
      if (filteredOrdersData.length === 0) {
        setOrders([])
        return
      }
      
      // ユーザーIDとストアIDのリストを取得
      const userIds = [...new Set(filteredOrdersData.map(o => o.user_id).filter(Boolean))]
      const storeIds = [...new Set(filteredOrdersData.map(o => o.store_id).filter(Boolean))]
      
      // profilesとstoresを別々に取得
      const profilesMap = new Map()
      const storesMap = new Map()
      
      // 管理者の場合はEdge Functionを使用してデータを取得
      const isAdmin = profile?.is_admin || false
      
      if (isAdmin) {
        // 管理者の場合はEdge Functionを使用
        if (userIds.length > 0) {
          try {
            const { data: profilesResponse, error: profilesError } = await supabase.functions.invoke('get-admin-data', {
              body: { type: 'profiles', userIds }
            })
            
            if (!profilesError && profilesResponse?.data) {
              profilesResponse.data.forEach((p: { id: string; email: string; full_name: string | null }) => {
                profilesMap.set(p.id, { email: p.email, full_name: p.full_name })
              })
            }
          } catch {
            // エラーは無視（データ取得に失敗しても続行）
          }
        }
        
        if (storeIds.length > 0) {
          try {
            const { data: storesResponse, error: storesError } = await supabase.functions.invoke('get-admin-data', {
              body: { type: 'stores', storeIds }
            })
            
            if (!storesError && storesResponse?.data) {
              storesResponse.data.forEach((s: { id: string; name: string }) => {
                storesMap.set(s.id, { store_name: s.name })
              })
            }
          } catch {
            // エラーは無視（データ取得に失敗しても続行）
          }
        }
      } else {
        // 通常ユーザーの場合は直接クエリ
        if (userIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, email, full_name')
            .in('id', userIds)
          
          if (profilesError) {
            console.error('Error fetching profiles:', profilesError)
          } else if (profilesData) {
            profilesData.forEach(p => {
              profilesMap.set(p.id, { email: p.email, full_name: p.full_name })
            })
          }
        }
        
        if (storeIds.length > 0) {
          const { data: storesData } = await supabase
            .from('stores')
            .select('id, name')
            .in('id', storeIds)
          
          if (storesData) {
            storesData.forEach(s => {
              storesMap.set(s.id, { store_name: s.name })
            })
          }
        }
      }
      
      // 注文データにprofilesとstoresの情報をマージ
      const ordersWithRelations = ordersData.map(order => ({
        ...order,
        profiles: profilesMap.get(order.user_id) || null,
        stores: order.store_id ? (storesMap.get(order.store_id) || null) : null
      }))
      
      setOrders(ordersWithRelations)
    } catch {
      setToast({ isVisible: true, message: '注文の読み込みに失敗しました', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  // ===== プラン切り替え =====
  const fetchCurrentPlan = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single()

      if (error) throw error
      if (data) {
        setCurrentPlan(data.plan || 'free')
      }
    } catch (error) {
      console.error('Error fetching plan:', error)
    }
  }, [])

  const checkAdminPermissionAndLoad = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // profiles.is_adminを確認
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Profile check error:', profileError)
        setToast({ 
          isVisible: true, 
          message: `プロフィールの確認に失敗しました: ${profileError.message}`, 
          type: 'error' 
        })
        return
      }

      // 管理者メールアドレスなのにis_adminがfalseの場合、設定する
      if (isAdmin && !profile?.is_admin) {
        console.log('管理者メールアドレスですが、is_adminがfalseです。設定を更新します。')
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ is_admin: true })
          .eq('id', user.id)

        if (updateError) {
          console.error('Failed to update is_admin:', updateError)
          setToast({ 
            isVisible: true, 
            message: `管理者権限の設定に失敗しました: ${updateError.message}`, 
            type: 'error' 
          })
          return
        }
        console.log('管理者権限を設定しました')
      }

      // データを読み込む
      loadOrders()
      fetchCurrentPlan()
    } catch (error) {
      console.error('Admin permission check error:', error)
      setToast({ 
        isVisible: true, 
        message: `管理者権限の確認に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        type: 'error' 
      })
    }
  }, [isAdmin, loadOrders, fetchCurrentPlan])

  useEffect(() => {
    if (isAdmin) {
      // 管理者権限を確認してからデータを読み込む
      checkAdminPermissionAndLoad()
    }
  }, [isAdmin, checkAdminPermissionAndLoad])

  const selectOrder = async (order: SetupOrder) => {
    setSelectedOrder(order)
    setAdminNotes(order.admin_notes || '')
    
    if (order.store_id) {
      try {
        const { data, error } = await supabase
          .from('line_accounts')
          .select('channel_id, channel_secret, channel_access_token')
          .eq('store_id', order.store_id)
          .single()

        if (!error && data) {
          setLineSettings({
            channel_id: data.channel_id || '',
            channel_secret: data.channel_secret || '',
            channel_token: data.channel_access_token || ''
          })
        } else {
          setLineSettings({ channel_id: '', channel_secret: '', channel_token: '' })
        }
      } catch (error) {
        console.error('Load LINE settings error:', error)
        setLineSettings({ channel_id: '', channel_secret: '', channel_token: '' })
      }
    }
  }

  const handleSaveLineSettings = async () => {
    if (!selectedOrder) return

    if (!lineSettings.channel_id || !lineSettings.channel_secret || !lineSettings.channel_token) {
      setToast({ isVisible: true, message: 'すべてのLINE設定項目を入力してください', type: 'error' })
      return
    }

    if (!selectedOrder.store_id) {
      setToast({ isVisible: true, message: 'Store IDが見つかりません。先に基本情報を登録してください。', type: 'error' })
      return
    }

    setSaving(true)
    try {
      // 既存のレコードを確認
      const { data: existingLineAccount } = await supabase
        .from('line_accounts')
        .select('id')
        .eq('store_id', selectedOrder.store_id)
        .maybeSingle()

      let lineError
      if (existingLineAccount) {
        // 既存のレコードを更新
        const { error } = await supabase
          .from('line_accounts')
          .update({
            channel_id: lineSettings.channel_id,
            channel_secret: lineSettings.channel_secret,
            channel_access_token: lineSettings.channel_token,
            updated_at: new Date().toISOString(),
          })
          .eq('store_id', selectedOrder.store_id)
        lineError = error
      } else {
        // 新規レコードを挿入
        const { error } = await supabase
          .from('line_accounts')
          .insert({
            user_id: selectedOrder.user_id,
            store_id: selectedOrder.store_id,
            channel_id: lineSettings.channel_id,
            channel_secret: lineSettings.channel_secret,
            channel_access_token: lineSettings.channel_token,
            updated_at: new Date().toISOString(),
          })
        lineError = error
      }

      if (lineError) {
        console.error('LINE account save error:', lineError)
        throw new Error(`LINE設定の保存に失敗しました: ${lineError.message}`)
      }

      // Bot情報の取得とbot_id、line_user_idの保存
      try {
        const { data: botInfoData, error: funcError } = await supabase.functions.invoke('get-line-bot-info', {
          body: { storeId: selectedOrder.store_id }
        })
        
        if (funcError) {
          console.warn('Bot info fetch warning:', funcError)
        } else if (botInfoData) {
          // bot_idとline_user_idを更新
          const updateData: Record<string, unknown> = {}
          if (botInfoData.basicId) {
            updateData.bot_id = botInfoData.basicId
          }
          if (botInfoData.userId) {
            updateData.line_user_id = botInfoData.userId
          }
          
          if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabase
              .from('line_accounts')
              .update(updateData)
              .eq('store_id', selectedOrder.store_id)
            
            if (updateError) {
              console.warn('Failed to update bot_id/line_user_id:', updateError)
            } else {
              console.log('Updated bot_id and line_user_id successfully')
            }
          }
        }
      } catch (e) {
        console.warn('Bot info fetch warning:', e)
      }

      const { error: updateError } = await supabase
        .from('setup_service_orders')
        .update({
          status: 'completed',
          admin_notes: adminNotes,
          completed_at: new Date().toISOString()
        })
        .eq('id', selectedOrder.id)

      if (updateError) throw updateError

      // 完了メールを送信
      try {
        const { data: emailResponse, error: emailError } = await supabase.functions.invoke('send-setup-service-email', {
          body: {
            order_id: selectedOrder.id,
            email_type: 'completion'
          }
        })

        if (emailError) {
          console.error('Failed to send completion email:', emailError)
          setToast({ isVisible: true, message: '設定代行サービスを完了しました。ただし、完了メールの送信に失敗しました。', type: 'error' })
        } else {
          console.log('Completion email sent successfully:', emailResponse)
        }
      } catch (emailError) {
        console.error('Error sending completion email:', emailError)
        setToast({ isVisible: true, message: '設定代行サービスを完了しました。ただし、完了メールの送信に失敗しました。', type: 'error' })
      }

      setToast({ isVisible: true, message: '設定代行サービスを完了しました。顧客に完了メールを送信しました。', type: 'success' })
      loadOrders()
      setSelectedOrder(null)
    } catch (error: unknown) {
      console.error('Save error:', error)
      const message = error instanceof Error ? error.message : '保存に失敗しました'
      setToast({ isVisible: true, message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('setup_service_orders')
        .update({ 
          status: newStatus,
          admin_notes: adminNotes,
          ...(newStatus === 'completed' ? { completed_at: new Date().toISOString() } : {})
        })
        .eq('id', orderId)

      if (error) throw error

      // ステータスがcompletedになった場合、完了メールを送信
      if (newStatus === 'completed') {
        try {
          const { error: emailError } = await supabase.functions.invoke('send-setup-service-email', {
            body: {
              order_id: orderId,
              email_type: 'completion'
            }
          })

          if (emailError) {
            console.error('Failed to send completion email:', emailError)
            // メール送信エラーは警告のみ（ステータス更新は成功）
          } else {
            console.log('Completion email sent successfully')
          }
        } catch (emailError) {
          console.error('Error sending completion email:', emailError)
          // メール送信エラーは警告のみ（ステータス更新は成功）
        }
      }

      const statusMessages: Record<string, string> = {
        pending: 'ステータスを未決済に更新しました',
        paid: 'ステータスを決済済みに更新しました',
        in_progress: 'ステータスを作業中に更新しました',
        completed: '設定代行サービスを完了しました。顧客に完了メールを送信しました。',
        cancelled: 'ステータスをキャンセルに更新しました'
      }
      setToast({ isVisible: true, message: statusMessages[newStatus] || `ステータスを${newStatus}に更新しました`, type: 'success' })
      loadOrders()
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus })
      }
    } catch (error) {
      console.error('Update status error:', error)
      setToast({ isVisible: true, message: 'ステータス更新に失敗しました', type: 'error' })
    }
  }

  const filteredOrders = orders.filter(order => {
    // 未決済（pending）の注文は表示しない
    if (order.status === 'pending') {
      return false
    }
    
    // 検索クエリが空の場合は全てマッチ
    const matchesSearch = searchQuery === '' || 
      order.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.stores?.store_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.contact_email?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      paid: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700'
    }
    const labels: Record<string, string> = {
      pending: '未決済',
      paid: '決済済み',
      in_progress: '作業中',
      completed: '完了',
      cancelled: 'キャンセル'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || ''}`}>
        {labels[status] || status}
      </span>
    )
  }

  const updatePlan = async (newPlan: string) => {
    setPlanLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { error } = await supabase
        .from('profiles')
        .update({ plan: newPlan })
        .eq('id', user.id)

      if (error) throw error

      setCurrentPlan(newPlan)
      setToast({
        isVisible: true,
        message: `プランを ${newPlan} に変更しました`,
        type: 'success'
      })
      
      window.dispatchEvent(new Event('profile-updated'))
    } catch (error) {
      console.error('Error updating plan:', error)
      setToast({
        isVisible: true,
        message: 'プランの変更に失敗しました',
        type: 'error'
      })
    } finally {
      setPlanLoading(false)
    }
  }

  // ===== ユーザー統計データ取得 =====
  const fetchAnalytics = useCallback(async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AdminDashboard.tsx:fetchAnalytics:entry',message:'fetchAnalytics called',data:{activeTab,isAdmin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    try {
      setAnalyticsLoading(true)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AdminDashboard.tsx:fetchAnalytics:before-invoke',message:'About to invoke get-admin-analytics',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const { data, error } = await supabase.functions.invoke('get-admin-analytics')
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AdminDashboard.tsx:fetchAnalytics:after-invoke',message:'get-admin-analytics response received',data:{hasData:!!data,hasError:!!error,errorMessage:error?.message,dataKeys:data?Object.keys(data):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      if (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AdminDashboard.tsx:fetchAnalytics:error-branch',message:'Error from invoke',data:{errorMessage:error.message,errorDetails:JSON.stringify(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        throw error
      }
      if (data) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AdminDashboard.tsx:fetchAnalytics:set-data',message:'Setting analytics data',data:{hasSummary:!!data.summary,hasRegistrations:!!data.registrations,hasPlans:!!data.plans},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        setAnalyticsData(data)
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AdminDashboard.tsx:fetchAnalytics:no-data',message:'No data received',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
      }
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AdminDashboard.tsx:fetchAnalytics:catch',message:'Exception caught',data:{errorMessage:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.error('Error fetching analytics:', error)
      setToast({
        isVisible: true,
        message: '統計データの取得に失敗しました',
        type: 'error'
      })
    } finally {
      setAnalyticsLoading(false)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AdminDashboard.tsx:fetchAnalytics:finally',message:'fetchAnalytics completed',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }
  }, [activeTab, isAdmin])

  useEffect(() => {
    if (activeTab === 'user_analytics' && isAdmin && !analyticsData) {
      fetchAnalytics()
    }
  }, [activeTab, isAdmin, analyticsData, fetchAnalytics])

  // ===== タブ定義 =====
  const tabs = [
    { id: 'setup_orders' as const, label: '初期設定依頼', icon: ClipboardList },
    { id: 'plan_switcher' as const, label: 'プラン変更', icon: Crown },
    { id: 'user_analytics' as const, label: 'ユーザー情報', icon: Users },
  ]

  if (featuresLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ヘッダー */}
      <div className="shrink-0 z-20 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-200 w-full">
        <div className="px-4 sm:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">管理者ダッシュボード</h1>
              <p className="text-sm text-gray-500">開発・運用管理</p>
            </div>
          </div>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="w-full">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-end justify-between mb-6 border-b border-gray-200">
              <div className="flex gap-2 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <tab.icon size={16} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* タブコンテンツ */}
            {/* 初期設定依頼タブ */}
        {activeTab === 'setup_orders' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 注文一覧 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4 border-b">
                <h2 className="font-bold text-gray-900 mb-3">注文一覧 ({filteredOrders.length})</h2>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="検索..."
                      className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="all">すべて</option>
                    <option value="paid">決済済み</option>
                    <option value="in_progress">作業中</option>
                    <option value="completed">完了</option>
                  </select>
                </div>
              </div>
              <div className="divide-y max-h-[calc(100vh-350px)] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    注文がありません
                  </div>
                ) : (
                  filteredOrders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => selectOrder(order)}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                        selectedOrder?.id === order.id ? 'bg-primary-50 border-l-4 border-primary-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">{order.profiles?.full_name || order.profiles?.email}</p>
                          <p className="text-sm text-gray-500">{order.stores?.store_name || (order.store_id ? '店舗情報取得中...' : '店舗情報未設定')}</p>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{new Date(order.created_at).toLocaleDateString('ja-JP')}</span>
                        <span>¥{order.amount.toLocaleString()}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* 設定代行フォーム */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {selectedOrder ? (
                <div>
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <h2 className="font-bold text-gray-900">設定代行</h2>
                      <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-6 max-h-[calc(100vh-350px)] overflow-y-auto">
                    {/* 顧客情報 */}
                    <section>
                      <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <User size={18} />
                        顧客情報
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Mail size={16} className="text-gray-400" />
                          <span>{selectedOrder.profiles?.email || selectedOrder.contact_email}</span>
                        </div>
                        {selectedOrder.has_line_account && (
                          <div className="p-3 bg-blue-50 rounded-lg mt-2">
                            <p className="text-xs text-blue-700 font-medium mb-1">LINE公式アカウント所有</p>
                            {selectedOrder.line_account_basic_id && (
                              <p className="text-sm text-blue-900">Basic ID: {selectedOrder.line_account_basic_id}</p>
                            )}
                          </div>
                        )}
                        {selectedOrder.additional_notes && (
                          <div className="p-3 bg-gray-50 rounded-lg mt-2">
                            <p className="text-xs text-gray-500 font-medium mb-1">その他要望</p>
                            <p className="text-sm text-gray-700">{selectedOrder.additional_notes}</p>
                          </div>
                        )}
                      </div>
                    </section>

                    {/* LINE連携設定 */}
                    <section>
                      <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <MessageSquare size={18} className="text-[#06C755]" />
                        LINE連携設定
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Channel ID</label>
                          <input
                            type="text"
                            value={lineSettings.channel_id}
                            onChange={(e) => setLineSettings({ ...lineSettings, channel_id: e.target.value })}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                            placeholder="1234567890"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Channel Secret</label>
                          <input
                            type="password"
                            value={lineSettings.channel_secret}
                            onChange={(e) => setLineSettings({ ...lineSettings, channel_secret: e.target.value })}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                            placeholder="••••••••"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Channel Access Token</label>
                          <textarea
                            value={lineSettings.channel_token}
                            onChange={(e) => setLineSettings({ ...lineSettings, channel_token: e.target.value })}
                            className="w-full p-2 border rounded-lg h-24 focus:ring-2 focus:ring-primary-500 outline-none"
                            placeholder="Long lived access token..."
                          />
                        </div>

                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs font-medium text-gray-700 mb-1">Webhook URL</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={WEBHOOK_URL}
                              className="flex-1 p-2 border rounded-lg bg-white text-gray-600 text-xs"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(WEBHOOK_URL)
                                setToast({ isVisible: true, message: 'コピーしました', type: 'success' })
                              }}
                              className="px-3 py-1 bg-white border text-gray-600 rounded-lg hover:bg-gray-50 text-xs"
                            >
                              コピー
                            </button>
                          </div>
                        </div>

                        <a
                          href="https://developers.line.biz/console/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-primary-600 hover:underline"
                        >
                          LINE Developers Console <ExternalLink size={14} />
                        </a>
                      </div>
                    </section>

                    {/* 管理メモ */}
                    <section>
                      <label className="block text-sm font-medium text-gray-700 mb-1">管理メモ</label>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        className="w-full p-2 border rounded-lg h-24 focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="作業内容や気づいた点をメモ..."
                      />
                    </section>

                    {/* アクション */}
                    <div className="flex flex-col gap-3 pt-4 border-t">
                      <button
                        onClick={handleSaveLineSettings}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 bg-[#06C755] text-white px-6 py-3 rounded-lg hover:bg-[#05b34c] transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check size={18} />}
                        LINE設定を保存して完了にする
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        {selectedOrder.status !== 'in_progress' && (
                          <button
                            onClick={() => handleUpdateStatus(selectedOrder.id, 'in_progress')}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                          >
                            作業中にする
                          </button>
                        )}
                        {selectedOrder.status !== 'cancelled' && (
                          <button
                            onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}
                            className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 text-sm"
                          >
                            キャンセル
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-gray-500">
                  <ClipboardList className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>左の一覧から注文を選択してください</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* プラン変更タブ */}
        {activeTab === 'plan_switcher' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Crown size={20} className="text-yellow-500" />
                プラン切り替え（デバッグ用）
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                現在のプラン: <span className="font-bold uppercase text-primary-600">{currentPlan}</span>
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => updatePlan('free')}
                  disabled={planLoading || currentPlan === 'free'}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
                    currentPlan === 'free'
                      ? 'border-gray-300 bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Shield size={20} className="text-gray-600" />
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-gray-900">Free Plan</div>
                    <div className="text-xs text-gray-500">無料プラン</div>
                  </div>
                </button>

                <button
                  onClick={() => updatePlan('pro')}
                  disabled={planLoading || currentPlan === 'pro'}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
                    currentPlan === 'pro'
                      ? 'border-primary-200 bg-primary-50 text-primary-400 cursor-not-allowed'
                      : 'border-gray-200 hover:border-primary-400 hover:bg-primary-50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <Zap size={20} className="text-primary-600" />
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-gray-900">Pro Plan</div>
                    <div className="text-xs text-gray-500">AI応答・無制限</div>
                  </div>
                </button>

                <button
                  onClick={() => updatePlan('executive')}
                  disabled={planLoading || currentPlan === 'executive'}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
                    currentPlan === 'executive'
                      ? 'border-yellow-200 bg-yellow-50 text-yellow-400 cursor-not-allowed'
                      : 'border-gray-200 hover:border-yellow-400 hover:bg-yellow-50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                    <Crown size={20} className="text-yellow-600" />
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-gray-900">Executive Plan</div>
                    <div className="text-xs text-gray-500">全機能・優先サポート</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ユーザー情報タブ */}
        {activeTab === 'user_analytics' && (
          <div className="space-y-6">
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              </div>
            ) : analyticsData ? (
              <>
                {/* サマリーカード */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase">総登録者数</h3>
                      <Users size={18} className="text-primary-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{analyticsData.summary.totalUsers.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">ユーザー</p>
                  </div>

                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase">有料プラン率</h3>
                      <Crown size={18} className="text-yellow-500" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{analyticsData.summary.paidPlanRate}%</p>
                    <p className="text-xs text-gray-500 mt-1">Pro + Executive</p>
                  </div>

                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase">LINE連携完了率</h3>
                      <MessageSquare size={18} className="text-[#06C755]" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{analyticsData.summary.lineConnectionRate}%</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {analyticsData.lineConnections.connectedStoresCount} / {analyticsData.lineConnections.totalStores}店舗
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase">自動応答率</h3>
                      <Zap size={18} className="text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{analyticsData.summary.autoResponseRate}%</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {analyticsData.messages.total.toLocaleString()}件中
                    </p>
                  </div>
                </div>

                {/* グラフセクション */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 登録者推移 */}
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <TrendingUp size={16} className="text-primary-600" />
                      登録者推移（過去30日）
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analyticsData.registrations.daily}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 11, fill: '#6B7280' }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            tick={{ fontSize: 11, fill: '#6B7280' }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                              border: 'none',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                            }}
                            formatter={(value: number | undefined) => [`${value ?? 0}人`, '新規登録']}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="count" 
                            stroke="#00a3b8"
                            strokeWidth={2}
                            dot={{ fill: '#00a3b8', r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* プラン比率 */}
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <BarChart3 size={16} className="text-primary-600" />
                      プラン比率
                    </h3>
                    <div className="h-64">
                      {analyticsData.plans.distribution.some(p => p.value > 0) ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analyticsData.plans.distribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={4}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                            >
                              {analyticsData.plans.distribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                                border: 'none',
                                borderRadius: '8px'
                              }}
                              formatter={(value: number | undefined) => [`${value ?? 0}人`, '']}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-400">
                          データがありません
                        </div>
                      )}
                    </div>
                  </div>

                  {/* メッセージ数推移 */}
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <MessageSquare size={16} className="text-primary-600" />
                      メッセージ数推移（過去30日）
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analyticsData.messages.daily}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 11, fill: '#6B7280' }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            tick={{ fontSize: 11, fill: '#6B7280' }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                              border: 'none',
                              borderRadius: '8px'
                            }}
                            formatter={(value: number | undefined) => [`${value ?? 0}件`, 'メッセージ']}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="count" 
                            stroke="#2563eb"
                            strokeWidth={2}
                            dot={{ fill: '#2563eb', r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 予約数推移 */}
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Calendar size={16} className="text-primary-600" />
                      予約数推移（過去30日）
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.reservations.daily}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 11, fill: '#6B7280' }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            tick={{ fontSize: 11, fill: '#6B7280' }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                              border: 'none',
                              borderRadius: '8px'
                            }}
                            formatter={(value: number | undefined) => [`${value ?? 0}件`, '予約']}
                          />
                          <Bar dataKey="count" fill="#00a3b8" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* LINE連携一覧テーブル */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-4 border-b">
                    <h2 className="font-bold text-gray-900 mb-3">LINE連携状況一覧</h2>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type="text"
                          value={lineConnectionSearch}
                          onChange={(e) => setLineConnectionSearch(e.target.value)}
                          placeholder="ユーザー名、メール、店舗名で検索..."
                          className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                      </div>
                      <select
                        value={lineConnectionFilter}
                        onChange={(e) => setLineConnectionFilter(e.target.value as 'all' | 'connected' | 'not_connected')}
                        className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      >
                        <option value="all">すべて</option>
                        <option value="connected">連携済み</option>
                        <option value="not_connected">未連携</option>
                      </select>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">アイコン</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">ユーザー</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">店舗名</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">LINE連携</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Bot ID</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">登録日</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {analyticsData.lineConnections.details
                          .filter(detail => {
                            const matchesSearch = lineConnectionSearch === '' ||
                              detail.user_name?.toLowerCase().includes(lineConnectionSearch.toLowerCase()) ||
                              detail.user_email?.toLowerCase().includes(lineConnectionSearch.toLowerCase()) ||
                              detail.store_name?.toLowerCase().includes(lineConnectionSearch.toLowerCase())
                            
                            const matchesFilter = lineConnectionFilter === 'all' ||
                              (lineConnectionFilter === 'connected' && detail.has_line_connection) ||
                              (lineConnectionFilter === 'not_connected' && !detail.has_line_connection)
                            
                            return matchesSearch && matchesFilter
                          })
                          .map((detail) => (
                            <tr 
                              key={detail.store_id} 
                              className="hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => {
                                setSelectedStoreDetail(detail)
                                setStoreDetailModalOpen(true)
                              }}
                            >
                              <td className="px-4 py-3">
                                {detail.bot_picture_url ? (
                                  <img 
                                    src={detail.bot_picture_url} 
                                    alt="LINE Bot" 
                                    className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement
                                      target.style.display = 'none'
                                      if (target.nextElementSibling) {
                                        (target.nextElementSibling as HTMLElement).style.display = 'flex'
                                      }
                                    }}
                                  />
                                ) : null}
                                {!detail.bot_picture_url && (
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#06C755] to-[#00B900] flex items-center justify-center border-2 border-gray-200">
                                    <MessageSquare size={20} className="text-white" />
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <div>
                                  <p className="font-medium text-gray-900">{detail.user_name || '未設定'}</p>
                                  <p className="text-xs text-gray-500">{detail.user_email || '-'}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{detail.store_name || '-'}</td>
                              <td className="px-4 py-3 text-sm">
                                {detail.has_line_connection ? (
                                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                    連携済み
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                                    未連携
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 font-mono text-xs">
                                {detail.bot_id || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {detail.user_created_at 
                                  ? new Date(detail.user_created_at).toLocaleDateString('ja-JP')
                                  : '-'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {analyticsData.lineConnections.details.filter(detail => {
                      const matchesSearch = lineConnectionSearch === '' ||
                        detail.user_name?.toLowerCase().includes(lineConnectionSearch.toLowerCase()) ||
                        detail.user_email?.toLowerCase().includes(lineConnectionSearch.toLowerCase()) ||
                        detail.store_name?.toLowerCase().includes(lineConnectionSearch.toLowerCase())
                      
                      const matchesFilter = lineConnectionFilter === 'all' ||
                        (lineConnectionFilter === 'connected' && detail.has_line_connection) ||
                        (lineConnectionFilter === 'not_connected' && !detail.has_line_connection)
                      
                      return matchesSearch && matchesFilter
                    }).length === 0 && (
                      <div className="p-8 text-center text-gray-500">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        該当するデータがありません
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                データを読み込めませんでした
              </div>
            )}
          </div>
        )}
          </div>
        </div>
      </div>

      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />

      {/* 店舗詳細モーダル */}
      <Modal
        isOpen={storeDetailModalOpen}
        onClose={() => {
          setStoreDetailModalOpen(false)
          setSelectedStoreDetail(null)
        }}
        title="店舗詳細情報"
        showDefaultButtons={false}
        footerContent={
          <button
            onClick={() => {
              setStoreDetailModalOpen(false)
              setSelectedStoreDetail(null)
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            閉じる
          </button>
        }
      >
        {selectedStoreDetail && (
          <div className="space-y-6">
            {/* ユーザー情報セクション */}
            <section>
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <User size={18} />
                ユーザー情報
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">名前</span>
                  <span className="text-sm font-medium text-gray-900">{selectedStoreDetail.user_name || '未設定'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">メールアドレス</span>
                  <span className="text-sm font-medium text-gray-900">{selectedStoreDetail.user_email || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">登録日</span>
                  <span className="text-sm font-medium text-gray-900">
                    {selectedStoreDetail.user_created_at 
                      ? new Date(selectedStoreDetail.user_created_at).toLocaleDateString('ja-JP', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })
                      : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">プラン</span>
                  <span className={`text-sm font-medium px-2 py-1 rounded ${
                    selectedStoreDetail.plan === 'executive' ? 'bg-yellow-100 text-yellow-800' :
                    selectedStoreDetail.plan === 'pro' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedStoreDetail.plan === 'executive' ? 'Executive' :
                     selectedStoreDetail.plan === 'pro' ? 'Pro' :
                     'Free'}
                  </span>
                </div>
              </div>
            </section>

            {/* 店舗情報セクション */}
            <section>
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <ClipboardList size={18} />
                店舗情報
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">店舗名</span>
                  <span className="text-sm font-medium text-gray-900">{selectedStoreDetail.store_name || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">作成日</span>
                  <span className="text-sm font-medium text-gray-900">
                    {selectedStoreDetail.store_created_at 
                      ? new Date(selectedStoreDetail.store_created_at).toLocaleDateString('ja-JP', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })
                      : '-'}
                  </span>
                </div>
              </div>
            </section>

            {/* LINE連携セクション */}
            <section>
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <MessageSquare size={18} className="text-[#06C755]" />
                LINE連携情報
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {selectedStoreDetail.bot_picture_url ? (
                    <img 
                      src={selectedStoreDetail.bot_picture_url} 
                      alt="LINE Bot" 
                      className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        if (target.nextElementSibling) {
                          (target.nextElementSibling as HTMLElement).style.display = 'flex'
                        }
                      }}
                    />
                  ) : null}
                  {!selectedStoreDetail.bot_picture_url && (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#06C755] to-[#00B900] flex items-center justify-center border-2 border-gray-200">
                      <MessageSquare size={32} className="text-white" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedStoreDetail.has_line_connection 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {selectedStoreDetail.has_line_connection ? '連携済み' : '未連携'}
                      </span>
                    </div>
                  </div>
                </div>
                {selectedStoreDetail.has_line_connection && (
                  <>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Bot ID</span>
                      <span className="text-sm font-mono font-medium text-gray-900">{selectedStoreDetail.bot_id || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Channel ID</span>
                      <span className="text-sm font-mono font-medium text-gray-900">{selectedStoreDetail.channel_id || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">連携日</span>
                      <span className="text-sm font-medium text-gray-900">
                        {selectedStoreDetail.line_connected_at 
                          ? new Date(selectedStoreDetail.line_connected_at).toLocaleDateString('ja-JP', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })
                          : '-'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* メッセージ統計セクション */}
            <section>
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <MessageSquare size={18} />
                メッセージ統計
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">総メッセージ数</span>
                  <span className="text-sm font-bold text-gray-900">{selectedStoreDetail.store_message_count.toLocaleString()}件</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">自動応答</span>
                  <span className="text-sm font-medium text-gray-900">{selectedStoreDetail.store_auto_reply_count.toLocaleString()}件</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">AI応答</span>
                  <span className="text-sm font-medium text-gray-900">{selectedStoreDetail.store_ai_reply_count.toLocaleString()}件</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-sm text-gray-600">自動応答率</span>
                  <span className="text-sm font-bold text-primary-600">
                    {selectedStoreDetail.store_message_count > 0
                      ? (((selectedStoreDetail.store_auto_reply_count + selectedStoreDetail.store_ai_reply_count) / selectedStoreDetail.store_message_count) * 100).toFixed(1)
                      : '0.0'}%
                  </span>
                </div>
              </div>
            </section>

            {/* 予約統計セクション */}
            <section>
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Calendar size={18} />
                予約統計
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">総予約数</span>
                  <span className="text-sm font-bold text-gray-900">{selectedStoreDetail.store_reservation_count.toLocaleString()}件</span>
                </div>
              </div>
            </section>
          </div>
        )}
      </Modal>
    </div>
  )
}
