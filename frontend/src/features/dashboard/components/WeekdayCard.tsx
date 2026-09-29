import { BarChart3 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { findPeakWeekdays, type WeekdayPoint } from '../../../lib/dashboardGraphs'
import { ChartCard, EmptyChart } from './ChartCard'
import { ChartTooltip } from './ChartTooltip'
import { AXIS_TICK, CHART_COLORS } from './chartTheme'

type LabelContentProps = { x?: number | string; y?: number | string; width?: number | string; value?: unknown; index?: number }

/** 曜日別のメッセージ数。最多の曜日だけブランド色で強調し、残りはグレーにする */
export function WeekdayCard({ data, className }: { data: WeekdayPoint[]; className?: string }) {
  const peakDays = findPeakWeekdays(data)
  const hasData = peakDays.length > 0
  const peakLabel = peakDays.join('・')
  const peakCount = hasData ? (data.find((d) => d.day === peakDays[0])?.count ?? 0) : 0

  return (
    <ChartCard
      className={className}
      title="曜日別メッセージ数"
      icon={BarChart3}
      description="選択した期間の合計を曜日ごとに集計"
      stats={hasData ? [{ label: '最も多い曜日', value: `${peakLabel}曜日・${peakCount}件` }] : undefined}
      table={hasData ? { headers: ['曜日', 'メッセージ数'], rows: data.map((d) => [`${d.day}曜日`, `${d.count}件`]) } : undefined}
    >
      <div
        className="h-48"
        role="img"
        aria-label={hasData ? `曜日別メッセージ数。最も多いのは${peakLabel}曜日の${peakCount}件` : '曜日別メッセージ数。データなし'}
      >
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 16, bottom: 0, left: -8 }} barCategoryGap="25%">
              <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ ...AXIS_TICK, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: CHART_COLORS.axisLine }}
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
                content={<ChartTooltip seriesName="メッセージ数" unit="件" />}
                cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
              />
              <Bar dataKey="count" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell key={d.day} fill={peakDays.includes(d.day) ? CHART_COLORS.series : CHART_COLORS.muted} />
                ))}
                <LabelList
                  dataKey="count"
                  content={(props: LabelContentProps) => {
                    const i = props.index ?? -1
                    if (i < 0 || !peakDays.includes(data[i]?.day)) return null
                    const x = Number(props.x) + Number(props.width) / 2
                    return (
                      <text x={x} y={Number(props.y) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={CHART_COLORS.text}>
                        {String(props.value)}件
                      </text>
                    )
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </div>
    </ChartCard>
  )
}
