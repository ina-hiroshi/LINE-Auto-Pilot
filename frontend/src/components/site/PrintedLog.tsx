import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { SlipNumbers } from './Receipt'

export type LogLine = {
  id: string
  time: string
  /** 品目にあたる行。何が起きたか */
  text: ReactNode
  /** 金額の位置に右寄せで印字する結果（「自動で返信」「+100 pt」など） */
  result?: ReactNode
  /** 区切りの見出し（「営業前」など）。前の行と変わったところで印字する */
  section?: string
}

// 紙送りの時間。行の送り出しと、前の行・紙の下端の移動を同じ速さにそろえ、紙が一枚で動いて見えるようにする。
// 下にしか動かないよう、行き過ぎて戻る動き（ばね）は使わない
const FEED_MS = 900
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

/**
 * 印字した行の並び。新しい行が入ると、紙全体をその行の高さぶん排出口から下へ送り出す。
 * 新しい行は排出口の中（枠の上端より上）から現れ、前の行と紙の下端も同じ速さで下へ動く。上には動かない。
 */
function FeedList({ lines, maxListHeight, flushTop }: { lines: LogLine[]; maxListHeight?: string; flushTop: boolean }) {
  const reduce = useReducedMotion()
  const boxRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  // 前回までに印字済みの行。新しく増えた行の高さだけを送り出す量にする（フォントの読み込みで高さが変わっても狂わない）
  const printed = useRef<Set<string> | null>(null)
  // 紙が枠の高さを超えたときだけ、下端をぼかす（行が少ないうちは最後の行まではっきり見せる）
  const [overflowing, setOverflowing] = useState(false)

  useLayoutEffect(() => {
    const box = boxRef.current
    const list = listRef.current
    if (!maxListHeight || !box || !list) return
    setOverflowing(list.scrollHeight > parseFloat(getComputedStyle(box).maxHeight))
  }, [lines, maxListHeight])

  useLayoutEffect(() => {
    const box = boxRef.current
    const list = listRef.current
    if (!box || !list) return
    const rows = [...list.querySelectorAll<HTMLElement>(':scope > li[data-feed]')]
    const before = printed.current
    printed.current = new Set(rows.map((r) => r.dataset.feed!))
    if (!before || reduce) return
    const delta = rows.filter((r) => !before.has(r.dataset.feed!)).reduce((sum, r) => sum + r.getBoundingClientRect().height, 0)
    if (delta <= 0) return
    const prev = box.getBoundingClientRect().height - delta
    // 開始の位置（中身は増えた高さぶん上＝排出口の中、紙の下端は元の位置）を描画の前に当て、
    // そこから毎フレーム自分で動かす。どのフレームでも、行と紙の下端は下にしか動かない
    const setFrame = (p: number) => {
      list.style.transform = p >= 1 ? '' : `translateY(${-delta * (1 - p)}px)`
      box.style.height = p >= 1 ? '' : `${prev + delta * p}px`
    }
    setFrame(0)
    const started = performance.now()
    let raf = requestAnimationFrame(function step(now) {
      // rAF の時刻は開始より少し前のことがあるので、0未満にしない（上に動いてしまう）
      const t = Math.min(1, Math.max(0, (now - started) / FEED_MS))
      setFrame(easeOutCubic(t))
      if (t < 1) raf = requestAnimationFrame(step)
    })
    return () => {
      cancelAnimationFrame(raf)
      setFrame(1)
    }
  }, [lines, reduce])

  return (
    <div ref={boxRef} className="relative overflow-hidden" style={maxListHeight ? { maxHeight: maxListHeight } : undefined}>
      <ol ref={listRef} className={flushTop ? 'pt-5' : ''}>
        {lines.map((line, i) => {
          const older = lines[i + 1]
          // 区切りは、その時間帯の最初の行より前（＝下）に印字されている
          const sectionStartsHere = line.section && line.section !== older?.section
          return [
            <li key={line.id} data-feed={line.id} className="py-2">
              <div className="flex items-baseline gap-2.5">
                <time className="shrink-0 font-slip text-[13px] font-semibold">{line.time}</time>
                <span className="text-[15px] font-medium leading-snug"><SlipNumbers>{line.text}</SlipNumbers></span>
              </div>
              {line.result && (
                <div className="mt-0.5 flex items-baseline gap-2 pl-[3.1rem]">
                  <span className="slip-leader" aria-hidden="true" />
                  <span className="shrink-0 text-[14px] font-bold text-primary-800"><SlipNumbers>{line.result}</SlipNumbers></span>
                </div>
              )}
            </li>,
            sectionStartsHere && (
              <li key={`section-${line.section}`} data-feed={`section-${line.section}`} className="flex items-center gap-2 pb-2 pt-1">
                <span className="h-px flex-1 bg-ink/30" aria-hidden="true" />
                <span className="shrink-0 text-[13px] font-bold">▲ <SlipNumbers>{line.section}</SlipNumbers></span>
                <span className="h-px flex-1 bg-ink/30" aria-hidden="true" />
              </li>
            ),
          ]
        })}
      </ol>
      {overflowing && <span className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-paper to-transparent" aria-hidden="true" />}
    </div>
  )
}

/**
 * レジのプリンターから、レシートが出てくる表示。
 * 新しい行ほど上（排出口の近く）に印字され、前の行は下へ送られる。
 */
export default function PrintedLog({
  title,
  sub,
  meta,
  lines,
  printing = false,
  total,
  footer,
  status,
  statusTone = 'normal',
  sheetKey = 0,
  maxListHeight,
  className = '',
}: {
  /** レシートの先頭に出す見出し。トップの最初の画面では出さない */
  title?: ReactNode
  sub?: ReactNode
  /** 日付などの印字（等幅） */
  meta?: ReactNode
  lines: LogLine[]
  printing?: boolean
  /** 合計の位置に出す行 */
  total?: { label: ReactNode; value: ReactNode }
  footer?: ReactNode
  /** レジの表示窓に出す文字。省くと「印字中」「待機中」 */
  status?: ReactNode
  /** 表示窓の文字とランプの色。alert は赤（営業時間の外など） */
  statusTone?: 'normal' | 'alert'
  /** 変わると、それまでのレシートを切り取って下へ落とし、新しい紙から印字し直す */
  sheetKey?: string | number
  /** 指定すると、この高さより下は紙が隠れる（古い行を消さずに下へ送り出すため） */
  maxListHeight?: string
  className?: string
}) {
  return (
    <div className={className}>
      {/* レジのプリンター。上に小さな表示窓、手前に紙の排出口 */}
      <div className="relative z-10 rounded-t-2xl rounded-b-lg bg-ink px-4 pb-3 pt-3 shadow-[0_10px_18px_-8px_rgb(28_42_48/0.5)]">
        <div className="flex items-center justify-between gap-3">
          {/* テンキー */}
          <span className="grid grid-cols-3 gap-[3px]" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="h-[7px] w-[11px] rounded-[2px] bg-paper/25" />
            ))}
          </span>
          {/* 表示窓 */}
          <span className="flex min-w-[6.5rem] items-center justify-end gap-1.5 rounded-md bg-[#0d1619] px-2.5 py-1.5">
            <motion.span
              className={`size-2 rounded-full ${statusTone === 'alert' ? 'bg-[#ff7a6b]' : 'bg-primary-400'}`}
              animate={printing ? { opacity: [1, 0.25, 1] } : { opacity: 0.4 }}
              transition={printing ? { duration: 0.7, repeat: Infinity } : undefined}
              aria-hidden="true"
            />
            <span className={`font-slip text-[12px] font-semibold ${statusTone === 'alert' ? 'text-[#ff7a6b]' : 'text-primary-300'}`}>{status ?? (printing ? '印字中' : '待機中')}</span>
          </span>
        </div>
        {/* 排出口 */}
        <div className="mt-3 h-2.5 rounded-full bg-[#070d0f] shadow-[inset_0_2px_3px_rgb(0_0_0/0.6)]" aria-hidden="true" />
      </div>

      {/* 排出口から垂れ下がるレシート */}
      <div className="slip-shadow relative z-0 -mt-[7px] px-3">
        <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={sheetKey}
          className={`slip slip-open-top px-4 pb-6 sm:px-5 ${title ? 'pt-5' : '!pt-0'}`}
          exit={{ y: 160, opacity: 0, transition: { duration: 0.7, ease: [0.55, 0, 1, 0.45] } }}
        >
          {/* 排出口から出たばかりの紙の影 */}
          <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-gradient-to-b from-ink/20 to-transparent" aria-hidden="true" />
          {title && (
            <>
              <div className="text-center">
                <p className="text-[16px] font-black"><SlipNumbers>{title}</SlipNumbers></p>
                {sub && <p className="mt-0.5 text-[13px] text-ink-soft"><SlipNumbers>{sub}</SlipNumbers></p>}
                {meta && <p className="mt-1.5 font-slip text-[12px] text-ink-soft">{meta}</p>}
              </div>
              <div className="slip-rule my-3" />
            </>
          )}
          <FeedList lines={lines} maxListHeight={maxListHeight} flushTop={!title} />
          {total && (
            <>
              <div className="slip-rule my-3" />
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-bold"><SlipNumbers>{total.label}</SlipNumbers></span>
                <span className="font-slip text-[22px] font-bold tracking-tight">{total.value}</span>
              </div>
            </>
          )}
          {footer && (
            <>
              <div className="slip-rule my-3" />
              <p className="text-center text-[13px] text-ink-soft"><SlipNumbers>{footer}</SlipNumbers></p>
            </>
          )}
        </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
