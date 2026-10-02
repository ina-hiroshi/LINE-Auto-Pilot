import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'
import BookingScreenPreview from '../booking/BookingScreenPreview'
import { LineTalk, PhoneFrame, ReservationFlex, type ChatMessage, type RichMenuSlot } from './LinePhone'
import PrintedLog, { type LogLine } from './PrintedLog'
import { MemberCardPreview } from './MemberCards'

type DemoState = {
  /** 1日分を印字し終えるたびに増やす。レシートを切り取って新しい紙にする */
  day: number
  /** スマホの上に出す、いまの時刻 */
  clock: string
  messages: ChatMessage[]
  typing: boolean
  pressed: RichMenuSlot | null
  sheet: 'booking' | 'card' | null
  log: LogLine[]
}

const EMPTY: DemoState = { day: 0, clock: '07:00', messages: [], typing: false, pressed: null, sheet: null, log: [] }

const at = (clock: string) => (s: DemoState): DemoState => ({ ...s, clock })
const say = (id: string, from: ChatMessage['from'], body: ReactNode) => (s: DemoState): DemoState => ({
  ...s,
  typing: false,
  messages: [...s.messages, { id, from, body, time: s.clock }].slice(-6),
})
const typing = (s: DemoState): DemoState => ({ ...s, typing: true })
const press = (slot: RichMenuSlot | null) => (s: DemoState): DemoState => ({ ...s, pressed: slot })
const open = (sheet: DemoState['sheet']) => (s: DemoState): DemoState => ({ ...s, pressed: null, sheet })
// 新しい出来事ほど排出口の近く（いちばん上）に印字され、前の行は下へ送られる
const print = (line: LogLine) => (s: DemoState): DemoState => ({ ...s, log: [line, ...s.log] })

const BEFORE = '営業前（〜10:00）'
const OPEN = '営業中（10:00〜19:00）'
const AFTER = '営業後（19:00〜）'

// お店の1日に、LINEで起きることの例（サンプル）。営業時間は10:00〜19:00、定休日は火曜日。
// 自動応答は予約を受け付けず、リッチメニューの予約ページへ案内する（supabase/functions/_shared/ai-prompt.ts）。
const SCRIPT: [number, (s: DemoState) => DemoState][] = [
  // 営業前：予約ページから予約が入る
  [500, at('08:12')],
  [700, press('booking')],
  [450, open('booking')],
  [2400, open(null)],
  [500, say('f1', 'shop', <ReservationFlex date="10月1日（水）" time="14:00〜15:00" menu="カット" staff="田中" />)],
  [450, print({ id: 'l1', section: BEFORE, time: '08:12', text: '予約 本日 カット', result: '14:00で受付' })],
  // 営業前：営業時間の質問
  [2000, at('08:40')],
  [400, say('q1', 'customer', '今日は何時まで開いていますか？')],
  [600, typing],
  [1100, say('a1', 'shop', '営業時間は10:00〜19:00です。定休日は毎週火曜日です。')],
  [450, print({ id: 'l2', section: BEFORE, time: '08:40', text: '営業時間の質問', result: '自動で返信' })],
  // 営業中：施術中に届いた駐車場の質問
  [2000, at('11:20')],
  [400, say('q2', 'customer', '駐車場はありますか？')],
  [600, typing],
  [1100, say('a2', 'shop', '店舗前に2台分の駐車スペースがございます。お車でお越しの際はご利用ください。')],
  [450, print({ id: 'l3', section: OPEN, time: '11:20', text: '駐車場の質問', result: '自動で返信' })],
  // 営業中：お会計で会員証を見せてもらい、ポイントを付ける
  [2000, at('15:05')],
  [500, press('card')],
  [450, open('card')],
  [700, print({ id: 'l4', section: OPEN, time: '15:05', text: '会員証の読み取り', result: '来店 +100 pt' })],
  [2200, open(null)],
  // 営業中：次の予約の空き状況
  [1200, at('17:30')],
  [400, say('q3', 'customer', '明日の午後、カットの予約は空いていますか？')],
  [600, typing],
  [1200, say('a3', 'shop', '明日は14:00と16:00に空きがあります。\nメニューの「予約する」からご予約いただけます。')],
  [450, print({ id: 'l5', section: OPEN, time: '17:30', text: '空き状況の質問', result: '自動で返信' })],
  // 営業後：閉店後に入った予約
  [2000, at('21:05')],
  [500, say('f2', 'shop', <ReservationFlex date="10月2日（木）" time="16:00〜17:00" menu="カット" staff="佐藤" />)],
  [450, print({ id: 'l6', section: AFTER, time: '21:05', text: '予約 10/2 カット', result: '16:00で受付' })],
  // 営業後：決まった答えのない質問にAIが答える（Pro）
  [2200, at('22:30')],
  [400, say('q4', 'customer', 'カラーとトリートメントを一緒にお願いすると、何分くらいかかりますか？')],
  [600, typing],
  [1400, say('a4', 'shop', 'カラー（90分）とトリートメント（30分）を合わせて、2時間ほどが目安です。')],
  [450, print({ id: 'l7', section: AFTER, time: '22:30', text: '所要時間の質問', result: 'AIが返信（Pro）' })],
  // 1日分を印字し終えたら、レシートを切り取って次の日へ
  [5000, (s) => ({ ...EMPTY, day: s.day + 1 })],
]

