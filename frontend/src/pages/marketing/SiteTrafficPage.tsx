import { useState } from 'react'
import { Info, Loader2, RefreshCw } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps,
} from 'recharts'
import { useSiteTraffic, type SiteClickTarget, type SiteTraffic, type TrafficCounts } from '../../features/marketing/hooks/useSiteTraffic'

const ACTIVE_COLOR = '#00acc4'

const PAGE_LABELS: Record<string, string> = {
  '/': 'トップ',
  '/monitor': 'モニター募集',
  '/feature/auto-response': '機能：自動応答',
  '/feature/reservation': '機能：予約',
  '/feature/membership': '機能：会員証',
  '/feature/ai': '機能：AI',
  '/feature/customers': '機能：顧客管理',
  '/feature/points': '機能：ポイント',
  '/feature/messaging': '機能：メッセージ配信',
  '/feature/rich-menu': '機能：リッチメニュー',
  '/security-guide': 'セキュリティガイド',
  '/security': 'セキュリティ方針',
  '/privacy': 'プライバシーポリシー',
  '/terms': '利用規約',
  '/specified-commercial-transactions': '特定商取引法の表記',
}

const SOURCE_LABELS: Record<string, string> = {
  direct: '直接（ブックマーク・URL入力など）',
  meta: 'Instagram / Facebook',
  google: 'Google検索',
  yahoo: 'Yahoo!検索',
  bing: 'Bing検索',
  x: 'X',
  line: 'LINE',
  youtube: 'YouTube',
}

const CLICK_LABELS: Record<SiteClickTarget, string> = {
  line_demo: 'LINEで試す・相談する（デモ用LINE）',
  signup: '無料で始める',
  monitor: 'モニター特典',
}

function num(n: number): string {
  return n.toLocaleString('ja-JP')
}

/** 2026-10-03 → 10/3 */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return <span className="text-xs text-gray-400">前の期間：データなし</span>
  }
  const diff = ((current - previous) / previous) * 100
  const sign = diff > 0 ? '+' : ''
  return (
    <span className="text-xs text-gray-500">
      前の期間 {num(previous)}（{sign}{diff.toFixed(0)}%）
    </span>
  )
}

function StatTile({ label, value, previous, current }: { label: string; value: string; previous?: number; current?: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
      {previous != null && current != null && <Delta current={current} previous={previous} />}
    </div>
  )
}

