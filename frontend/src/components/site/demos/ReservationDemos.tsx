import { AnimatePresence, motion } from 'framer-motion'
import BookingScreenPreview, { type BookingPreviewScreen } from '../../booking/BookingScreenPreview'
import { PhoneFrame } from '../LinePhone'
import { useAutoStep } from './useAutoStep'

const FLOW: { screen: BookingPreviewScreen; label: string }[] = [
  { screen: 'staff', label: '担当' },
  { screen: 'menu', label: 'メニュー' },
  { screen: 'date', label: '日時' },
  { screen: 'confirm', label: '確認' },
  { screen: 'complete', label: '完了' },
]

/** お客様が予約ページで進む順番を、実際の予約ページの部品で再生する */
export function BookingFlowPhone({ themeId = 'simple' }: { themeId?: string }) {
  const { ref, index, select } = useAutoStep(FLOW.length, 2600, 2)
  const current = FLOW[index]

  return (
    <div ref={ref} className="mx-auto flex w-fit flex-col items-center gap-5">
      <PhoneFrame className="w-[17.5rem] sm:w-[18.5rem]">
        <div className="h-[33rem] overflow-hidden pt-7">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.screen}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="w-[133.4%] origin-top-left scale-75">
                <BookingScreenPreview themeId={themeId} color="#00c3dc" screen={current.screen} />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </PhoneFrame>

      <ol className="flex items-center gap-1 rounded-full bg-white/80 p-1 shadow-[0_0_0_1px_var(--color-rule)]" aria-label="予約の手順">
        {FLOW.map((f, i) => (
          <li key={f.screen}>
            <button
              type="button"
              onClick={() => select(i)}
              aria-current={i === index ? 'step' : undefined}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                i === index ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

const DAYS = [
  { label: '9/29', dow: '月' },
  { label: '9/30', dow: '火', closed: true },
  { label: '10/1', dow: '水' },
  { label: '10/2', dow: '木' },
  { label: '10/3', dow: '金' },
  { label: '10/4', dow: '土' },
]
const COLS = 'grid-cols-[2.6rem_repeat(4,minmax(0,1fr))] @[30rem]:grid-cols-[3rem_repeat(6,minmax(0,1fr))]'
const HOURS = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']
// [曜日の列, 開始の行, 長さ(時間), 名前, メニュー]
const BLOCKS: [number, number, number, string, string][] = [
  [0, 0, 1, '山田', 'カット'],
  [0, 3, 2, '高橋', 'カラー'],
  [2, 1, 1.5, '佐藤', 'カラー'],
  [2, 5, 1, '鈴木', 'カット'],
  [3, 0, 1, '山田', 'カット'],
  [3, 4, 2, '田中', 'パーマ'],
  [4, 2, 1, '伊藤', 'カット'],
  [5, 0, 1, '渡辺', 'カット'],
  [5, 1, 2, '小林', 'カラー'],
  [5, 4, 1.5, '加藤', 'トリートメント'],
]

/** 管理画面のカレンダー表示（週）を縮めたもの。Proプランの機能 */
export function WeekCalendarMini() {
  // 1時間の高さ。1時間の予約でも、名前とメニューの2行が枠に収まる高さにする
  const rowH = 2.75 // rem
  return (
    <div className="p-4 text-gray-800">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[14px] font-bold">予約カレンダー</p>
        <span className="rounded bg-green-100 px-2 py-0.5 text-[10.5px] font-bold text-green-700">Googleカレンダー連携中</span>
      </div>
      {/* 枠が狭いとき（スマホ）は月〜木の4日分だけを出し、横にはみ出さないようにする */}
      <div className="@container">
        <div className={`grid text-[11px] ${COLS}`}>
          <span />
          {DAYS.map((d, i) => (
            <span key={d.label} className={`border-b border-gray-200 pb-1.5 text-center ${i >= 4 ? 'hidden @[30rem]:block' : ''}`}>
              <span className="block text-gray-400">{d.label}</span>
              <span className="font-bold">{d.dow}</span>
            </span>
          ))}
          <div className={`relative col-span-full grid ${COLS}`}>
            <div>
              {HOURS.map((h) => (
                <div key={h} className="pr-1.5 pt-0.5 text-right text-[10px] text-gray-400" style={{ height: `${rowH}rem` }}>
                  {h}
                </div>
              ))}
            </div>
            {DAYS.map((d, col) => (
              <div key={d.label} className={`relative border-l border-gray-100 ${d.closed ? 'bg-gray-50' : ''} ${col >= 4 ? 'hidden @[30rem]:block' : ''}`}>
                {HOURS.map((h) => (
                  <div key={h} className="border-b border-gray-100" style={{ height: `${rowH}rem` }} />
                ))}
                {d.closed && <span className="absolute inset-x-0 top-1/2 text-center text-[10px] text-gray-400">定休日</span>}
                {BLOCKS.filter((b) => b[0] === col).map(([, start, len, name, menu]) => (
                  <div
                    key={`${name}-${start}`}
                    className="absolute inset-x-0.5 overflow-hidden rounded-md border border-primary-300 bg-primary-50 px-1.5 py-1"
                    style={{ top: `${start * rowH + 0.1}rem`, height: `${len * rowH - 0.2}rem` }}
                  >
                    <p className="truncate text-[10.5px] font-bold text-primary-900">{name}</p>
                    <p className="truncate text-[10px] text-primary-800">{menu}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
