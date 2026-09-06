import { useMemo, useState } from 'react'
import {
  AlertTriangle, Info, Loader2, RefreshCw, ShieldAlert, TrendingDown, TrendingUp,
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps,
} from 'recharts'
import Toast from '../../components/Toast'
import {
  useMarketingAds, type AdInsight, type AdSummary, type CrossTabCell,
} from '../../features/marketing/hooks/useMarketingAds'

const UNPARSED_BUCKET = 'その他'
const ACTIVE_COLOR = '#00acc4'
const PAUSED_COLOR = '#cbd5e1'
const GOOD_COLOR = '#10b981'
const WARN_COLOR = '#f59e0b'

function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}

function pct(n: number): string {
  return `${n.toFixed(2)}%`
}

function yenAxisTick(n: number): string {
  return n >= 1000 ? `¥${(n / 1000).toFixed(1)}k` : `¥${n}`
}

/** 業種×訴求のグループキー。表示ラベルにも使う。 */
function groupKey(industry: string, appeal: string): string {
  return `${industry} / ${appeal}`
}

/** 広告一覧をグラフの軸ラベルに詰めるための短縮名。命名規約に沿う広告は
 *  「業種/訴求 vN」で十分に一意なので、長い元の広告名は出さない。 */
function adLabel(a: AdSummary): string {
  if (a.parsed && a.version != null) {
    return `${a.industry}/${a.appeal} v${a.version}${a.suffix ? `(${a.suffix})` : ''}`
  }
  return a.name
}

const INSIGHT_STYLE: Record<AdInsight['severity'], { wrap: string; iconWrap: string; icon: typeof TrendingUp }> = {
  good: { wrap: 'border-emerald-200 bg-emerald-50', iconWrap: 'bg-emerald-100 text-emerald-700', icon: TrendingUp },
  warn: { wrap: 'border-amber-200 bg-amber-50', iconWrap: 'bg-amber-100 text-amber-700', icon: TrendingDown },
  neutral: { wrap: 'border-gray-200 bg-gray-50', iconWrap: 'bg-gray-200 text-gray-600', icon: Info },
}

