import { useEffect, useRef, useState } from 'react'
import { LineTalk, PhoneFrame, type ChatMessage } from '../LinePhone'
import { AppWindow, KeywordRulesMini } from '../AppScreens'

type Sample = {
  question: string
  /** 当てはまるキーワード。null はキーワードに当てはまらず、AIが返す質問 */
  keyword: string | null
  answer: string
}

// 返事の文面は AppScreens の KeywordRulesMini に登録してある文章と同じにする
const SAMPLES: Sample[] = [
  { question: '今日は何時まで開いてますか？', keyword: '営業時間', answer: '営業時間は10:00〜19:00です。定休日は毎週火曜日です。' },
  { question: '車で行っても大丈夫ですか？', keyword: '駐車場', answer: '店舗前に2台分の駐車スペースがございます。' },
  { question: '来週の土曜に予約したいです', keyword: '予約', answer: 'メニューの「予約する」からご予約いただけます。' },
  {
    question: '髪の傷みが気になります。どのメニューがいいですか？',
    keyword: null,
    answer: '傷みが気になる場合は、カットと一緒にトリートメントをおすすめしています。ご予約はメニューの「予約する」からどうぞ。',
  },
]

/** 質問を選ぶと、登録したキーワードに当たって返事が返る様子を見せる */
export default function AutoReplyPlayground() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'm0', from: 'customer', body: SAMPLES[1].question },
    { id: 'm1', from: 'shop', body: SAMPLES[1].answer },
  ])
  const [typing, setTyping] = useState(false)
  const [matched, setMatched] = useState<string | undefined>('駐車場')
  const [aiUsed, setAiUsed] = useState(false)
  const timers = useRef<number[]>([])
  const seq = useRef(2)

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const ask = (s: Sample) => {
    if (typing) return
    timers.current.forEach((t) => window.clearTimeout(t))
    const n = seq.current
    seq.current += 2
    setMessages((m) => [...m.slice(-4), { id: `m${n}`, from: 'customer', body: s.question }])
    setMatched(undefined)
    setAiUsed(false)
    timers.current = [
      window.setTimeout(() => {
        if (s.keyword) setMatched(s.keyword)
        else setAiUsed(true)
        setTyping(true)
      }, 450),
      window.setTimeout(() => {
        setTyping(false)
        setMessages((m) => [...m, { id: `m${n + 1}`, from: 'shop', body: s.answer }])
      }, 1500),
    ]
  }

  return (
    <div className="grid items-start gap-8 md:grid-cols-[auto_1fr] md:gap-10">
      <PhoneFrame className="mx-auto w-[17.5rem] sm:w-[18.5rem]">
        <LineTalk messages={messages} typing={typing} height="h-[26rem]" showRichMenu={false} />
        <div className="border-t border-gray-200 bg-white px-3 py-2.5">
          <p className="mb-2 text-[10.5px] font-bold text-gray-500">質問を選んで送ってみる</p>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLES.map((s) => (
              <button
                key={s.question}
                type="button"
                onClick={() => ask(s)}
                disabled={typing}
                className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-left text-[11px] leading-snug text-gray-700 transition-colors hover:border-primary-500 hover:bg-primary-50 disabled:opacity-50"
              >
                {s.question}
              </button>
            ))}
          </div>
        </div>
      </PhoneFrame>

      <div className="min-w-0 space-y-4">
        <AppWindow note="管理画面のキーワード応答（表示例）。当てはまったルールが光ります">
          <KeywordRulesMini highlight={matched} />
        </AppWindow>
        <div
          className={`rounded-xl border-2 px-5 py-4 transition-colors ${
            aiUsed ? 'border-ink bg-ink text-paper' : 'border-dashed border-rule text-ink-soft'
          }`}
          aria-live="polite"
        >
          <p className="text-[14px] font-bold">
            {aiUsed ? 'キーワードに当てはまらないので、AIが返信しました' : 'キーワードに当てはまらない質問はAIが返信します'}
            <span className={`ml-2 rounded px-1.5 py-0.5 font-slip text-[11px] ${aiUsed ? 'bg-paper text-ink' : 'bg-ink text-paper'}`}>Pro</span>
          </p>
          <p className="mt-1 text-[13px] leading-relaxed opacity-80">
            AIはお店が読み込ませたメニュー表やよくある質問をもとに答えます。予約はメッセージでは受け付けず、予約ページへ案内します。
          </p>
        </div>
      </div>
    </div>
  )
}