/** 表＋行内の横棒。順位の比較が主な用途なので、グラフより表のほうが読みやすい。 */
function RankTable({
  title, note, unit, rows,
}: {
  title: string
  note?: string
  unit: string
  rows: { key: string; label: string; sub?: string; value: number; extra?: string }[]
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-gray-500">{note}</p>}
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">この期間のデータはありません</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="pb-1.5 font-medium">項目</th>
              <th className="w-24 pb-1.5 text-right font-medium">{unit}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-gray-100">
                <td className="py-2 pr-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-gray-800" title={r.sub ?? r.label}>{r.label}</span>
                    {r.extra && <span className="shrink-0 text-xs text-gray-400">{r.extra}</span>}
                  </div>
                  {r.sub && <div className="truncate font-mono text-[11px] text-gray-400">{r.sub}</div>}
                  <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                    <div className="h-1.5 rounded-full" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: ACTIVE_COLOR }} />
                  </div>
                </td>
                <td className="py-2 text-right tabular-nums text-gray-900">{num(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function dailyTooltip(props: TooltipContentProps<number, string>): React.ReactNode {
  const { active, payload } = props
  if (!active || !payload?.length) return null
  const p = payload[0].payload as { date: string; views: number; visitors: number }
  return (
    <div className="min-w-[150px] rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-gray-900">{p.date}</p>
      <div className="flex justify-between gap-4 py-0.5 text-gray-600"><span>閲覧数</span><span className="font-medium text-gray-900">{num(p.views)}</span></div>
      <div className="flex justify-between gap-4 py-0.5 text-gray-600"><span>訪問者数</span><span className="font-medium text-gray-900">{num(p.visitors)}</span></div>
    </div>
  )
}

function excludedNote(excluded: SiteTraffic['excluded']): string {
  if (!excluded) return ''
  const parts = [
    excluded.owner_views > 0 ? `運営者のブラウザ ${num(excluded.owner_views)}件` : null,
    excluded.bot_views > 0 ? `bot ${num(excluded.bot_views)}件` : null,
  ].filter(Boolean)
  return parts.length === 0 ? '' : `この期間に除いた閲覧：${parts.join('、')}。`
}

function pagesPerSession(t: TrafficCounts): string {
  return t.sessions === 0 ? '—' : (t.views / t.sessions).toFixed(1)
}

export default function SiteTrafficPage() {
  const [days, setDays] = useState(30)
  const { data, loading, error, reload, markLoading } = useSiteTraffic(days)

  if (loading && !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }
  if (error || !data) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{error ?? '閲覧データを読み込めませんでした'}</div>
  }

  const { totals, previous } = data
  const mobile = data.devices.find((d) => d.device === 'mobile')?.views ?? 0
  const mobileShare = totals.views === 0 ? '—' : `${Math.round((mobile / totals.views) * 100)}%`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">サイト閲覧</h2>
          <p className="text-sm text-gray-500">
            製品紹介ページ（トップ・機能紹介・モニター募集・規約類）の閲覧状況。{data.from} 〜 {data.to}（日本時間）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => {
              markLoading()
              setDays(Number(e.target.value))
            }}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
          >
            <option value={7}>直近7日</option>
            <option value={30}>直近30日</option>
            <option value={90}>直近90日</option>
          </select>
          <button
            type="button"
            disabled={loading}
            onClick={reload}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            更新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="閲覧数（ページビュー）" value={num(totals.views)} current={totals.views} previous={previous.views} />
        <StatTile label="訪問者数（ブラウザ単位）" value={num(totals.visitors)} current={totals.visitors} previous={previous.visitors} />
        <StatTile label="訪問数" value={num(totals.sessions)} current={totals.sessions} previous={previous.sessions} />
        <StatTile label="1訪問あたりのページ数" value={pagesPerSession(totals)} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">日別の閲覧数</h3>
        <p className="mt-0.5 text-xs text-gray-500">スマホからの閲覧 {mobileShare}</p>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.daily} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} minTickGap={12} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
              <Tooltip content={dailyTooltip} cursor={{ fill: '#f3f4f6' }} />
              <Bar dataKey="views" fill={ACTIVE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RankTable
          title="ページ別"
          unit="閲覧数"
          rows={data.pages.map((p) => ({
            key: p.path,
            label: PAGE_LABELS[p.path] ?? p.path,
            sub: p.path,
            value: p.views,
            extra: `${num(p.visitors)}人`,
          }))}
        />
        <RankTable
          title="流入元"
          note="訪問の最初のページで判定。広告URLに utm_source を付けると、その値で分かれます。"
          unit="訪問数"
          rows={data.sources.map((s) => ({ key: s.source, label: SOURCE_LABELS[s.source] ?? s.source, value: s.sessions }))}
        />
        <RankTable
          title="入口ページ"
          note="訪問者が最初に開いたページ。広告やSNSからどこに着地しているかが分かります。"
          unit="訪問数"
          rows={data.landings.map((l) => ({ key: l.path, label: PAGE_LABELS[l.path] ?? l.path, sub: l.path, value: l.sessions }))}
        />
        <RankTable
          title="押されたボタン"
          note="閲覧のあと、どのボタンに進んだか。右の人数は押したブラウザの数。"
          unit="回数"
          rows={(data.clicks?.targets ?? []).map((c) => ({
            key: c.target,
            label: CLICK_LABELS[c.target] ?? c.target,
            value: c.clicks,
            extra: `${num(c.visitors)}人`,
          }))}
        />
        <RankTable
          title="ボタンを押したページ"
          note="どのページから押されたか。"
          unit="回数"
          rows={(data.clicks?.by_page ?? []).map((c) => ({
            key: `${c.target}|${c.path}`,
            label: CLICK_LABELS[c.target] ?? c.target,
            sub: `${PAGE_LABELS[c.path] ?? c.path}（${c.path}）`,
            value: c.clicks,
          }))}
        />
        <RankTable
          title="キャンペーン（utm_campaign）"
          note="URLに utm_campaign を付けた訪問だけが並びます。"
          unit="訪問数"
          rows={data.campaigns.map((c) => ({
            key: `${c.campaign}|${c.source}|${c.medium}`,
            label: c.campaign,
            sub: [c.source, c.medium].filter(Boolean).join(' / ') || undefined,
            value: c.sessions,
          }))}
        />
      </div>

      <p className="flex items-start gap-1.5 text-xs text-gray-500">
        <Info size={14} className="mt-px shrink-0" />
        <span>
          ログイン中の閲覧、検索エンジンなどのbot、本番以外の環境（ローカル・プレビュー）での閲覧は数えていません。
          管理者でログインしたことのあるブラウザ（運営者の開発・確認用）の閲覧は、ログアウト中のものも除いています。
          訪問者数はブラウザごとの数なので、同じ人がスマホとPCで見ると2人になります。
          {excludedNote(data.excluded)}
        </span>
      </p>
    </div>
  )
}
