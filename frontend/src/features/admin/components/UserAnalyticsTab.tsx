import { useState, useEffect } from 'react'
import {
  Search,
  Loader2,
  AlertTriangle,
  Users,
  Crown,
  MessageSquare,
  Zap,
  User,
  ClipboardList,
  TrendingUp,
  BarChart3,
  Calendar,
} from 'lucide-react'
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
  Bar,
} from 'recharts'
import Modal from '../../../components/Modal'
import type { AnalyticsData, StoreDetail } from '../types'

export type AdminUserPlan = 'free' | 'pro' | 'executive'

export interface UserAnalyticsTabProps {
  loading: boolean
  data: AnalyticsData | null
  lineConnectionSearch: string
  lineConnectionFilter: 'all' | 'connected' | 'not_connected'
  selectedStoreDetail: StoreDetail | null
  storeDetailModalOpen: boolean
  onLineConnectionSearchChange: (query: string) => void
  onLineConnectionFilterChange: (filter: 'all' | 'connected' | 'not_connected') => void
  onStoreRowClick: (detail: StoreDetail) => void
  onCloseStoreDetailModal: () => void
  /** 管理者のみ: 対象ユーザーのプランを更新（Edge Function 経由） */
  onUpdateUserPlan?: (userId: string, plan: AdminUserPlan) => Promise<{ warning?: string } | void>
}

