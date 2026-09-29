import type { ComponentType, ReactNode } from 'react'

export type ChartTable = {
  headers: string[]
  rows: (string | number)[][]
}

export type ChartStat = { label: string; value: string }

type ChartCardProps = {
  title: string
  icon: ComponentType<{ size?: number; className?: string }>
  /** タイトル下の説明（対象期間や単位） */
  description?: string
  /** タイトル右の要約（合計・平均・ピークなど） */
  stats?: ChartStat[]
  /** グラフの数値を表で見るための元データ */
  table?: ChartTable
  className?: string
  children: ReactNode
}

/** グラフを載せるカードの共通の枠。見た目を1か所にそろえる */
export function ChartCard({ title, icon: Icon, description, stats, table, className = '', children }: ChartCardProps) {
  return (
    <section className={`flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 sm:p-5 ${className}`}>
      <header className="mb-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <Icon size={16} className="shrink-0 text-gray-400" />
          {title}
        </h3>
        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
        {stats && stats.length > 0 && (
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-[11px] text-gray-500">{s.label}</dt>
                <dd className="text-lg font-bold leading-tight text-gray-900">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      <div className="min-h-0 flex-1">{children}</div>

      {table && (
        <details className="group mt-3 border-t border-gray-100 pt-2">
          <summary className="cursor-pointer select-none text-xs text-gray-500 hover:text-gray-700">
            数値を表で見る
          </summary>
          <div className="mt-2 max-h-48 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500">
                  {table.headers.map((h, i) => (
                    <th key={h} scope="col" className={`py-1 font-medium ${i > 0 ? 'text-right' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {table.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c} className={`py-1 ${c > 0 ? 'text-right tabular-nums' : ''}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  )
}

/** データが無いときの表示。空のグラフ（平らな線）ではなく理由を言葉で示す */
export function EmptyChart({ message = 'この期間のデータはありません' }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[10rem] items-center justify-center rounded-lg bg-gray-50 px-4 text-center text-sm text-gray-400">
      {message}
    </div>
  )
}
