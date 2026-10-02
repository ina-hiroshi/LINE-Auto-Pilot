import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarCheck, ChevronLeft, CreditCard, Globe, Menu, MessageCircle } from 'lucide-react'

export type ChatMessage = {
  id: string
  from: 'customer' | 'shop'
  body: ReactNode
  /** 送信した時刻。LINEと同じく吹き出しの横に小さく出す */
  time?: string
}

export type RichMenuSlot = 'booking' | 'inquiry' | 'card' | 'web'

/** スマホの外枠。中身は自由に入れられる。time を渡すと、ノッチの右に時計を出す */
export function PhoneFrame({ children, className = '', time }: { children: ReactNode; className?: string; time?: string }) {
  return (
    <div className={`rounded-[2.6rem] bg-ink p-2.5 shadow-[0_24px_48px_-12px_rgb(28_42_48/0.35)] ${className}`}>
      <div className="ui-real relative overflow-hidden rounded-[2.05rem] bg-white">
        <div className="absolute left-1/2 top-2 z-20 h-5 w-[34%] -translate-x-1/2 rounded-full bg-ink" aria-hidden="true" />
        {time && (
          <span className="absolute right-[9%] top-2 z-20 flex h-5 items-center text-[12px] font-semibold tabular-nums text-[#111]" style={{ fontFamily: '"Hiragino Sans", "Helvetica Neue", sans-serif' }}>
            {time}
          </span>
        )}
        {children}
      </div>
    </div>
  )
}

/**
 * LINEのトーク画面。デモ用LINE公式アカウント（@431cghfd）の実際のリッチメニュー
 * （予約する／問い合わせ／会員証／ウェブサイト）と同じ並びにしている。
 */
export function LineTalk({
  storeName = 'サロン IToguchi',
  messages,
  typing = false,
  pressed,
  height = 'h-[25rem]',
  showRichMenu = true,
  sheet,
}: {
  storeName?: string
  messages: ChatMessage[]
  typing?: boolean
  pressed?: RichMenuSlot | null
  height?: string
  showRichMenu?: boolean
  /** リッチメニューから開いたLIFF画面（予約ページ・会員証）。下からせり上がる */
  sheet?: ReactNode
}) {
  return (
    <div className="relative flex flex-col text-left" style={{ fontFamily: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif' }}>
      <div className="flex items-center gap-2 bg-[#f6f7f9] px-3 pb-2.5 pt-9 text-[#111]">
        <ChevronLeft className="size-5" aria-hidden="true" />
        <span className="flex-1 truncate text-[14px] font-bold">{storeName}</span>
        <Menu className="size-4 text-[#555]" aria-hidden="true" />
      </div>

      <div className={`${height} flex flex-col justify-end gap-2.5 overflow-hidden bg-[#8ea9c2] px-3 py-3`} aria-live="polite">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className={`flex items-end ${m.from === 'customer' ? 'justify-end gap-1' : 'justify-start gap-1.5'}`}
            >
              {m.from === 'shop' && <span className="mb-auto mt-0.5 size-7 shrink-0 rounded-full bg-white" aria-hidden="true" />}
              {m.from === 'customer' && m.time && <MessageTime time={m.time} />}
              {typeof m.body === 'string' ? (
                <p
                  className={`max-w-[78%] whitespace-pre-line rounded-2xl px-3 py-2 text-[12.5px] leading-[1.55] text-[#111] ${
                    m.from === 'customer' ? 'rounded-tr-md bg-[#8de06c]' : 'rounded-tl-md bg-white'
                  }`}
                >
                  {m.body}
                </p>
              ) : (
                m.body
              )}
              {m.from === 'shop' && m.time && <MessageTime time={m.time} />}
            </motion.div>
          ))}
          {typing && (
            <motion.div
              key="typing"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              className="flex justify-start gap-1.5"
              aria-label="返信を作成中"
            >
              <span className="mt-0.5 size-7 shrink-0 rounded-full bg-white" aria-hidden="true" />
              <span className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-white px-3 py-3">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="size-1.5 rounded-full bg-[#9aa4ad]"
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showRichMenu && <RichMenu pressed={pressed} />}

      <AnimatePresence>
        {sheet && (
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 34 }}
            className="absolute inset-x-0 bottom-0 top-8 z-10 overflow-hidden rounded-t-2xl bg-white shadow-[0_-8px_24px_rgb(0_0_0/0.18)]"
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[#d1d5db]" aria-hidden="true" />
            {sheet}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const SLOTS: { id: RichMenuSlot; label: string; icon: typeof CalendarCheck }[] = [
  { id: 'booking', label: '予約する', icon: CalendarCheck },
  { id: 'inquiry', label: '問い合わせ', icon: MessageCircle },
  { id: 'card', label: '会員証', icon: CreditCard },
  { id: 'web', label: 'ウェブサイト', icon: Globe },
]

/** 吹き出しの横の送信時刻 */
function MessageTime({ time }: { time: string }) {
  return <span className="shrink-0 pb-0.5 text-[9.5px] tabular-nums leading-none text-white/90">{time}</span>
}

export function RichMenu({ pressed }: { pressed?: RichMenuSlot | null }) {
  return (
    <div className="bg-white">
      <div className="flex justify-between border-y border-[#e5e7eb] bg-[#f6f7f9] px-4 py-1.5 text-[11px] text-[#666]">
        <span>メニュー ▾</span>
        <span>キーボード</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-[#e5e7eb]">
        {SLOTS.map((s) => {
          const Icon = s.icon
          const isPressed = pressed === s.id
          return (
            <div key={s.id} className="relative h-[4.6rem] overflow-hidden bg-[#effcfd]">
              <span className="relative flex h-full flex-col items-center justify-center gap-1 text-[11.5px] font-bold text-primary-800">
                <Icon className="size-[18px]" aria-hidden="true" />
                {s.label}
              </span>
              <AnimatePresence>
                {isPressed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/35 ring-4 ring-inset ring-primary-400"
                    aria-hidden="true"
                  />
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 予約が入ったときにお客様のトークに届く確認メッセージ。
 * supabase/functions/_shared/reservation-flex.ts（シンプルテーマ）と同じ構成。
 */
export function ReservationFlex({
  storeName = 'サロン IToguchi',
  date,
  time,
  menu,
  staff,
}: {
  storeName?: string
  date: string
  time: string
  menu?: string
  staff?: string
}) {
  const rows: [string, string][] = [['日時', `${date}\n${time}`]]
  if (menu) rows.push(['メニュー', menu])
  if (staff) rows.push(['担当', staff])
  return (
    <div className="w-[78%] overflow-hidden rounded-2xl bg-white text-[#374151] shadow-sm">
      <div className="px-4 pb-2 pt-3 text-center">
        <p className="text-[10.5px] text-[#6b7280]">{storeName}</p>
        <p className="mt-0.5 text-[14px] font-bold text-[#1f2937]">ご予約を受け付けました</p>
      </div>
      <div className="space-y-1.5 border-t border-[#f3f4f6] px-4 py-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[3.4rem_1fr] text-[11px]">
            <span className="text-[#6b7280]">{label}</span>
            <span className="whitespace-pre-line">{value}</span>
          </div>
        ))}
      </div>
      <div className="px-3 pb-3">
        <span className="block rounded-lg bg-primary-500 py-2 text-center text-[11.5px] font-bold text-white">予約の確認・変更</span>
      </div>
    </div>
  )
}