export function UserAnalyticsTab(props: UserAnalyticsTabProps) {
  const {
    loading,
    data,
    lineConnectionSearch,
    lineConnectionFilter,
    selectedStoreDetail,
    storeDetailModalOpen,
    onLineConnectionSearchChange,
    onLineConnectionFilterChange,
    onStoreRowClick,
    onCloseStoreDetailModal,
    onUpdateUserPlan,
  } = props

  const [planDraft, setPlanDraft] = useState<AdminUserPlan>('free')
  const [planSaving, setPlanSaving] = useState(false)

  useEffect(() => {
    if (selectedStoreDetail) {
      const p = selectedStoreDetail.plan
      setPlanDraft(p === 'pro' || p === 'executive' ? p : 'free')
    }
  }, [selectedStoreDetail])

  const filteredDetails =
    data?.lineConnections.details.filter((detail) => {
      const matchesSearch =
        lineConnectionSearch === '' ||
        (detail.user_name?.toLowerCase().includes(lineConnectionSearch.toLowerCase()) ?? false) ||
        (detail.user_email?.toLowerCase().includes(lineConnectionSearch.toLowerCase()) ?? false) ||
        (detail.store_name?.toLowerCase().includes(lineConnectionSearch.toLowerCase()) ?? false)
      const matchesFilter =
        lineConnectionFilter === 'all' ||
        (lineConnectionFilter === 'connected' && detail.has_line_connection) ||
        (lineConnectionFilter === 'not_connected' && !detail.has_line_connection)
      return matchesSearch && matchesFilter
    }) ?? []

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12 text-gray-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          データを読み込めませんでした
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase">総登録者数</h3>
            <Users size={18} className="text-primary-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.summary.totalUsers.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">ユーザー</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase">有料プラン率</h3>
            <Crown size={18} className="text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.summary.paidPlanRate}%</p>
          <p className="text-xs text-gray-500 mt-1">Pro + Executive</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase">LINE連携完了率</h3>
            <MessageSquare size={18} className="text-[#06C755]" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.summary.lineConnectionRate}%</p>
          <p className="text-xs text-gray-500 mt-1">
            {data.lineConnections.connectedStoresCount} / {data.lineConnections.totalStores}店舗
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase">自動応答率</h3>
            <Zap size={18} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.summary.autoResponseRate}%</p>
          <p className="text-xs text-gray-500 mt-1">{data.messages.total.toLocaleString()}件中</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-primary-600" />
            登録者推移（過去30日）
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.registrations.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  }}
                  formatter={(value: number | undefined) => [`${value ?? 0}人`, '新規登録']}
                />
                <Line type="monotone" dataKey="count" stroke="#00a3b8" strokeWidth={2} dot={{ fill: '#00a3b8', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-primary-600" />
            プラン比率
          </h3>
          <div className="h-64">
            {data.plans.distribution.some((p) => p.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.plans.distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {data.plans.distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.98)', border: 'none', borderRadius: '8px' }}
                    formatter={(value: number | undefined) => [`${value ?? 0}人`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">データがありません</div>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <MessageSquare size={16} className="text-primary-600" />
            メッセージ数推移（過去30日）
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.messages.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.98)', border: 'none', borderRadius: '8px' }}
                  formatter={(value: number | undefined) => [`${value ?? 0}件`, 'メッセージ']}
                />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ fill: '#2563eb', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-primary-600" />
            予約数推移（過去30日）
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.reservations.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.98)', border: 'none', borderRadius: '8px' }}
                  formatter={(value: number | undefined) => [`${value ?? 0}件`, '予約']}
                />
                <Bar dataKey="count" fill="#00a3b8" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b">
          <h2 className="font-bold text-gray-900 mb-3">LINE連携状況一覧</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={lineConnectionSearch}
                onChange={(e) => onLineConnectionSearchChange(e.target.value)}
                placeholder="ユーザー名、メール、店舗名で検索..."
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <select
              value={lineConnectionFilter}
              onChange={(e) => onLineConnectionFilterChange(e.target.value as 'all' | 'connected' | 'not_connected')}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">プラン</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">LINE連携</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Bot ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">登録日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDetails.map((detail) => (
                <tr
                  key={detail.store_id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onStoreRowClick(detail)}
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
                    <span
                      className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                        detail.plan === 'executive'
                          ? 'bg-yellow-100 text-yellow-800'
                          : detail.plan === 'pro'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {detail.plan === 'executive' ? 'Executive' : detail.plan === 'pro' ? 'Pro' : 'Free'}
                    </span>
                  </td>
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
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono text-xs">{detail.bot_id || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {detail.user_created_at ? new Date(detail.user_created_at).toLocaleDateString('ja-JP') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredDetails.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              該当するデータがありません
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={storeDetailModalOpen}
        onClose={onCloseStoreDetailModal}
        title="店舗詳細情報"
        showDefaultButtons={false}
        footerContent={
          <button
            onClick={onCloseStoreDetailModal}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            閉じる
          </button>
        }
      >
        {selectedStoreDetail && (
          <div className="space-y-6">
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
                          day: 'numeric',
                        })
                      : '-'}
                  </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-gray-600">プラン</span>
                  {onUpdateUserPlan ? (
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <select
                        value={planDraft}
                        onChange={(e) => setPlanDraft(e.target.value as AdminUserPlan)}
                        disabled={planSaving}
                        className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-primary-500 outline-none disabled:opacity-50"
                      >
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="executive">Executive</option>
                      </select>
                      <button
                        type="button"
                        disabled={(() => {
                          const normalized =
                            selectedStoreDetail.plan === 'pro' || selectedStoreDetail.plan === 'executive'
                              ? selectedStoreDetail.plan
                              : 'free'
                          return planSaving || planDraft === normalized
                        })()}
                        onClick={async () => {
                          if (!selectedStoreDetail.owner_id) return
                          setPlanSaving(true)
                          try {
                            await onUpdateUserPlan(selectedStoreDetail.owner_id, planDraft)
                          } catch {
                            /* トーストは親で表示済み */
                          } finally {
                            setPlanSaving(false)
                          }
                        }}
                        className="text-sm font-medium px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {planSaving ? (
                          <span className="inline-flex items-center gap-1">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            保存中
                          </span>
                        ) : (
                          'プランを保存'
                        )}
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`text-sm font-medium px-2 py-1 rounded ${
                        selectedStoreDetail.plan === 'executive'
                          ? 'bg-yellow-100 text-yellow-800'
                          : selectedStoreDetail.plan === 'pro'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {selectedStoreDetail.plan === 'executive'
                        ? 'Executive'
                        : selectedStoreDetail.plan === 'pro'
                          ? 'Pro'
                          : 'Free'}
                    </span>
                  )}
                </div>
                {onUpdateUserPlan && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">
                    管理者向け操作です。Stripe
                    で課金しているユーザーは、請求・Webhookによりプランが再同期される場合があります。
                  </p>
                )}
              </div>
            </section>
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
                          day: 'numeric',
                        })
                      : '-'}
                  </span>
                </div>
              </div>
            </section>
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
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedStoreDetail.has_line_connection ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {selectedStoreDetail.has_line_connection ? '連携済み' : '未連携'}
                    </span>
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
                              day: 'numeric',
                            })
                          : '-'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </section>
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
                      ? (
                          ((selectedStoreDetail.store_auto_reply_count + selectedStoreDetail.store_ai_reply_count) /
                            selectedStoreDetail.store_message_count) *
                          100
                        ).toFixed(1)
                      : '0.0'}%
                  </span>
                </div>
              </div>
            </section>
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
