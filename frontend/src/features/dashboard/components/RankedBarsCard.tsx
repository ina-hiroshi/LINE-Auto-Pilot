import type { ComponentType } from 'react'
import type { NameCountPoint } from '../../../lib/dashboardGraphs'
import { ChartCard, EmptyChart } from './ChartCard'
import { CHART_COLORS } from './chartTheme'

type RankedBarsCardProps = {
  title: string
  icon: ComponentType<{ size?: number; className?: string }>
  description?: string
  rows: NameCountPoint[]
  unit: string
  className?: string
}

/**
 * 件数の多い順のランキング。名前を棒の上に置くので、長いメニュー名でも切れない。
 * 棒は1色で、長さだけで大小を比べる。
 */
export function RankedBarsCard({ title, icon, description, rows, unit, className }: RankedBarsCardProps) {
  const max = Math.max(1, ...rows.map((r) => r.count))

  return (
    <ChartCard className={className} title={title} icon={icon} description={description}>
      {rows.length === 0 ? (
        <EmptyChart message="この期間の予約はありません" />
      ) : (
        <ol className="space-y-3">
          {rows.map((r, i) => (
            <li key={r.name}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-baseline gap-2 text-gray-700">
                  <span className="w-4 shrink-0 text-right text-xs tabular-nums text-gray-400">{i + 1}</span>
                  <span className="truncate" title={r.name}>
                    {r.name}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-gray-900">
                  {r.count.toLocaleString()}
                  <span className="ml-0.5 text-xs font-normal text-gray-400">{unit}</span>
                </span>
              </div>
              <div className="ml-6 mt-1.5 h-2 bg-gray-100">
                <div
                  className="h-full rounded-r-[4px]"
                  style={{ width: `${(r.count / max) * 100}%`, minWidth: 4, backgroundColor: CHART_COLORS.series }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </ChartCard>
  )
}
