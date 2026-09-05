import { useMemo, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCw, ShieldAlert } from 'lucide-react'
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import Toast from '../../components/Toast'
import { useMarketingAds, type AdSummary } from '../../features/marketing/hooks/useMarketingAds'

const UNPARSED_BUCKET = 'その他'

function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}

function pct(n: number): string {
  return `${n.toFixed(2)}%`
}

function StatusDot({ status }: { status: string | null }) {
  const active = status === 'ACTIVE'
  return (
    <span className={`inline-block h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
  )
}

/** 業種×訴求のグループキー。表示ラベルにも使う。 */
function groupKey(industry: string, appeal: string): string {
  return `${industry} / ${appeal}`
}

export default function AdsPage() {
  const { view, loading, busy, loadError, days, setDays, syncNow } = useMarketingAds()
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false, message: '', type: 'success',
  })
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)

  const notify = (r: { success: boolean; message: string }) =>
    setToast({ isVisible: true, message: r.message, type: r.success ? 'success' : 'error' })

  const groups = useMemo(() => {
    if (!view) return []
    const keys = new Set(view.ads.map((a) => groupKey(a.industry, a.appeal)))
    // その他は常に末尾に固定して目立たせすぎない。
    return [...keys].sort((a, b) => {
      if (a.startsWith(UNPARSED_BUCKET)) return 1
      if (b.startsWith(UNPARSED_BUCKET)) return -1
      return a.localeCompare(b, 'ja')
    })
  }, [view])

  const activeGroup = selectedGroup && groups.includes(selectedGroup) ? selectedGroup : groups[0] ?? null

  const chartData = useMemo(() => {
    if (!view || !activeGroup) return { series: [], lines: [] as { key: string; label: string }[] }
    const points = view.daily.filter((d) => groupKey(d.industry, d.appeal) === activeGroup)
    const lineMeta = new Map<string, string>()
    for (const p of points) {
      const label = p.version != null ? `v${p.version}` : p.name
      lineMeta.set(p.adId, label)
    }
    const byDate = new Map<string, Record<string, unknown>>()
    for (const p of points) {
      const row = byDate.get(p.date) ?? { date: p.date }
      const ctr = p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0
      row[p.adId] = Number(ctr.toFixed(2))
      byDate.set(p.date, row)
    }
    const series = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
    const lines = [...lineMeta.entries()].map(([key, label]) => ({ key, label }))
    return { series, lines }
  }, [view, activeGroup])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="mr-2 animate-spin" size={20} /> 読み込み中...
      </div>
    )
  }

  if (loadError || !view) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="mb-2 flex items-center gap-2 font-medium">
          <AlertTriangle size={18} /> 読み込めませんでした
        </div>
        <p className="text-sm">{loadError}</p>
      </div>
    )
  }

  const sortedAds = [...view.ads].sort((a, b) => b.spend - a.spend)
  const sortedCrossTab = [...view.crossTab].sort((a, b) => b.spend - a.spend)
  const totalSpend = view.ads.reduce((s, a) => s + a.spend, 0)

  return (
    <div className="space-y-6">
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((p) => ({ ...p, isVisible: false }))}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">広告ダッシュボード</h2>
          <p className="text-sm text-gray-500">
            直近{days}日間の合計 {yen(totalSpend)}（{view.since} 以降）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
          >
            <option value={7}>直近7日</option>
            <option value={30}>直近30日</option>
            <option value={90}>直近90日</option>
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={async () => notify(await syncNow())}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            今すぐ取得
          </button>
        </div>
      </div>

      {!view.hasAdsRead && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <p>
            Facebook トークンに <code className="rounded bg-amber-100 px-1">ads_read</code> 権限がまだありません。
            表示中の数値は過去に取り込んだ分のみで、自動更新は再認可が済むまで動きません
            （「広報 &gt; 接続状態」で状況を確認できます）。
          </p>
        </div>
      )}

      {sortedAds.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          この期間のデータがまだありません。
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-bold text-gray-900">業種 × 訴求</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                    <th className="py-1.5 pr-3 font-medium">業種</th>
                    <th className="py-1.5 pr-3 font-medium">訴求</th>
                    <th className="py-1.5 pr-3 text-right font-medium">消化金額</th>
                    <th className="py-1.5 pr-3 text-right font-medium">imp</th>
                    <th className="py-1.5 pr-3 text-right font-medium">クリック</th>
                    <th className="py-1.5 pr-3 text-right font-medium">CTR</th>
                    <th className="py-1.5 pr-3 text-right font-medium">CPM</th>
                    <th className="py-1.5 pr-3 text-right font-medium">リード</th>
                    <th className="py-1.5 text-right font-medium">CPA</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCrossTab.map((c) => (
                    <tr
                      key={groupKey(c.industry, c.appeal)}
                      className={`border-b border-gray-100 last:border-0 ${c.industry === UNPARSED_BUCKET ? 'text-gray-400' : 'text-gray-700'}`}
                    >
                      <td className="py-1.5 pr-3">{c.industry}</td>
                      <td className="py-1.5 pr-3">{c.appeal}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{yen(c.spend)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{c.impressions.toLocaleString('ja-JP')}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{c.clicks.toLocaleString('ja-JP')}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{pct(c.ctr)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{yen(c.cpm)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{c.leads}</td>
                      <td className="py-1.5 text-right tabular-nums">{c.costPerLead != null ? yen(c.costPerLead) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-gray-900">バージョン推移（CTR）</h3>
              <div className="flex flex-wrap gap-1">
                {groups.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGroup(g)}
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      g === activeGroup ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            {chartData.series.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">このグループのデータがありません</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" width={48} />
                    <Tooltip formatter={(v?: number) => `${v ?? 0}%`} />
                    {chartData.lines.map((l, i) => (
                      <Line
                        key={l.key}
                        type="monotone"
                        dataKey={l.key}
                        name={l.label}
                        stroke={['#00c3dc', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981'][i % 5]}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-bold text-gray-900">広告一覧</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                    <th className="py-1.5 pr-3 font-medium"></th>
                    <th className="py-1.5 pr-3 font-medium">広告名</th>
                    <th className="py-1.5 pr-3 font-medium">業種</th>
                    <th className="py-1.5 pr-3 font-medium">訴求</th>
                    <th className="py-1.5 pr-3 font-medium">v</th>
                    <th className="py-1.5 pr-3 text-right font-medium">消化金額</th>
                    <th className="py-1.5 pr-3 text-right font-medium">CTR</th>
                    <th className="py-1.5 pr-3 text-right font-medium">CPM</th>
                    <th className="py-1.5 text-right font-medium">CPA</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAds.map((a: AdSummary) => (
                    <tr key={a.adId} className="border-b border-gray-100 last:border-0 text-gray-700">
                      <td className="py-1.5 pr-3"><StatusDot status={a.effectiveStatus} /></td>
                      <td className="py-1.5 pr-3">
                        <span className={a.parsed ? '' : 'text-gray-400'}>{a.name}</span>
                        {a.suffix && <span className="ml-1 text-xs text-gray-400">({a.suffix})</span>}
                      </td>
                      <td className="py-1.5 pr-3">{a.industry}</td>
                      <td className="py-1.5 pr-3">{a.appeal}</td>
                      <td className="py-1.5 pr-3">{a.version != null ? `v${a.version}` : '—'}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{yen(a.spend)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{pct(a.ctr)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{yen(a.cpm)}</td>
                      <td className="py-1.5 text-right tabular-nums">{a.costPerLead != null ? yen(a.costPerLead) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
