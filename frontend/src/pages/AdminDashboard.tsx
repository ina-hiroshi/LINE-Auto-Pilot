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
import { Loader2, Crown, ClipboardList, Users, Gift } from 'lucide-react'
import Toast from '../components/Toast'
import { UnderlineTabs } from '../components/UnderlineTabs'
import { useUserFeatures } from '../hooks/useUserFeatures'
import { SetupOrdersTab } from '../features/admin/components/SetupOrdersTab'
import { PlanSwitcherTab } from '../features/admin/components/PlanSwitcherTab'
import { UserAnalyticsTab, type AdminUserPlan } from '../features/admin/components/UserAnalyticsTab'
import { MonitorApplicationsTab } from '../features/admin/components/MonitorApplicationsTab'
import type { SetupOrder, LineSettings, StoreDetail, AnalyticsData } from '../features/admin/types'

type AdminTab = 'setup_orders' | 'monitor_applications' | 'plan_switcher' | 'user_analytics'

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

  // 以前はここで自分の profiles.is_admin を true に書き戻していたが、
  // 誰でも自分の行を更新できるため管理者になり放題だった。
  // 管理者かどうかの判定は useUserFeatures とサーバー側の検証に任せ、
  // フラグの付与は Supabase 側で直接行う運用とする。
  useEffect(() => {
    if (isAdmin) {
      loadOrders()
      fetchCurrentPlan()
    }
  }, [isAdmin, loadOrders, fetchCurrentPlan])

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

  /**
   * 完了メールを送信する。成功なら null、失敗なら理由の文字列を返す。
   * 呼び出し側が「送れたことにする」のを防ぐため、成否を必ず返す形にしている。
   */
  const sendCompletionEmail = async (orderId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('send-setup-service-email', {
        body: { order_id: orderId, email_type: 'completion' },
      })

      if (error) {
        console.error('Failed to send completion email:', error)
        return error.message || '送信に失敗しました'
      }
      if (data && data.success === false) {
        return data.error || '送信に失敗しました'
      }
      console.log('Completion email sent:', data)
      return null
    } catch (e) {
      console.error('Error sending completion email:', e)
      return e instanceof Error ? e.message : '送信に失敗しました'
    }
  }

  const handleResendCompletionEmail = async (orderId: string) => {
    setSaving(true)
    const failure = await sendCompletionEmail(orderId)
    setSaving(false)
    setToast(
      failure
        ? { isVisible: true, message: `再送に失敗しました: ${failure}`, type: 'error' }
        : { isVisible: true, message: '完了メールを再送しました', type: 'success' },
    )
    loadOrders()
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

      // 完了メールを送信。
      // 以前はここで失敗トーストを出しても、直後に成功トーストで無条件に
      // 上書きしていたため、送信に失敗しても「送信しました」と表示されていた。
      const emailFailure = await sendCompletionEmail(selectedOrder.id)

      if (emailFailure) {
        setToast({
          isVisible: true,
          message: `設定代行を完了しました。ただし完了メールを送信できませんでした: ${emailFailure}`,
          type: 'error',
        })
      } else {
        setToast({ isVisible: true, message: '設定代行サービスを完了しました。顧客に完了メールを送信しました。', type: 'success' })
      }
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

      // ステータスがcompletedになった場合、完了メールを送信。
      // 失敗を console だけに落とすと、顧客に届いていないことに気づけない。
      if (newStatus === 'completed') {
        const emailFailure = await sendCompletionEmail(orderId)
        if (emailFailure) {
          setToast({
            isVisible: true,
            message: `ステータスは完了にしました。ただし完了メールを送信できませんでした: ${emailFailure}`,
            type: 'error',
          })
          loadOrders()
          return
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

      // plan はサービスロールだけが書ける列。管理者権限を検証する
      // Edge Function 経由で変更する。
      const { error } = await supabase.functions.invoke('admin-update-user-plan', {
        body: { userId: user.id, plan: newPlan },
      })

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

  const handleUpdateUserPlan = useCallback(
    async (userId: string, plan: AdminUserPlan) => {
      const { data, error } = await supabase.functions.invoke('admin-update-user-plan', {
        body: { userId, plan },
      })

      if (error) {
        console.error('admin-update-user-plan:', error)
        setToast({ isVisible: true, message: 'プランの更新に失敗しました', type: 'error' })
        throw error
      }

      const payload = data as { ok?: boolean; error?: string; warning?: string } | null
      if (payload?.error) {
        setToast({ isVisible: true, message: payload.error, type: 'error' })
        throw new Error(payload.error)
      }

      if (payload?.warning) {
        setToast({
          isVisible: true,
          message: `プランを更新しました。${payload.warning}`,
          type: 'success',
        })
      } else {
        setToast({ isVisible: true, message: 'プランを更新しました', type: 'success' })
      }

      await fetchAnalytics()
      setSelectedStoreDetail((prev) => (prev && prev.owner_id === userId ? { ...prev, plan } : prev))
      window.dispatchEvent(new Event('profile-updated'))
    },
    [fetchAnalytics],
  )

  useEffect(() => {
    if (activeTab === 'user_analytics' && isAdmin && !analyticsData) {
      fetchAnalytics()
    }
  }, [activeTab, isAdmin, analyticsData, fetchAnalytics])

  // 注文一覧はマウント時にしか読み込まれないため、タブに戻るたびに取り直す。
  // これがないと、モニター申込から作成した注文が反映されない。
  useEffect(() => {
    if (activeTab === 'setup_orders' && isAdmin) {
      loadOrders()
    }
  }, [activeTab, isAdmin, loadOrders])

  // ===== タブ定義 =====
  const tabs = [
    { id: 'setup_orders' as const, label: '初期設定依頼', icon: ClipboardList },
    { id: 'monitor_applications' as const, label: 'モニター申込', icon: Gift },
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
            {/* 登録フローは通常セットアップ未完了のときしか開けない。
                検証・改善のために管理者はここから入れるようにする。 */}
            <button
              onClick={() => navigate('/onboarding')}
              className="shrink-0 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              登録フローを開く
            </button>
          </div>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="w-full">
          <UnderlineTabs
            activeId={activeTab}
            onChange={setActiveTab}
            items={tabs.map((tab) => ({
              id: tab.id,
              label: tab.label,
              icon: tab.icon,
              hideLabelOnMobile: true,
            }))}
          />

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
            onResendCompletionEmail={handleResendCompletionEmail}
            onUpdateStatus={handleUpdateStatus}
            onSearchQueryChange={setSearchQuery}
            onStatusFilterChange={setStatusFilter}
            onCopyWebhook={() => {
              navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-webhook`)
              setToast({ isVisible: true, message: 'コピーしました', type: 'success' })
            }}
          />
        )}

        {activeTab === 'monitor_applications' && (
          <MonitorApplicationsTab
            onOrderCreated={() => {
              loadOrders()
              setActiveTab('setup_orders')
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
            onUpdateUserPlan={handleUpdateUserPlan}
          />
        )}
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
