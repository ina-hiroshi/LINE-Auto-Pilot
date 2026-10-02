import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CalendarCheck, ChevronRight, CreditCard, Globe, Grid, MessageCircle, QrCode, Search, Sparkles, Ticket, User } from 'lucide-react'
import { PhoneFrame } from '../LinePhone'

/* ------------------------------------------------------------------ */
/* 顧客一覧（管理画面の Customers.tsx と同じ列と表示）                     */
/* ------------------------------------------------------------------ */

const CUSTOMERS = [
  { name: '山田 花子', line: 'hana_y', points: 1250, last: '2026/9/1' },
  { name: '佐藤 太郎', line: 'taro_s', points: 480, last: '2026/8/28' },
  { name: '鈴木 美咲', line: 'misaki', points: 2100, last: '2026/9/3' },
  { name: '高橋 健', line: 'ken_t', points: 90, last: '2026/8/20' },
]

// 広い枠のときだけ出す列（LINE名・ステータス・矢印）
const WIDE_ONLY = [1, 4, 5]

export function CustomerTableMini() {
  return (
    <div className="text-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
        <div>
          <p className="text-[17px] font-bold text-gray-900">顧客一覧</p>
          <p className="mt-0.5 text-[11.5px] text-gray-500">顧客を選択すると詳細ページで施術メモ・LINEメッセージを管理できます。</p>
        </div>
        <div className="flex gap-2">
          <span className="hidden items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-[12px] text-gray-400 sm:flex">
            <Search className="size-4" aria-hidden="true" />
            名前で検索...
          </span>
          <span className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-[12px] font-bold text-white">
            <QrCode className="size-4" aria-hidden="true" />
            会員証読取
          </span>
        </div>
      </div>
      {/* 枠が狭いときは「LINE名」「ステータス」の列を省き、表を横にはみ出させない */}
      <div className="@container">
        <table className="w-full text-[12.5px]">
          <thead className="bg-gray-50 text-left text-[11px] font-medium text-gray-500">
            <tr>
              {['本名', 'LINE名', 'ポイント残高', '最終来店日', 'ステータス', ''].map((h, i) => (
                <th key={h || 'go'} className={`px-3 py-2.5 font-medium @[34rem]:px-4 ${WIDE_ONLY.includes(i) ? 'hidden @[34rem]:table-cell' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {CUSTOMERS.map((c) => {
              const vip = c.points >= 1000
              return (
                <tr key={c.name}>
                  <td className="whitespace-nowrap px-3 py-3 @[34rem]:px-4">
                    <span className="flex items-center gap-2.5">
                      <span className="grid size-7 place-items-center rounded-full bg-gray-200">
                        <User className="size-3.5 text-gray-500" aria-hidden="true" />
                      </span>
                      <span className="font-medium text-gray-900">{c.name}</span>
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-gray-500 @[34rem]:table-cell">{c.line}</td>
                  <td className="whitespace-nowrap px-3 py-3 @[34rem]:px-4">{c.points.toLocaleString()} pt</td>
                  <td className="whitespace-nowrap px-3 py-3 text-gray-500 @[34rem]:px-4">{c.last}</td>
                  <td className="hidden whitespace-nowrap px-4 py-3 @[34rem]:table-cell">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${vip ? 'bg-yellow-100 text-yellow-800' : 'bg-primary-100 text-primary-800'}`}>
                      {vip ? 'VIP' : '会員'}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-right text-gray-400 @[34rem]:table-cell">
                    <ChevronRight className="inline size-4" aria-hidden="true" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* メッセージ配信: AIに下書きを作ってもらう                                 */
/* ------------------------------------------------------------------ */

const PURPOSE = '久しぶりのお客様に再来店してほしい'
const DRAFTS = [
  'ご無沙汰しております。お元気でお過ごしでしょうか。次回のご来店を、スタッフ一同心よりお待ちしております。',
  'いつもありがとうございます。前回のご来店から少し経ちましたが、その後の髪の調子はいかがですか。ご都合のよいときに、またお顔を見せてください。',
  '季節の変わり目で、髪や肌のお手入れが気になる時期になりました。ご予約はメニューの「予約する」からどうぞ。',
]

/** 管理画面の「AIに下書きを作ってもらう」を、入力から案が出るまで再生する */
export function DraftComposer() {
  const reduce = useReducedMotion()
  const [typed, setTyped] = useState(reduce ? PURPOSE.length : 0)
  const [phase, setPhase] = useState<'typing' | 'thinking' | 'done'>(reduce ? 'done' : 'typing')
  const [picked, setPicked] = useState(0)
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (reduce || !visible) return
    if (phase === 'typing') {
      if (typed < PURPOSE.length) {
        const t = window.setTimeout(() => setTyped((n) => n + 1), 70)
        return () => window.clearTimeout(t)
      }
      const t = window.setTimeout(() => setPhase('thinking'), 500)
      return () => window.clearTimeout(t)
    }
    if (phase === 'thinking') {
      const t = window.setTimeout(() => setPhase('done'), 1300)
      return () => window.clearTimeout(t)
    }
  }, [typed, phase, reduce, visible])

  const replay = () => {
    setTyped(0)
    setPhase('typing')
    setPicked(0)
  }

  return (
    <div ref={ref} className="ui-real overflow-hidden rounded-xl bg-white p-5 text-gray-800 shadow-[0_18px_40px_-16px_rgb(28_42_48/0.35),0_0_0_1px_rgb(28_42_48/0.08)] sm:p-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-[12px] font-bold">
        <li className="rounded-full bg-primary-50 px-3 py-1 text-primary-800">1 配信対象</li>
        <li aria-hidden="true" className="text-gray-300">›</li>
        <li className="rounded-full bg-primary-700 px-3 py-1 text-white">2 メッセージ</li>
        <li aria-hidden="true" className="text-gray-300">›</li>
        <li className="rounded-full bg-gray-100 px-3 py-1 text-gray-500">3 確認・配信</li>
      </ol>

      <div className="mt-4 rounded-xl border border-gray-200 p-4 sm:p-5">
        <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold">
          <Sparkles className="size-4 text-primary-600" aria-hidden="true" />
          AIに下書きを作ってもらう
          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] text-primary-800">Proプラン以上</span>
        </p>
        <p className="mt-3 text-[12px] text-gray-500">配信の目的</p>
        <div className="mt-1 min-h-[2.6rem] rounded-lg border border-gray-300 px-3 py-2 text-[13.5px]">
          {PURPOSE.slice(0, typed)}
          {phase === 'typing' && <span className="ml-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-gray-800" aria-hidden="true" />}
        </div>
        <p className="mt-3 text-[12px] text-gray-500">文章のトーン</p>
        <div className="mt-1 flex gap-1.5 text-[12px]">
          <span className="rounded-full bg-primary-700 px-3 py-1 font-bold text-white">親しみやすく</span>
          <span className="rounded-full border border-gray-300 px-3 py-1">丁寧に</span>
          <span className="rounded-full border border-gray-300 px-3 py-1">カジュアルに</span>
        </div>
        <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-[13px] font-bold text-white">
          <Sparkles className="size-4" aria-hidden="true" />
          {phase === 'thinking' ? '文章を作っています' : '文章を作ってもらう'}
        </p>

        <div className="mt-4 min-h-[12rem]" aria-live="polite">
          {phase === 'thinking' && (
            <div className="space-y-2" aria-label="文章を作っています">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-12 rounded-lg bg-gray-100"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          )}
          {phase === 'done' && (
            <>
              <p className="mb-2 text-[11.5px] text-gray-500">使いたい案を選ぶと下の本文に入ります。そのあと自由に手直しできます。</p>
              <ul className="space-y-2">
                <AnimatePresence>
                  {DRAFTS.map((d, i) => (
                    <motion.li key={d} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}>
                      <button
                        type="button"
                        onClick={() => setPicked(i)}
                        aria-pressed={picked === i}
                        className={`w-full rounded-lg border px-3 py-2.5 text-left text-[12.5px] leading-relaxed transition-colors ${
                          picked === i ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        <span className="mb-0.5 block text-[10.5px] text-gray-400">案{i + 1}</span>
                        {d}
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="font-slip text-[11px] text-ink-soft">案の文面は表示例です</p>
        <button type="button" onClick={replay} className="text-[12px] font-bold text-primary-800 underline underline-offset-4">
          もう一度見る
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* リッチメニュー: レイアウトとテーマを選ぶ                                 */
/* ------------------------------------------------------------------ */

// frontend/src/features/line-settings/constants.ts の RICH_MENU_LAYOUTS から、代表的な3つ
const LAYOUTS = [
  { id: 'large_4', name: '標準 (2×2)', cols: 2, rows: 2 },
  { id: 'large_6', name: '多機能 (3×2)', cols: 3, rows: 2 },
  { id: 'compact_2', name: 'コンパクト (2列)', cols: 2, rows: 1 },
] as const

// 旧機能ページと同じく、RichMenuTab.tsx のプレビュー配色に合わせている
const THEMES = [
  { id: 'simple', label: 'シンプル', outer: '#e5e7eb', slot: '#ffffff', text: '#1F2937', pro: false },
  { id: 'pop', label: 'ポップ', outer: '#00B8A9', slot: '#f0fdfa', text: '#0e7490', pro: true },
  { id: 'dark', label: 'ダーク', outer: '#334155', slot: '#1e293b', text: '#ffffff', pro: true },
  { id: 'elegant', label: 'エレガント', outer: '#D4C4B7', slot: '#F5F5F0', text: '#5D4037', pro: true },
] as const

const SLOTS = [
  { label: '予約する', icon: CalendarCheck },
  { label: '問い合わせ', icon: MessageCircle },
  { label: '会員証', icon: CreditCard },
  { label: 'ウェブサイト', icon: Globe },
  { label: 'クーポン', icon: Ticket },
  { label: 'お店のこと', icon: Grid },
]

export function RichMenuBuilder() {
  const [layoutId, setLayoutId] = useState<(typeof LAYOUTS)[number]['id']>('large_4')
  const [themeId, setThemeId] = useState<(typeof THEMES)[number]['id']>('simple')
  const layout = LAYOUTS.find((l) => l.id === layoutId)!
  const theme = THEMES.find((t) => t.id === themeId)!
  const slots = SLOTS.slice(0, layout.cols * layout.rows)

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1fr_auto]">
      <div className="space-y-7">
        <fieldset>
          <legend className="text-[14px] font-bold">
            レイアウト<span className="ml-2 font-slip text-[11px] text-ink-soft">2×2以外はPro</span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {LAYOUTS.map((l) => (
              <button
                key={l.id}
                type="button"
                aria-pressed={layoutId === l.id}
                onClick={() => setLayoutId(l.id)}
                className={`rounded-lg border-2 px-3.5 py-2 text-[14px] font-bold ${layoutId === l.id ? 'border-ink bg-ink text-paper' : 'border-rule bg-white hover:border-ink/60'}`}
              >
                {l.name}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[14px] font-bold">
            テーマ<span className="ml-2 font-slip text-[11px] text-ink-soft">シンプル以外はPro</span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={themeId === t.id}
                onClick={() => setThemeId(t.id)}
                className={`flex items-center gap-2 rounded-lg border-2 px-3.5 py-2 text-[14px] font-bold ${themeId === t.id ? 'border-ink bg-ink text-paper' : 'border-rule bg-white hover:border-ink/60'}`}
              >
                <span className="size-3.5 rounded-full border border-black/10" style={{ background: t.outer }} aria-hidden="true" />
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="text-[15px] leading-[1.85] text-ink-soft">
          Proプランでは、ボタンごとにお店の写真も置けます。登録した写真は、ボタンの比率に合わせて中央で自動的に切り抜かれます。無料プランでも、シンプルなテーマの2×2で作れます。
        </p>
      </div>

      <PhoneFrame className="mx-auto w-[17.5rem] sm:w-[18.5rem]">
        <div className="flex flex-col">
          <div className="bg-[#f6f7f9] px-3 pb-2.5 pt-9 text-[14px] font-bold text-[#111]">サロン IToguchi</div>
          <div className="flex h-[17rem] items-start bg-[#8ea9c2] px-3 py-3">
            <span className="mr-1.5 size-7 shrink-0 rounded-full bg-white" aria-hidden="true" />
            <p className="rounded-2xl rounded-tl-md bg-white px-3 py-2 text-[12.5px] leading-[1.55] text-[#111]">
              いらっしゃいませ。
              <br />
              下のメニューからご予約いただけます。
            </p>
          </div>
          <div className="flex justify-between border-y border-[#e5e7eb] bg-[#f6f7f9] px-4 py-1.5 text-[11px] text-[#666]">
            <span>メニュー ▾</span>
            <span>キーボード</span>
          </div>
          <motion.div
            layout
            className="grid gap-[3px] p-[3px]"
            style={{
              background: theme.outer,
              gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
              aspectRatio: layout.rows === 1 ? '2500 / 843' : '2500 / 1686',
            }}
          >
            {slots.map((s) => (
              <motion.div layout key={s.label} className="relative overflow-hidden" style={{ background: theme.slot }}>
                <span
                  className="relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-bold"
                  style={{ color: theme.text }}
                >
                  <s.icon className="size-[18px]" aria-hidden="true" />
                  {s.label}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </PhoneFrame>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* AI分析レポート（表示例）                                               */
/* ------------------------------------------------------------------ */

const ANALYSIS = [
  { title: '傾向のまとめ', body: '過去30日間のメッセージや予約の傾向を、文章でわかりやすくまとめます。' },
  { title: '気づき', body: 'データから見つかった、お店の強みや課題を挙げます。' },
  { title: '改善の提案', body: '次に何をするとよいか、データにもとづいて具体的に提案します。' },
  { title: '質問の分類', body: 'よく届く質問をカテゴリに分けます。キーワード応答の設定に役立ちます。' },
  { title: 'お客様のランキング', body: 'メッセージ数や予約数でお客様を並べるので、大切なお客様がひと目でわかります。' },
  { title: 'メニューとスタッフの分析', body: '人気のメニューや、担当ごとの予約数を見られます。' },
]

export function AiReportSample() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="ui-real overflow-hidden rounded-xl bg-white text-gray-800 shadow-[0_18px_40px_-16px_rgb(28_42_48/0.35),0_0_0_1px_rgb(28_42_48/0.08)]">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <p className="flex items-center gap-2 text-[14px] font-bold">
            <Sparkles className="size-4 text-primary-600" aria-hidden="true" />
            AIによるデータ分析
          </p>
          <span className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] text-gray-500">分析を更新</span>
        </div>
        <div className="space-y-5 p-5">
          <section>
            <p className="text-[12px] font-bold text-gray-500">今月の傾向のまとめ</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed">
              「営業時間」に関する質問が多く届いています。リッチメニューに営業時間を確かめられるボタンを置くと、質問が減る見込みです。
            </p>
          </section>
          <section>
            <p className="text-[12px] font-bold text-gray-500">気づき</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] leading-relaxed">
              <li>平日の午後に問い合わせが集まっています</li>
              <li>「駐車場」についての質問が増えています</li>
            </ul>
          </section>
          <section>
            <p className="text-[12px] font-bold text-gray-500">改善の提案</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] leading-relaxed">
              <li>「駐車場」のキーワード応答を追加する</li>
              <li>久しぶりのお客様へ、来店のお知らせを送る</li>
            </ul>
          </section>
          <p className="border-t border-dashed border-gray-200 pt-3 font-slip text-[11px] text-ink-soft">分析の文面は表示例です</p>
        </div>
      </div>
      <ul className="divide-y divide-dashed divide-ink/20 border-y border-dashed border-ink/20">
        {ANALYSIS.map((a) => (
          <li key={a.title} className="py-4">
            <p className="text-[17px] font-black">{a.title}</p>
            <p className="mt-1 text-[15px] leading-[1.8] text-ink-soft">{a.body}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
