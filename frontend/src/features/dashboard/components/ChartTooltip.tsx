import { CHART_COLORS } from './chartTheme'

type TooltipPayloadItem = {
  value?: unknown
  payload?: { fullLabel?: string; day?: string; label?: string }
}

type ChartTooltipProps = {
  /** 系列名（例: メッセージ数） */
  seriesName: string
  /** 単位（例: 件, 人） */
  unit: string
  // Recharts が Tooltip の content に注入する
  active?: boolean
  payload?: readonly TooltipPayloadItem[]
  label?: string | number
}

/** グラフ共通のツールチップ。5か所にコピペされていたものを1つにまとめた */
export function ChartTooltip({ seriesName, unit, active, payload, label }: ChartTooltipProps) {
  const item = payload?.[0]
  if (!active || !item || typeof item.value !== 'number') return null

  const title = item.payload?.fullLabel ?? item.payload?.day ?? label

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-gray-900">{title}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-600">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: CHART_COLORS.series }}
        />
        {seriesName}
        <span className="ml-1 font-semibold tabular-nums text-gray-900">
          {item.value.toLocaleString()}
          {unit}
        </span>
      </p>
    </div>
  )
}
