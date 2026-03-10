import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  Settings, 
  Search, 
  Loader2, 
  Check, 
  X, 
  ExternalLink,
  MessageSquare,
  User,
  Mail,
  Phone,
  Calendar,
  AlertTriangle
} from 'lucide-react'
import Toast from '../components/Toast'

interface SetupOrder {
  id: string
  user_id: string
  store_id: string | null
  status: string
  amount: number
  contact_phone: string | null
  contact_email: string | null
  preferred_contact_time: string | null
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
    name: string
  }
}

interface LineSettings {
  channel_id: string
  channel_secret: string
  channel_token: string
}

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-webhook`

export default function AdminSetupService() {
  const navigate = useNavigate()
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
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success',
  })

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/')
        return
      }

      // 管理者権限チェック
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (error || !profile?.is_admin) {
        setToast({ isVisible: true, message: '管理者権限がありません', type: 'error' })
        setTimeout(() => navigate('/'), 2000)
        return
      }

      loadOrders()
    } catch (error) {
      console.error('Admin check error:', error)
      navigate('/')
    }
  }

  useEffect(() => {
    checkAdminAccess()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('setup_service_orders')
        .select(`
          *,
          profiles:user_id (email, full_name),
          stores:store_id (name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Load orders error:', error)
      setToast({ isVisible: true, message: '注文の読み込みに失敗しました', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const selectOrder = async (order: SetupOrder) => {
    setSelectedOrder(order)
    setAdminNotes(order.admin_notes || '')
    
    // 既存のLINE設定を読み込む
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

      if (lineError) throw lineError

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

      // ステータスを完了に更新
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
        const { error: emailError } = await supabase.functions.invoke('send-setup-service-email', {
          body: {
            order_id: selectedOrder.id,
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
    const matchesSearch = 
      order.profiles?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.stores?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-gray-100 text-gray-700',
      paid: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700'
    }
    const labels = {
      pending: '未決済',
      paid: '決済済み',
      in_progress: '作業中',
      completed: '完了',
      cancelled: 'キャンセル'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary-100 p-2 rounded-xl">
                <Settings className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">設定代行サービス管理</h1>
                <p className="text-sm text-gray-500">顧客のLINE連携設定を代行</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ダッシュボードへ
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* フィルター */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="顧客名、メール、店舗名で検索..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="all">すべて</option>
              <option value="paid">決済済み</option>
              <option value="in_progress">作業中</option>
              <option value="completed">完了</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 注文一覧 */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b">
              <h2 className="font-bold text-gray-900">注文一覧 ({filteredOrders.length})</h2>
            </div>
            <div className="divide-y max-h-[calc(100vh-250px)] overflow-y-auto">
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
                        <p className="text-sm text-gray-500">{order.stores?.name || '店舗未登録'}</p>
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
          <div className="bg-white rounded-lg shadow-sm">
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

                <div className="p-6 space-y-6 max-h-[calc(100vh-250px)] overflow-y-auto">
                  {/* 顧客情報 */}
                  <section>
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <User size={18} />
                      顧客情報
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail size={16} className="text-gray-400" />
                        <span>{selectedOrder.profiles?.email}</span>
                      </div>
                      {selectedOrder.contact_phone && (
                        <div className="flex items-center gap-2">
                          <Phone size={16} className="text-gray-400" />
                          <span>{selectedOrder.contact_phone}</span>
                        </div>
                      )}
                      {selectedOrder.preferred_contact_time && (
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className="text-gray-400" />
                          <span>{selectedOrder.preferred_contact_time}</span>
                        </div>
                      )}
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
                <Settings className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>左の一覧から注文を選択してください</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast.isVisible && (
        <Toast
          isVisible={toast.isVisible}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, isVisible: false })}
        />
      )}
    </div>
  )
}
