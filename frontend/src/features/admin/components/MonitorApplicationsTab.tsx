import { useEffect, useState } from 'react'
import { Loader2, AlertTriangle, Mail, Phone, MessageCircle, Wrench, Check, UserX } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

interface MonitorApplication {
  id: string
  store_name: string
  industry: string | null
  contact_name: string
  email: string
  phone: string | null
  has_line_account: boolean
  course: 'omakase' | 'jikkuri'
  message: string | null
  status: 'pending' | 'contacted' | 'approved' | 'rejected'
  created_at: string
}

/** この申込から既に設定代行の注文が作られているか。 */
interface LinkedOrder {
  id: string
  status: string
}

const STATUS_LABELS: Record<MonitorApplication['status'], string> = {
  pending: '未対応',
  contacted: '連絡済み',
  approved: '特典適用済み',
  rejected: '対象外',
}

const STATUS_STYLES: Record<MonitorApplication['status'], string> = {
  pending: 'bg-gray-100 text-gray-700',
  contacted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const COURSE_LABELS: Record<MonitorApplication['course'], string> = {
  omakase: 'おまかせ導入コース',
  jikkuri: 'じっくりお得コース',
}

interface Props {
  /** 代行注文を作成した直後に呼ばれる。親が注文一覧を取り直すために使う。 */
  onOrderCreated?: () => void
}

export function MonitorApplicationsTab({ onOrderCreated }: Props = {}) {
  const [applications, setApplications] = useState<MonitorApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [linkedOrders, setLinkedOrders] = useState<Record<string, LinkedOrder>>({})
  const [startingId, setStartingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ id: string; text: string; tone: 'ok' | 'warn' } | null>(null)

  const loadApplications = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('monitor_applications')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setApplications(data as MonitorApplication[])
    }

    // 既に代行注文になっている申込を拾い、ボタンの出し分けに使う。
    const { data: orders } = await supabase
      .from('setup_service_orders')
      .select('id, status, monitor_application_id')
      .not('monitor_application_id', 'is', null)

    if (orders) {
      const map: Record<string, LinkedOrder> = {}
      orders.forEach((o: { id: string; status: string; monitor_application_id: string }) => {
        map[o.monitor_application_id] = { id: o.id, status: o.status }
      })
      setLinkedOrders(map)
    }

    setLoading(false)
  }

  /**
   * 申込者のメールアドレスから登録済みユーザーを引き、
   * モニター特典としての設定代行注文（無料）を作る。
   * これが「初期設定依頼」タブに作業対象として並ぶ。
   */
  const startSetupService = async (app: MonitorApplication) => {
    setStartingId(app.id)
    setNotice(null)
    try {
      const { data: res, error: lookupError } = await supabase.functions.invoke('get-admin-data', {
        body: { type: 'profile_by_email', email: app.email },
      })

      if (lookupError) throw lookupError

      const found = res?.data as { profile: { id: string }; store: { id: string } | null } | null
      if (!found?.profile) {
        setNotice({
          id: app.id,
          tone: 'warn',
          text: 'このメールアドレスでの登録がまだありません。先にアカウント登録をご案内してください（登録後にこのボタンで作業を開始できます）。',
        })
        return
      }

      const { data: created, error: insertError } = await supabase
        .from('setup_service_orders')
        .insert({
          user_id: found.profile.id,
          store_id: found.store?.id ?? null,
          monitor_application_id: app.id,
          amount: 0,
          status: 'in_progress',
          paid_at: new Date().toISOString(),
          contact_email: app.email,
          contact_phone: app.phone,
          has_line_account: app.has_line_account,
          additional_notes: app.message,
          admin_notes: `モニター特典（${COURSE_LABELS[app.course]}）からの設定代行。申込日: ${new Date(app.created_at).toLocaleDateString('ja-JP')}`,
        })
        .select('id, status')
        .single()

      if (insertError) throw insertError

      setLinkedOrders((prev) => ({ ...prev, [app.id]: created as LinkedOrder }))
      setNotice({ id: app.id, tone: 'ok', text: '「初期設定依頼」タブに作業対象として追加しました。' })

      // 着手した時点で未対応のままにしない。
      if (app.status === 'pending') {
        await updateStatus(app.id, 'contacted')
      }

      onOrderCreated?.()
    } catch (e) {
      // 原因が分からないと対処できないので、失敗理由をそのまま出す。
      const detail = e instanceof Error ? e.message : String(e)
      setNotice({ id: app.id, tone: 'warn', text: `作業対象の作成に失敗しました: ${detail}` })
    } finally {
      setStartingId(null)
    }
  }

  useEffect(() => {
    loadApplications()
  }, [])

  const updateStatus = async (id: string, status: MonitorApplication['status']) => {
    setUpdatingId(id)
    const { error } = await supabase.from('monitor_applications').update({ status }).eq('id', id)
    if (!error) {
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
    }
    setUpdatingId(null)
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-4 border-b">
        <h2 className="font-bold text-gray-900">モニター特典 申込一覧 ({applications.length})</h2>
      </div>
      {applications.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          申込がありません
        </div>
      ) : (
        <div className="divide-y max-h-[calc(100vh-350px)] overflow-y-auto">
          {applications.map((app) => (
            <div key={app.id} className="p-4">
              <div className="flex items-start justify-between mb-2 gap-4">
                <div>
                  <p className="font-medium text-gray-900">{app.store_name}</p>
                  <p className="text-sm text-gray-500">{app.industry || '業種未回答'} ・ {app.contact_name}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${STATUS_STYLES[app.status]}`}>
                  {STATUS_LABELS[app.status]}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
                <span className="flex items-center gap-1"><Mail size={12} />{app.email}</span>
                {app.phone && <span className="flex items-center gap-1"><Phone size={12} />{app.phone}</span>}
                {app.has_line_account && <span className="flex items-center gap-1 text-[#06C755]"><MessageCircle size={12} />LINE公式アカウント有り</span>}
                <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full font-medium">{COURSE_LABELS[app.course]}</span>
                <span>{new Date(app.created_at).toLocaleDateString('ja-JP')}</span>
              </div>
              {app.message && (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2 mb-2">{app.message}</p>
              )}
              {/* 何をすればいいかが分かるように、次の一手を先頭に置く。 */}
              <div className="mb-2">
                {linkedOrders[app.id] ? (
                  <p className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                    <Check size={14} className="shrink-0" />
                    設定代行に着手済み。作業は「初期設定依頼」タブで進めてください。
                  </p>
                ) : (
                  <button
                    disabled={startingId === app.id}
                    onClick={() => startSetupService(app)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {startingId === app.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Wrench size={14} />}
                    設定代行を開始する
                  </button>
                )}
                {notice?.id === app.id && (
                  <p className={`mt-2 flex items-start gap-1.5 text-xs rounded-lg px-3 py-2 ${
                    notice.tone === 'ok' ? 'text-green-700 bg-green-50' : 'text-amber-800 bg-amber-50'
                  }`}>
                    {notice.tone === 'ok'
                      ? <Check size={14} className="shrink-0 mt-0.5" />
                      : <UserX size={14} className="shrink-0 mt-0.5" />}
                    {notice.text}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {app.status !== 'contacted' && (
                  <button
                    disabled={updatingId === app.id}
                    onClick={() => updateStatus(app.id, 'contacted')}
                    className="px-3 py-1 text-xs border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                  >
                    連絡済みにする
                  </button>
                )}
                {app.status !== 'approved' && (
                  <button
                    disabled={updatingId === app.id}
                    onClick={() => updateStatus(app.id, 'approved')}
                    className="px-3 py-1 text-xs border border-green-300 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-50"
                  >
                    特典適用済みにする
                  </button>
                )}
                {app.status !== 'rejected' && (
                  <button
                    disabled={updatingId === app.id}
                    onClick={() => updateStatus(app.id, 'rejected')}
                    className="px-3 py-1 text-xs border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                  >
                    対象外にする
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