/** 最後まで進めた状態。動きを減らす設定のときはこれを静止表示する */
const FINAL = SCRIPT.slice(0, -1).reduce((s, [, fn]) => fn(s), EMPTY)

/** 最初の表示でレシートが空にならないよう、営業前の2件を済ませた状態から始める */
const START_STEP = 11
const START = SCRIPT.slice(0, START_STEP).reduce((s, [, fn]) => fn(s), EMPTY)

function Sheet({ kind }: { kind: 'booking' | 'card' }) {
  if (kind === 'card') {
    return (
      <div className="flex h-full flex-col items-center gap-3 bg-gray-100 px-3 pt-6">
        <p className="text-[12px] font-bold text-gray-600">会員証</p>
        <div className="w-full origin-top scale-[0.92]">
          <MemberCardPreview template="simple" />
        </div>
        <p className="text-[10.5px] text-gray-500">お会計のときにスタッフへ見せてください</p>
      </div>
    )
  }
  // 実際の予約ページの部品を縮小して表示する
  return (
    <div className="h-full overflow-hidden pt-2">
      <div className="w-[133%] origin-top-left scale-75">
        <BookingScreenPreview themeId="simple" color="#00c3dc" screen="date" />
      </div>
    </div>
  )
}

export default function HeroDemo() {
  const reduce = useReducedMotion()
  const [state, setState] = useState<DemoState>(START)
  const [step, setStep] = useState(START_STEP)
  const [visible, setVisible] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)

  // 画面外にあるときは進めない
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (reduce || !visible) return
    const [wait, apply] = SCRIPT[step]
    const timer = window.setTimeout(() => {
      setState((s) => apply(s))
      setStep((i) => (i + 1) % SCRIPT.length)
    }, wait)
    return () => window.clearTimeout(timer)
  }, [step, visible, reduce])

  const shown = reduce ? FINAL : state
  const printing = !reduce && shown.log.length > 0 && step > 0 && step < SCRIPT.length - 1

  return (
    // 置かれた枠の幅でレイアウトを変える。36rem以上あればスマホと伝票を横に並べ、狭ければ縦に積む（重ねない）
    <div ref={rootRef} className="@container w-full">
      <div className="mx-auto flex w-full max-w-[22rem] flex-col items-center gap-6 @[36rem]:max-w-[34rem] @[36rem]:flex-row @[36rem]:items-start @[36rem]:justify-center @[36rem]:gap-5">
        <div className="shrink-0">
        <PhoneFrame className="w-[15.5rem] shrink-0 @[36rem]:w-[18rem]" time={shown.clock}>
          <LineTalk
            messages={shown.messages}
            typing={shown.typing}
            pressed={shown.pressed}
            sheet={shown.sheet ? <Sheet kind={shown.sheet} /> : null}
            height="h-[21rem] @[36rem]:h-[25rem]"
          />
        </PhoneFrame>
        </div>

        <PrintedLog
          className="w-[16.5rem] shrink-0 @[36rem]:mt-2 @[36rem]:w-[16rem]"
          lines={shown.log}
          sheetKey={shown.day}
          // お店の営業の状態は、店側の機械であるレジの表示窓に出す（お客様のスマホには出ない情報のため）
          status={shown.clock < '10:00' ? '営業前' : shown.clock < '19:00' ? '営業中' : '営業後'}
          // 営業時間の外は、表示窓の文字とランプを赤にする
          statusTone={shown.clock >= '10:00' && shown.clock < '19:00' ? 'normal' : 'alert'}
          printing={printing}
        />
      </div>
    </div>
  )
}
