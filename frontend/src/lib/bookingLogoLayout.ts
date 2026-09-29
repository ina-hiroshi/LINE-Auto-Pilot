/**
 * 予約ページ上部の、店舗ロゴ/アイコンの配置（stores.liff_logo_layout）。
 * - center: ロゴを中央に置き、下に「予約フォーム」を小さく添える
 * - inline: 左にロゴ、右に店名と「予約フォーム」を横並び。縦幅を節約できる
 * - banner: 横長ロゴを幅いっぱいに見せる。以前の全幅表示に近い
 */
export type LogoLayout = 'center' | 'inline' | 'banner'

export const DEFAULT_LOGO_LAYOUT: LogoLayout = 'center'

export const LOGO_LAYOUTS: { id: LogoLayout; label: string; hint: string }[] = [
  { id: 'center', label: '中央', hint: '正方形・横長どちらにも合います' },
  { id: 'inline', label: '横並び', hint: '正方形のアイコンや店名と並べたいときに' },
  { id: 'banner', label: 'バナー', hint: '横長のロゴを大きく見せたいときに' },
]

/** DB や postMessage 由来の値を、未知の値なら初期値に丸めて返す */
export function normalizeLogoLayout(value: unknown): LogoLayout {
  return LOGO_LAYOUTS.some((l) => l.id === value) ? (value as LogoLayout) : DEFAULT_LOGO_LAYOUT
}
