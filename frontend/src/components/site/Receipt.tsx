import type { ReactNode } from 'react'

// 数字（時刻・日付・金額・ポイント）のかたまり。記号と単位の pt も数字と同じ書体にそろえる
const NUMBER_RUN = /([+\-−¥]?\d[\d,.:/]*(?:\s?pt)?)/

/** 文字列の中の数字だけを、レシートの数字の書体（font-slip）で組む。文字列以外はそのまま出す */
export function SlipNumbers({ children }: { children: ReactNode }) {
  if (typeof children !== 'string') return <>{children}</>
  const parts = children.split(NUMBER_RUN)
  if (parts.length === 1) return <>{children}</>
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="font-slip">
        {part}
      </span>
    ) : (
      part
    ),
  )
}

/**
 * レジ横の伝票。公開ページ全体で使う紙の器。
 * 上下の縁は index.css の .slip がギザギザに切る。影は mask で消えるので外側の .slip-shadow で付ける。
 */
export function Slip({
  children,
  className = '',
  edge = 'both',
}: {
  children: ReactNode
  className?: string
  /** both: 上下とも切り取り。bottom: 下だけ（印字ヘッドから出てくる伝票） */
  edge?: 'both' | 'bottom'
}) {
  return (
    <div className="slip-shadow">
      <div className={`slip ${edge === 'bottom' ? 'slip-open-top' : ''} px-5 sm:px-6 ${className}`}>{children}</div>
    </div>
  )
}

/** 伝票の頭。店名のように中央に置く */
export function SlipHead({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="text-center mb-3">
      <p className="font-bold text-[15px] tracking-wide">{title}</p>
      {sub && <p className="font-slip text-xs text-ink-soft mt-1">{sub}</p>}
      <div className="slip-rule mt-3" />
    </div>
  )
}

/** 品目と値段のように、左右を点線でつなぐ行 */
export function LeaderRow({ label, value, strong = false }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-end gap-2 py-1.5 ${strong ? 'font-bold' : ''}`}>
      <span className="shrink-0">{label}</span>
      <span className="slip-leader" aria-hidden="true" />
      <span className="shrink-0 font-slip">{value}</span>
    </div>
  )
}

/** ゴム印（特典・おすすめなど） */
export function Stamp({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`stamp ${className}`}>{children}</span>
}

/** 時刻つきの記録行 */
export function LogRow({ time, children, stamp }: { time: string; children: ReactNode; stamp?: ReactNode }) {
  return (
    <div className="grid grid-cols-[3.4rem_1fr_auto] items-start gap-2 py-2">
      <time className="font-slip text-[13px] text-ink-soft pt-px">{time}</time>
      <span className="text-[14px] leading-snug">{children}</span>
      {stamp ? <span className="pt-0.5">{stamp}</span> : <span />}
    </div>
  )
}
