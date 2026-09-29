import { AlertCircle, PieChart } from 'lucide-react'
import type { StatusPoint } from '../../../lib/dashboardGraphs'
import { ChartCard, EmptyChart } from './ChartCard'

const NEEDS_ACTION = '要対応'

/**
 * 応答ステータスの内訳。ドーナツは色の見分けと角度の比較が難しいので、
 * 100%の積み上げバー（全体の割合）＋件数つきの一覧（正確な数）に分けて見せる。
 */
export function StatusCard({ data, className }: { data: StatusPoint[]; className?: string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const percent = (value: number) => (total === 0 ? 0 : Math.round((value / total) * 100))

  return (
    <ChartCard
      className={className}
      title="応答ステータスの内訳"
      icon={PieChart}
      description="選択した期間のメッセージが、どう処理されたか"
      stats={total > 0 ? [{ label: '合計', value: `${total.toLocaleString()}件` }] : undefined}
    >
      {total === 0 ? (
        <EmptyChart />
      ) : (
        <div>
          <div
            role="img"
            aria-label={`応答ステータスの内訳。${data.map((d) => `${d.name}${d.value}件（${percent(d.value)}%）`).join('、')}`}
            className="flex h-3 gap-0.5 overflow-hidden rounded-[4px]"
          >
            {data.map((d) => (
              <div key={d.name} title={`${d.name} ${d.value}件`} style={{ flexGrow: d.value, flexBasis: 0, minWidth: 4, backgroundColor: d.color }} />
            ))}
          </div>

          <ul className="mt-4 divide-y divide-gray-100">
            {data.map((d) => (
              <li key={d.name} className="flex items-center gap-3 py-2 text-sm">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="flex min-w-0 flex-1 items-center gap-1 text-gray-700">
                  <span className="truncate">{d.name}</span>
                  {d.name === NEEDS_ACTION && <AlertCircle size={14} className="shrink-0 text-red-600" aria-hidden />}
                </span>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-gray-500">{percent(d.value)}%</span>
                <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-gray-900">
                  {d.value.toLocaleString()}
                  <span className="ml-0.5 text-xs font-normal text-gray-400">件</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  )
}
