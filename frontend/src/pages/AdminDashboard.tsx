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
  ClipboardList
} from 'lucide-react'
import Toast from '../components/Toast'
import { useUserFeatures } from '../hooks/useUserFeatures'

// タブの定義
type AdminTab = 'setup_orders' | 'plan_switcher'

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

      console.log('Loading orders for user:', user.id, 'email:', user.email)

      // 管理者権限を確認
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Profile check error:', profileError)
      } else {
        console.log('Profile is_admin:', profile?.is_admin)
      }

      // 注文を取得（リレーションを使わずに）
      const { data: ordersData, error } = await supabase
        .from('setup_service_orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Load orders error:', error)
        // エラーの詳細をログに出力
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        
        // エラーメッセージを詳細に表示
        let errorMessage = `注文の読み込みに失敗しました: ${error.message}`
        if (error.code === 'PGRST301' || error.message.includes('permission') || error.message.includes('policy') || error.message.includes('RLS')) {
          errorMessage = `RLSポリシーエラー: 管理者権限が正しく設定されていない可能性があります。エラーコード: ${error.code}`
        }
        
        setToast({ isVisible: true, message: errorMessage, type: 'error' })
        return
      }
      
      if (!ordersData || ordersData.length === 0) {
        console.log('注文は0件です（正常）')
        setOrders([])
        return
      }
      
      // ユーザーIDとストアIDのリストを取得
      const userIds = [...new Set(ordersData.map(o => o.user_id).filter(Boolean))]
      const storeIds = [...new Set(ordersData.map(o => o.store_id).filter(Boolean))]
      
      // profilesとstoresを別々に取得
      const profilesMap = new Map()
      const storesMap = new Map()
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds)
        
        if (profilesData) {
          profilesData.forEach(p => {
            profilesMap.set(p.id, { email: p.email, full_name: p.full_name })
          })
        }
      }
      
      if (storeIds.length > 0) {
        const { data: storesData } = await supabase
          .from('stores')
          .select('id, store_name')
          .in('id', storeIds)
        
        if (storesData) {
          storesData.forEach(s => {
            storesMap.set(s.id, { store_name: s.store_name })
          })
        }
      }
      
      // 注文データにprofilesとstoresの情報をマージ
      const ordersWithRelations = ordersData.map(order => ({
        ...order,
        profiles: profilesMap.get(order.user_id) || null,
        stores: order.store_id ? (storesMap.get(order.store_id) || null) : null
      }))
      
      console.log('Orders loaded successfully:', ordersWithRelations.length, '件')
      setOrders(ordersWithRelations)
    } catch (error) {
      console.error('Load orders catch error:', error)
      
      // エラーの詳細を確認
      let errorMessage = '注文の読み込みに失敗しました'
      if (error instanceof Error) {
        errorMessage = `注文の読み込みに失敗しました: ${error.message}`
        
        // RLSポリシーエラーの場合、より詳細なメッセージを表示
        if (error.message.includes('permission') || error.message.includes('policy') || error.message.includes('RLS')) {
          errorMessage = '管理者権限が正しく設定されていない可能性があります。ページをリロードしてください。'
        }
      }
      
      setToast({ isVisible: true, message: errorMessage, type: 'error' })
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
      const { error: lineError } = await supabase
        .from('line_accounts')
        .upsert({
          user_id: selectedOrder.user_id,
          store_id: selectedOrder.store_id,
          channel_id: lineSettings.channel_id,
          channel_secret: lineSettings.channel_secret,
          channel_access_token: lineSettings.channel_token,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (lineError) throw lineError

      try {
        await supabase.functions.invoke('get-line-bot-info', {
          body: { storeId: selectedOrder.store_id }
        })
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

      setToast({ isVisible: true, message: 'LINE設定を保存し、注文を完了にしました', type: 'success' })
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

      setToast({ isVisible: true, message: `ステータスを${newStatus}に更新しました`, type: 'success' })
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
    const matchesSearch = 
      order.profiles?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.stores?.store_name?.toLowerCase().includes(searchQuery.toLowerCase())
    
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

  // ===== タブ定義 =====
  const tabs = [
    { id: 'setup_orders' as const, label: '初期設定依頼', icon: ClipboardList },
    { id: 'plan_switcher' as const, label: 'プラン変更', icon: Crown },
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
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4">
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
        <div className="max-w-7xl mx-auto">
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
                          <p className="text-sm text-gray-500">{order.stores?.store_name || '店舗未登録'}</p>
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
          </div>
        </div>
      </div>

      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  )
}
