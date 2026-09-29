import type { ComponentType } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { summarizeTrend, type TrendPoint, type TrendWindow } from '../../../lib/dashboardGraphs'
import { ChartCard, EmptyChart } from './ChartCard'
import { ChartTooltip } from './ChartTooltip'
import { AXIS_TICK, CHART_COLORS } from './chartTheme'

type TrendCardProps = {
  title: string
  icon: ComponentType<{ size?: number; className?: string }>
  points: TrendPoint[]
  window: TrendWindow
  /** 単位（件, 人） */
  unit: string
  /** ツールチップに出す系列名 */
  seriesName: string
  /** false のとき「合計」を出さない（ユニーク人数は日をまたぐと足せないため） */
  showTotal?: boolean
  /** false のとき、終点の丸と値を出さない（未来の予定を含む予約では「終点」が今日ではないため） */
  markEnd?: boolean
  className?: string
}

/** 期間に沿った推移。単一系列なので凡例は置かず、タイトルと要約で何のグラフかを伝える */
export function TrendCard({
  title,
  icon,
  points,
  window,
  unit,
  seriesName,
  showTotal = true,
  markEnd = true,
  className,
}: TrendCardProps) {
  const summary = summarizeTrend(points)
  const lastObserved = [...points].reverse().find((p) => p.count !== null)
  const hasData = summary.total > 0

  const stats = [
    ...(showTotal ? [{ label: '合計', value: `${summary.total.toLocaleString()}${unit}` }] : []),
    { label: `平均（${window.unitLabel}）`, value: `${summary.average.toLocaleString()}${unit}` },
    ...(summary.peak ? [{ label: 'ピーク', value: `${summary.peak.label}・${summary.peak.count}${unit}` }] : []),
  ]

  const ariaLabel = hasData
    ? `${title}。${window.description}。${showTotal ? `合計${summary.total}${unit}、` : ''}${
        summary.peak ? `最多は${summary.peak.fullLabel}の${summary.peak.count}${unit}` : ''
      }`
    : `${title}。${window.description}。データなし`

  return (
    <ChartCard
      className={className}
      title={title}
      icon={icon}
      description={window.description}
      stats={hasData ? stats : undefined}
      table={
        hasData
          ? {
              headers: [window.granularity === 'hour' ? '時間帯' : '日付', seriesName],
              rows: points.map((p) => [p.fullLabel, p.count === null ? '-' : `${p.count}${unit}`]),
            }
          : undefined
      }
    >
      <div className="h-56" role="img" aria-label={ariaLabel}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 20, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: CHART_COLORS.axisLine }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                width={36}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tickCount={4}
                domain={[0, 'auto']}
              />
              <Tooltip
                content={<ChartTooltip seriesName={seriesName} unit={unit} />}
                cursor={{ stroke: CHART_COLORS.axisLine, strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke={CHART_COLORS.series}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={CHART_COLORS.series}
                fillOpacity={0.1}
                dot={false}
                isAnimationActive={false}
                activeDot={{ r: 4, fill: CHART_COLORS.series, stroke: CHART_COLORS.surface, strokeWidth: 2 }}
              />
              {markEnd && lastObserved && lastObserved.count !== null && (
                <ReferenceDot
                  x={lastObserved.label}
                  y={lastObserved.count}
                  r={4}
                  fill={CHART_COLORS.series}
                  stroke={CHART_COLORS.surface}
                  strokeWidth={2}
                  ifOverflow="visible"
                  // 0件の終点に「0件」と出しても情報が増えないので、丸だけにする
                  label={
                    lastObserved.count > 0
                      ? {
                          value: `${lastObserved.count}${unit}`,
                          position: 'top',
                          fontSize: 11,
                          fontWeight: 600,
                          fill: CHART_COLORS.text,
                        }
                      : undefined
                  }
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </div>
    </ChartCard>
  )
}
