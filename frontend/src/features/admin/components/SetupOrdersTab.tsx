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
  ClipboardList,
} from 'lucide-react'
import type { SetupOrder, LineSettings } from '../types'

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-webhook`

export interface SetupOrdersTabProps {
  orders: SetupOrder[]
  loading: boolean
  selectedOrder: SetupOrder | null
  lineSettings: LineSettings
  adminNotes: string
  saving: boolean
  searchQuery: string
  statusFilter: string
  onSelectOrder: (order: SetupOrder) => void
  onCloseOrder: () => void
  onLineSettingsChange: (settings: LineSettings) => void
  onAdminNotesChange: (notes: string) => void
  onSaveLineSettings: () => void
  onUpdateStatus: (orderId: string, newStatus: string) => void
  onSearchQueryChange: (query: string) => void
  onStatusFilterChange: (filter: string) => void
  onCopyWebhook: () => void
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    paid: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    pending: '未決済',
    paid: '決済済み',
    in_progress: '作業中',
    completed: '完了',
    cancelled: 'キャンセル',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || ''}`}>
      {labels[status] || status}
    </span>
  )
}

export function SetupOrdersTab({
  orders,
  loading,
  selectedOrder,
  lineSettings,
  adminNotes,
  saving,
  searchQuery,
  statusFilter,
  onSelectOrder,
  onCloseOrder,
  onLineSettingsChange,
  onAdminNotesChange,
  onSaveLineSettings,
  onUpdateStatus,
  onSearchQueryChange,
  onStatusFilterChange,
  onCopyWebhook,
}: SetupOrdersTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b">
          <h2 className="font-bold text-gray-900 mb-3">注文一覧 ({orders.length})</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="検索..."
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
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
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              注文がありません
            </div>
          ) : (
            orders.map((order) => (
              <button
                key={order.id}
                onClick={() => onSelectOrder(order)}
                className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                  selectedOrder?.id === order.id ? 'bg-primary-50 border-l-4 border-primary-500' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{order.profiles?.full_name || order.profiles?.email}</p>
                    <p className="text-sm text-gray-500">
                      {order.stores?.store_name || (order.store_id ? '店舗情報取得中...' : '店舗情報未設定')}
                    </p>
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {selectedOrder ? (
          <div>
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900">設定代行</h2>
                <button onClick={onCloseOrder} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[calc(100vh-350px)] overflow-y-auto">
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
                      onChange={(e) => onLineSettingsChange({ ...lineSettings, channel_id: e.target.value })}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="1234567890"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Channel Secret</label>
                    <input
                      type="password"
                      value={lineSettings.channel_secret}
                      onChange={(e) => onLineSettingsChange({ ...lineSettings, channel_secret: e.target.value })}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Channel Access Token</label>
                    <textarea
                      value={lineSettings.channel_token}
                      onChange={(e) => onLineSettingsChange({ ...lineSettings, channel_token: e.target.value })}
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
                        onClick={onCopyWebhook}
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

              <section>
                <label className="block text-sm font-medium text-gray-700 mb-1">管理メモ</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => onAdminNotesChange(e.target.value)}
                  className="w-full p-2 border rounded-lg h-24 focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="作業内容や気づいた点をメモ..."
                />
              </section>

              <div className="flex flex-col gap-3 pt-4 border-t">
                <button
                  onClick={onSaveLineSettings}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-[#06C755] text-white px-6 py-3 rounded-lg hover:bg-[#05b34c] transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check size={18} />}
                  LINE設定を保存して完了にする
                </button>

                <div className="grid grid-cols-2 gap-2">
                  {selectedOrder.status !== 'in_progress' && (
                    <button
                      onClick={() => onUpdateStatus(selectedOrder.id, 'in_progress')}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      作業中にする
                    </button>
                  )}
                  {selectedOrder.status !== 'cancelled' && (
                    <button
                      onClick={() => onUpdateStatus(selectedOrder.id, 'cancelled')}
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
  )
}
