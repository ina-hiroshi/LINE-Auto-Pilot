/**
 * ダッシュボードのグラフで共通の色とスタイル。
 * 単一系列のグラフはブランド色（primary-600）1色、脇役はグレーにする。
 */
export const CHART_COLORS = {
  /** 主役の色。サイドバーの primary-600 と同じ */
  series: '#00a3b8',
  /** 強調しない側のマーク（曜日別グラフの最多以外など） */
  muted: '#cfd6dd',
  /** 折れ線グラフの終点ラベル・ツールチップの文字 */
  text: '#374151',
  /** 軸の目盛り */
  axisText: '#6b7280',
  /** 罫線（実線の細線で目立たせない） */
  grid: '#eceff1',
  /** 軸線（ベースライン） */
  axisLine: '#d5dae0',
  /** マークの縁取り（カード背景と同じ白） */
  surface: '#ffffff',
} as const

export const AXIS_TICK = { fontSize: 11, fill: CHART_COLORS.axisText } as const