function InsightCard({ insight }: { insight: AdInsight }) {
  const style = INSIGHT_STYLE[insight.severity]
  const Icon = style.icon
  return (
    <div className={`flex gap-3 rounded-lg border p-3.5 ${style.wrap}`}>
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${style.iconWrap}`}>
        <Icon size={14} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{insight.title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-gray-600">{insight.body}</p>
      </div>
    </div>
  )
}

function TooltipCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[180px] rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-gray-900">{title}</p>
      {children}
    </div>
  )
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5 text-gray-600">
      <span>{label}</span>
      <span className="ml-2 font-medium tabular-nums text-gray-900">{value}</span>
    </div>
  )
}

/** 横棒グラフの1本分。original に元データを持たせ、Tooltip 側で内訳を出す。 */
type BarDatum<T> = { label: string; value: number; fill: string; original: T }

/** 業種×訴求・広告一覧・稼働状況比較で使い回す横棒グラフ。
 *  項目数に応じて高さを可変にし、少数項目でも間延びしないようにする。 */
function HorizontalBarChart<T>({
  data, valueTickFormatter, referenceValue, tooltipContent,
}: {
  data: BarDatum<T>[]
  valueTickFormatter: (v: number) => string
  referenceValue?: number
  tooltipContent: (props: TooltipContentProps<number, string>) => React.ReactNode
}) {
  const height = Math.max(data.length * 30, 72)
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={valueTickFormatter} />
          <YAxis type="category" dataKey="label" width={168} tick={{ fontSize: 11, fill: '#4b5563' }} interval={0} />
          {referenceValue != null && (
            <ReferenceLine x={referenceValue} stroke="#9ca3af" strokeDasharray="4 4" />
          )}
          <Tooltip content={tooltipContent} cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function crossTabTooltip(props: TooltipContentProps<number, string>): React.ReactNode {
  const { active, payload } = props
  if (!active || !payload?.length) return null
  const d = (payload[0].payload as BarDatum<CrossTabCell>).original
  return (
    <TooltipCard title={groupKey(d.industry, d.appeal)}>
      <TooltipRow label="消化金額" value={yen(d.spend)} />
      <TooltipRow label="インプレッション" value={d.impressions.toLocaleString('ja-JP')} />
      <TooltipRow label="クリック" value={d.clicks.toLocaleString('ja-JP')} />
      <TooltipRow label="CTR" value={pct(d.ctr)} />
      <TooltipRow label="CPM" value={yen(d.cpm)} />
      <TooltipRow label="リード" value={String(d.leads)} />
      <TooltipRow label="CPA" value={d.costPerLead != null ? yen(d.costPerLead) : '—'} />
    </TooltipCard>
  )
}

function adTooltip(props: TooltipContentProps<number, string>): React.ReactNode {
  const { active, payload } = props
  if (!active || !payload?.length) return null
  const d = (payload[0].payload as BarDatum<AdSummary>).original
  return (
    <TooltipCard title={adLabel(d)}>
      <TooltipRow label="ステータス" value={d.effectiveStatus === 'ACTIVE' ? '稼働中' : '停止中'} />
      <TooltipRow label="消化金額" value={yen(d.spend)} />
      <TooltipRow label="インプレッション" value={d.impressions.toLocaleString('ja-JP')} />
      <TooltipRow label="クリック" value={d.clicks.toLocaleString('ja-JP')} />
      <TooltipRow label="CTR" value={pct(d.ctr)} />
      <TooltipRow label="CPM" value={yen(d.cpm)} />
      <TooltipRow label="CPA" value={d.costPerLead != null ? yen(d.costPerLead) : '—'} />
    </TooltipCard>
  )
}

type StatusGroup = { status: 'ACTIVE' | 'PAUSED'; count: number; spend: number; ctr: number }

function statusTooltip(props: TooltipContentProps<number, string>): React.ReactNode {
  const { active, payload } = props
  if (!active || !payload?.length) return null
  const d = (payload[0].payload as BarDatum<StatusGroup>).original
  return (
    <TooltipCard title={d.status === 'ACTIVE' ? '稼働中' : '停止中'}>
      <TooltipRow label="本数" value={`${d.count}本`} />
      <TooltipRow label="消化金額" value={yen(d.spend)} />
      <TooltipRow label="CTR" value={pct(d.ctr)} />
    </TooltipCard>
  )
}

const TREND_METRICS = [
  { key: 'ctr' as const, label: 'CTR' },
  { key: 'spend' as const, label: '消化金額' },
  { key: 'clicks' as const, label: 'クリック' },
]
type TrendMetric = (typeof TREND_METRICS)[number]['key']

export default function AdsPage() {
  const { view, loading, busy, loadError, days, setDays, syncNow } = useMarketingAds()
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false, message: '', type: 'success',
  })
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('ctr')

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

  const trendData = useMemo(() => {
    if (!view || !activeGroup) return { series: [] as Record<string, unknown>[], lines: [] as { key: string; label: string }[] }
    const points = view.daily.filter((d) => groupKey(d.industry, d.appeal) === activeGroup)
    const lineMeta = new Map<string, string>()
    for (const p of points) {
      const label = p.version != null ? `v${p.version}` : p.name
      lineMeta.set(p.adId, label)
    }
    const byDate = new Map<string, Record<string, unknown>>()
    for (const p of points) {
      const row = byDate.get(p.date) ?? { date: p.date }
      const raw = trendMetric === 'ctr'
        ? (p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0)
        : trendMetric === 'spend' ? p.spend : p.clicks
      row[p.adId] = Number(raw.toFixed(trendMetric === 'ctr' ? 2 : 0))
      byDate.set(p.date, row)
    }
    const series = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
    const lines = [...lineMeta.entries()].map(([key, label]) => ({ key, label }))
    return { series, lines }
  }, [view, activeGroup, trendMetric])

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

  const totalSpend = view.ads.reduce((s, a) => s + a.spend, 0)
  const totalImpressions = view.ads.reduce((s, a) => s + a.impressions, 0)
  const totalClicks = view.ads.reduce((s, a) => s + a.clicks, 0)
  const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

  const crossTabBySpend: BarDatum<CrossTabCell>[] = [...view.crossTab]
    .sort((a, b) => b.spend - a.spend)
    .map((c) => ({ label: groupKey(c.industry, c.appeal), value: c.spend, fill: ACTIVE_COLOR, original: c }))
  const crossTabByCtr: BarDatum<CrossTabCell>[] = [...view.crossTab]
    .sort((a, b) => b.ctr - a.ctr)
    .map((c) => ({
      label: groupKey(c.industry, c.appeal),
      value: Number(c.ctr.toFixed(2)),
      fill: c.ctr >= overallCtr ? GOOD_COLOR : WARN_COLOR,
      original: c,
    }))

  const activeAds = view.ads.filter((a) => a.effectiveStatus === 'ACTIVE')
  const pausedAds = view.ads.filter((a) => a.effectiveStatus && a.effectiveStatus !== 'ACTIVE')
  const activeSpend = activeAds.reduce((s, a) => s + a.spend, 0)
  const pausedSpend = pausedAds.reduce((s, a) => s + a.spend, 0)
  const activeImp = activeAds.reduce((s, a) => s + a.impressions, 0)
  const pausedImp = pausedAds.reduce((s, a) => s + a.impressions, 0)
  const activeCtr = activeImp > 0 ? (activeAds.reduce((s, a) => s + a.clicks, 0) / activeImp) * 100 : 0
  const pausedCtr = pausedImp > 0 ? (pausedAds.reduce((s, a) => s + a.clicks, 0) / pausedImp) * 100 : 0
  const hasStatusSplit = activeAds.length > 0 && pausedAds.length > 0
  const statusSpendData: BarDatum<StatusGroup>[] = [
    { label: `稼働中（${activeAds.length}本）`, value: activeSpend, fill: ACTIVE_COLOR, original: { status: 'ACTIVE', count: activeAds.length, spend: activeSpend, ctr: activeCtr } },
    { label: `停止中（${pausedAds.length}本）`, value: pausedSpend, fill: PAUSED_COLOR, original: { status: 'PAUSED', count: pausedAds.length, spend: pausedSpend, ctr: pausedCtr } },
  ]
  const statusCtrData: BarDatum<StatusGroup>[] = [
    { label: `稼働中（${activeAds.length}本）`, value: Number(activeCtr.toFixed(2)), fill: ACTIVE_COLOR, original: { status: 'ACTIVE', count: activeAds.length, spend: activeSpend, ctr: activeCtr } },
    { label: `停止中（${pausedAds.length}本）`, value: Number(pausedCtr.toFixed(2)), fill: PAUSED_COLOR, original: { status: 'PAUSED', count: pausedAds.length, spend: pausedSpend, ctr: pausedCtr } },
  ]

  const adsBySpend: BarDatum<AdSummary>[] = [...view.ads]
    .sort((a, b) => b.spend - a.spend)
    .map((a) => ({ label: adLabel(a), value: a.spend, fill: a.effectiveStatus === 'ACTIVE' ? ACTIVE_COLOR : PAUSED_COLOR, original: a }))
  const adsByCtr: BarDatum<AdSummary>[] = [...view.ads]
    .sort((a, b) => b.ctr - a.ctr)
    .map((a) => ({ label: adLabel(a), value: Number(a.ctr.toFixed(2)), fill: a.effectiveStatus === 'ACTIVE' ? ACTIVE_COLOR : PAUSED_COLOR, original: a }))

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

      {view.ads.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          この期間のデータがまだありません。
        </div>
      ) : (
        <>
          {view.insights.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-bold text-gray-900">分析</h3>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {view.insights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-1 text-sm font-bold text-gray-900">業種 × 訴求 比較</h3>
            <p className="mb-3 text-xs text-gray-400">バーにカーソルを合わせると内訳（imp・クリック・CPM・リード）を表示します。</p>
            <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">消化金額</p>
                <HorizontalBarChart data={crossTabBySpend} valueTickFormatter={yenAxisTick} tooltipContent={crossTabTooltip} />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">
                  CTR <span className="text-gray-400">（点線は全体平均 {pct(overallCtr)}）</span>
                </p>
                <HorizontalBarChart
                  data={crossTabByCtr}
                  valueTickFormatter={(v) => `${v}%`}
                  referenceValue={overallCtr}
                  tooltipContent={crossTabTooltip}
                />
              </div>
            </div>
          </div>

          {hasStatusSplit && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-bold text-gray-900">稼働中 vs 停止中</h3>
              <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-500">消化金額</p>
                  <HorizontalBarChart data={statusSpendData} valueTickFormatter={yenAxisTick} tooltipContent={statusTooltip} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-500">CTR</p>
                  <HorizontalBarChart data={statusCtrData} valueTickFormatter={(v) => `${v}%`} tooltipContent={statusTooltip} />
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-gray-900">クリエイティブ推移</h3>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5">
                  {TREND_METRICS.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setTrendMetric(m.key)}
                      className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                        trendMetric === m.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap gap-1">
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
            {trendData.series.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">このグループのデータがありません</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      width={trendMetric === 'spend' ? 56 : 48}
                      unit={trendMetric === 'ctr' ? '%' : undefined}
                      tickFormatter={trendMetric === 'spend' ? yenAxisTick : undefined}
                    />
                    <Tooltip
                      formatter={(v?: number) => (trendMetric === 'ctr' ? `${v ?? 0}%` : trendMetric === 'spend' ? yen(v ?? 0) : `${v ?? 0}件`)}
                    />
                    {trendData.lines.map((l, i) => (
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
            <h3 className="mb-1 text-sm font-bold text-gray-900">広告別比較</h3>
            <p className="mb-3 text-xs text-gray-400">
              <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: ACTIVE_COLOR }} />稼働中
              <span className="mx-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: PAUSED_COLOR }} />停止中
            </p>
            <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">消化金額</p>
                <HorizontalBarChart data={adsBySpend} valueTickFormatter={yenAxisTick} tooltipContent={adTooltip} />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">
                  CTR <span className="text-gray-400">（点線は全体平均 {pct(overallCtr)}）</span>
                </p>
                <HorizontalBarChart
                  data={adsByCtr}
                  valueTickFormatter={(v) => `${v}%`}
                  referenceValue={overallCtr}
                  tooltipContent={adTooltip}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
