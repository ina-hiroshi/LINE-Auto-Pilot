import type { CSSProperties } from 'react'
import type { LogoLayout } from '../../lib/bookingLogoLayout'

/**
 * 予約画面の上部（店舗のロゴ/アイコンと画面名）。配置は店舗が選ぶ（LogoLayout）。
 *
 * ロゴは切り抜かず・引き伸ばさず（object-contain、拡大なし）、
 * 正方形のアイコンも横長・縦長のロゴも枠の中にそのまま収める。
 * ロゴが無いときは、従来どおり「予約フォーム」の見出しだけを出す。
 *
 * 現行テーマ（Booking.tsx のインライン定義）と新テーマ（bookingTheme.ts）の
 * どちらでも使えるよう、色はテーマ側のクラス名を受け取って当てる。
 * summaryLabel を補足文字、summaryValue を強調文字として流用する（どちらのテーマにも存在する）。
 */
export interface HeaderTheme {
  header: string
  title: string
  headerStyle?: CSSProperties
  titleStyle?: CSSProperties
  summaryLabel: string
  summaryValue: string
}

type Props = {
  theme: HeaderTheme
  logoUrl?: string
  storeName?: string
  layout?: LogoLayout
}

export default function BookingHeader({ theme, logoUrl, storeName, layout = 'center' }: Props) {
  if (!logoUrl) {
    return (
      <div className={theme.header} style={theme.headerStyle}>
        <h1 className={theme.title} style={theme.titleStyle}>予約フォーム</h1>
      </div>
    )
  }

  const alt = storeName ? `${storeName}のロゴ` : 'ロゴ'

  if (layout === 'inline') {
    return (
      <div className={theme.header} style={theme.headerStyle}>
        <div className="flex items-center gap-4 text-left">
          <img src={logoUrl} alt={alt} className="block shrink-0 w-auto h-auto max-h-14 max-w-[48%] object-contain" />
          <div className="min-w-0">
            {storeName && <p className={`text-base truncate ${theme.summaryValue}`}>{storeName}</p>}
            <h1 className={`text-xs mt-0.5 ${theme.summaryLabel}`}>予約フォーム</h1>
          </div>
        </div>
      </div>
    )
  }

  if (layout === 'banner') {
    return (
      <div className={theme.header} style={theme.headerStyle}>
        <img src={logoUrl} alt={alt} className="block mx-auto w-auto h-auto max-h-28 max-w-full object-contain" />
        <h1 className="sr-only">予約フォーム</h1>
      </div>
    )
  }

  return (
    <div className={theme.header} style={theme.headerStyle}>
      <img src={logoUrl} alt={alt} className="block mx-auto w-auto h-auto max-h-20 max-w-[70%] object-contain" />
      <h1 className={`mt-3 text-xs tracking-[0.12em] ${theme.summaryLabel}`}>予約フォーム</h1>
    </div>
  )
}
