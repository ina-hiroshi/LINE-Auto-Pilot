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
import { Loader2, Crown, ClipboardList, Users } from 'lucide-react'
import Toast from '../components/Toast'
import { useUserFeatures } from '../hooks/useUserFeatures'
import { SetupOrdersTab } from '../features/admin/components/SetupOrdersTab'
import { PlanSwitcherTab } from '../features/admin/components/PlanSwitcherTab'
import { UserAnalyticsTab } from '../features/admin/components/UserAnalyticsTab'
import type { SetupOrder, LineSettings, StoreDetail, AnalyticsData } from '../features/admin/types'

type AdminTab = 'setup_orders' | 'plan_switcher' | 'user_analytics'

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
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (isAdmin && !profile?.is_admin) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ is_admin: true })
          .eq('id', user.id)

        if (updateError) {
          console.warn('Failed to update is_admin (non-blocking):', updateError)
        }
      }

      loadOrders()
      fetchCurrentPlan()
    } catch (error) {
      console.error('Admin permission check error:', error)
      loadOrders()
      fetchCurrentPlan()
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
    try {
      setAnalyticsLoading(true)
      const { data, error } = await supabase.functions.invoke('get-admin-analytics')

      if (error) {
        throw error
      }
      if (data) {
        setAnalyticsData(data)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
      setToast({
        isVisible: true,
        message: '統計データの取得に失敗しました',
        type: 'error'
      })
    } finally {
      setAnalyticsLoading(false)
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
        {activeTab === 'setup_orders' && (
          <SetupOrdersTab
            orders={filteredOrders}
            loading={loading}
            selectedOrder={selectedOrder}
            lineSettings={lineSettings}
            adminNotes={adminNotes}
            saving={saving}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            onSelectOrder={selectOrder}
            onCloseOrder={() => setSelectedOrder(null)}
            onLineSettingsChange={setLineSettings}
            onAdminNotesChange={setAdminNotes}
            onSaveLineSettings={handleSaveLineSettings}
            onUpdateStatus={handleUpdateStatus}
            onSearchQueryChange={setSearchQuery}
            onStatusFilterChange={setStatusFilter}
            onCopyWebhook={() => {
              navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-webhook`)
              setToast({ isVisible: true, message: 'コピーしました', type: 'success' })
            }}
          />
        )}

        {activeTab === 'plan_switcher' && (
          <PlanSwitcherTab
            currentPlan={currentPlan}
            planLoading={planLoading}
            onPlanChange={updatePlan}
          />
        )}

        {activeTab === 'user_analytics' && (
          <UserAnalyticsTab
            loading={analyticsLoading}
            data={analyticsData}
            lineConnectionSearch={lineConnectionSearch}
            lineConnectionFilter={lineConnectionFilter}
            selectedStoreDetail={selectedStoreDetail}
            storeDetailModalOpen={storeDetailModalOpen}
            onLineConnectionSearchChange={setLineConnectionSearch}
            onLineConnectionFilterChange={setLineConnectionFilter}
            onStoreRowClick={(detail) => {
              setSelectedStoreDetail(detail)
              setStoreDetailModalOpen(true)
            }}
            onCloseStoreDetailModal={() => {
              setStoreDetailModalOpen(false)
              setSelectedStoreDetail(null)
            }}
          />
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
