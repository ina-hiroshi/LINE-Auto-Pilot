import type { ComponentType, ReactNode } from 'react'
import { AlertCircle, Bot, Calendar, ListOrdered, Sparkles, TrendingUp, User, Users } from 'lucide-react'
import ProBadge from '../../../components/ProBadge'
import type {
  NameCountPoint,
  StatusPoint,
  TrendPoint,
  TrendWindow,
  WeekdayPoint,
} from '../../../lib/dashboardGraphs'
import { RankedBarsCard } from './RankedBarsCard'
import { StatusCard } from './StatusCard'
import { TrendCard } from './TrendCard'
import { WeekdayCard } from './WeekdayCard'

export type DashboardStats = {
  manualReplyNeeded: number
  todayReservations: number
  todayAutoResponses: number
  todayAiResponses: number
  totalFriends: number
  totalLogs: number
}

type DashboardGraphsTabProps = {
  stats: DashboardStats
  /** 「(今日)」「(全期間)」など、集計タイルの見出しに添える期間名 */
  rangeLabel: string
  /** 「今日」を選んだときは曜日別が意味を持たないので出さない */
  showWeekday: boolean
  trendWindow: TrendWindow
  messageTrend: TrendPoint[]
  userTrend: TrendPoint[]
  reservationTrend: TrendPoint[]
  weekdayData: WeekdayPoint[]
  statusData: StatusPoint[]
  menuData: NameCountPoint[]
  staffData: NameCountPoint[]
  isPro: boolean
  onOpenMessages: () => void
}

type KpiTileProps = {
  label: string
  value: number
  unit: string
  icon: ComponentType<{ size?: number; className?: string }>
  /** 全体に占める割合（%）。出さないタイルは undefined */
  share?: number
  /** 要対応のように、目に入ってほしいタイルだけ赤系にする */
  tone?: 'default' | 'alert'
  /** Pro限定タイルの鍵表示 */
  locked?: boolean
  className?: string
}

function KpiTile({ label, value, unit, icon: Icon, share, tone = 'default', locked, className = '' }: KpiTileProps) {
  const alert = tone === 'alert'
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-white p-3 sm:p-4 ${
        alert ? 'border-red-200' : 'border-gray-200'
      } ${className}`}
    >
      {locked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
          <ProBadge />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate text-xs font-medium text-gray-500">{label}</h2>
        <Icon size={16} className={`shrink-0 ${alert ? 'text-red-600' : 'text-gray-400'}`} />
      </div>
      <p className="mt-2 flex items-baseline gap-1">
        <span className={`text-2xl font-bold leading-none sm:text-3xl ${alert && value > 0 ? 'text-red-600' : 'text-gray-900'}`}>
          {value.toLocaleString()}
        </span>
        <span className="text-xs text-gray-500">{unit}</span>
        {share !== undefined && (
          <span className="ml-auto text-xs font-medium tabular-nums text-gray-500">全体の {share}%</span>
        )}
      </p>
    </div>
  )
}

function Section({
  title,
  description,
  tourId,
  children,
}: {
  title: string
  description: string
  /** 画面ツアーで光らせる対象。セクション全体は縦に長いので、見出しに付ける */
  tourId?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div data-tour={tourId}>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      {children}
    </section>
  )
}

/** ダッシュボード「グラフ」タブ。集計タイル → メッセージの動き → 予約・お客様の動き の順に読める */
export function DashboardGraphsTab({
  stats,
  rangeLabel,
  showWeekday,
  trendWindow,
  messageTrend,
  userTrend,
  reservationTrend,
  weekdayData,
  statusData,
  menuData,
  staffData,
  isPro,
  onOpenMessages,
}: DashboardGraphsTabProps) {
  const share = (n: number) => (stats.totalLogs > 0 ? Math.round((n / stats.totalLogs) * 100) : undefined)

  return (
    <div className="space-y-8">
      {stats.manualReplyNeeded > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="font-medium">
            現在、<span className="mx-1 text-lg font-bold text-red-700">{stats.manualReplyNeeded}件</span>のお客様への対応が必要です。
          </p>
          <button
            onClick={onOpenMessages}
            className="ml-auto shrink-0 rounded-lg bg-red-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            対応する
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <KpiTile
          label={`要対応 ${rangeLabel}`}
          value={stats.manualReplyNeeded}
          unit="件"
          icon={AlertCircle}
          tone="alert"
          share={share(stats.manualReplyNeeded)}
        />
        <KpiTile
          label={`自動応答 ${rangeLabel}`}
          value={stats.todayAutoResponses}
          unit="回"
          icon={Bot}
          share={share(stats.todayAutoResponses)}
        />
        <KpiTile
          label={`AI応答 ${rangeLabel}`}
          value={stats.todayAiResponses}
          unit="回"
          icon={Sparkles}
          share={share(stats.todayAiResponses)}
          locked={!isPro}
        />
        <KpiTile label={`予約 ${rangeLabel}`} value={stats.todayReservations} unit="件" icon={Calendar} />
        <KpiTile
          label={`ユーザー ${rangeLabel}`}
          value={stats.totalFriends}
          unit="人"
          icon={Users}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <Section
        title="メッセージの動き"
        description="いつ・どれだけ届き、どう処理されたか"
        tourId="dashboard.section-messages"
      >
        <div className="space-y-4">
          <TrendCard
            title="メッセージ数の推移"
            icon={TrendingUp}
            points={messageTrend}
            window={trendWindow}
            unit="件"
            seriesName="メッセージ数"
          />
          {/* 曜日別を出さないとき（今日）は、内訳が横幅いっぱいになる */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:[&>*:last-child:nth-child(odd)]:col-span-2">
            <StatusCard data={statusData} />
            {showWeekday && <WeekdayCard data={weekdayData} />}
          </div>
        </div>
      </Section>

      <Section
        title="予約とお客様の動き"
        description="予約の入り方と、やり取りしたお客様の数"
        tourId="dashboard.section-bookings"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TrendCard
            title="ユーザー数の推移"
            icon={Users}
            points={userTrend}
            window={trendWindow}
            unit="人"
            seriesName="ユーザー数"
            showTotal={false}
          />
          <TrendCard
            title="予約数の推移"
            icon={Calendar}
            points={reservationTrend}
            window={trendWindow}
            unit="件"
            seriesName="予約数"
            markEnd={false}
          />
          <RankedBarsCard
            title="メニュー別の予約数"
            icon={ListOrdered}
            description="人気のメニュー（上位10件）"
            rows={menuData}
            unit="件"
          />
          <RankedBarsCard
            title="担当者別の予約数"
            icon={User}
            description="予約の多い担当者（上位10件）"
            rows={staffData}
            unit="件"
          />
        </div>
      </Section>
    </div>
  )
}
