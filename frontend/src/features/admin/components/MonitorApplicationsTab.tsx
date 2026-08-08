import { useEffect, useState } from 'react'
import { Loader2, AlertTriangle, Mail, Phone, MessageCircle } from 'lucide-react'
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

export function MonitorApplicationsTab() {
  const [applications, setApplications] = useState<MonitorApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadApplications = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('monitor_applications')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setApplications(data as MonitorApplication[])
    }
    setLoading(false)
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
