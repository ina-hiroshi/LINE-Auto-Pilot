import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CreditCard, Gift, QrCode, User } from 'lucide-react'
import { MemberCardPreview, StampCardPreview } from '../MemberCards'
import { PhoneFrame } from '../LinePhone'
import PrintedLog, { type LogLine } from '../PrintedLog'
import { useAutoStep } from './useAutoStep'

type Template = 'simple' | 'dark' | 'elegant' | 'pop'

const TEMPLATES: { id: Template; label: string; ground: string }[] = [
  { id: 'simple', label: 'シンプル', ground: 'bg-gray-100' },
  { id: 'dark', label: 'ダーク', ground: 'bg-slate-950' },
  { id: 'elegant', label: 'エレガント', ground: 'bg-[#F5F5F0]' },
  { id: 'pop', label: 'ポップ', ground: 'bg-primary-50' },
]

/** お客様のLINEで開く会員証。テンプレートを順に切り替えて見せる */
export function MemberCardPhone() {
  const { ref, index, select } = useAutoStep(TEMPLATES.length, 2400)
  const t = TEMPLATES[index]
  return (
    <div ref={ref} className="mx-auto flex w-fit flex-col items-center gap-5">
      <PhoneFrame className="w-[17.5rem] sm:w-[18.5rem]">
        <div className={`flex h-[30rem] flex-col items-center gap-4 px-4 pt-12 transition-colors duration-500 ${t.ground}`}>
          <p className={`text-[12px] font-bold ${t.id === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>会員証</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={t.id}
              className="w-full"
              initial={{ rotateY: -70, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: 70, opacity: 0 }}
              transition={{ duration: 0.35 }}
              style={{ transformPerspective: 900 }}
            >
              <MemberCardPreview template={t.id} />
            </motion.div>
          </AnimatePresence>
          <div className={`mt-2 grid size-24 place-items-center rounded-xl bg-white shadow-sm`}>
            <QrCode className="size-16 text-gray-800" aria-hidden="true" />
          </div>
          <p className={`text-[10.5px] ${t.id === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>お会計のときにスタッフへ見せてください</p>
        </div>
      </PhoneFrame>
      <div className="flex gap-1 rounded-full bg-white/80 p-1 shadow-[0_0_0_1px_var(--color-rule)]" role="group" aria-label="会員証のデザイン">
        {TEMPLATES.map((tp, i) => (
          <button
            key={tp.id}
            type="button"
            aria-pressed={i === index}
            onClick={() => select(i)}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-colors ${i === index ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'}`}
          >
            {tp.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** ポイントカードとスタンプカード、4種類のテンプレートを選んで見比べる */
export function CardStudio() {
  const [template, setTemplate] = useState<Template>('simple')
  const [kind, setKind] = useState<'point' | 'stamp'>('point')
  const ground = TEMPLATES.find((t) => t.id === template)!.ground
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-6">
        <fieldset>
          <legend className="text-[14px] font-bold">カードの種類</legend>
          <div className="mt-3 inline-flex rounded-lg border-2 border-rule bg-white p-1">
            {[
              { id: 'point' as const, label: 'ポイントカード' },
              { id: 'stamp' as const, label: 'スタンプカード' },
            ].map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={kind === k.id}
                onClick={() => setKind(k.id)}
                className={`rounded-md px-3.5 py-1.5 text-[14px] font-bold ${kind === k.id ? 'bg-primary-100 text-ink' : 'text-ink-soft hover:text-ink'}`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[14px] font-bold">デザイン</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={template === t.id}
                onClick={() => setTemplate(t.id)}
                className={`rounded-lg border-2 px-3.5 py-2 text-[14px] font-bold ${
                  template === t.id ? 'border-ink bg-ink text-paper' : 'border-rule bg-white hover:border-ink/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="text-[15px] leading-[1.85] text-ink-soft">
          無料プランでは、シンプルな会員証を使えます。デザインの選択、お店の色やロゴの設定はProプランの機能です。
        </p>
      </div>
      <div className={`grid place-items-center rounded-2xl p-8 transition-colors duration-500 sm:p-12 ${ground}`}>
        <motion.div key={`${template}-${kind}`} initial={{ y: 8, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-sm">
          {kind === 'point' ? <MemberCardPreview template={template} /> : <StampCardPreview template={template} />}
        </motion.div>
      </div>
    </div>
  )
}

/** 顧客詳細のポイント管理。数字を入れて「実行」を押すと残高が変わり、記録が伝票に印字される */
export function PointsPlayground() {
  const [tab, setTab] = useState<'add' | 'use'>('add')
  const [amount, setAmount] = useState('100')
  const [balance, setBalance] = useState(1250)
  const [log, setLog] = useState<LogLine[]>([{ id: 'p0', time: '13:30', text: '来店', result: '+100 pt' }])
  const [error, setError] = useState('')

  const run = () => {
    const n = Number(amount)
    if (!Number.isInteger(n) || n <= 0) {
      setError('1以上の数字を入れてください')
      return
    }
    if (tab === 'use' && n > balance) {
      setError(`残高（${balance.toLocaleString()} pt）より多くは使えません`)
      return
    }
    setError('')
    const next = tab === 'add' ? balance + n : balance - n
    setBalance(next)
    const now = new Date()
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    setLog((l) => [{ id: `p${Date.now()}`, time, text: tab === 'add' ? '付与' : '利用', result: `${tab === 'add' ? '+' : '−'}${n.toLocaleString()} pt` }, ...l].slice(0, 12))
  }

  return (
    // 置かれた枠が36rem以上のときだけ、管理画面とレシートを横に並べる。狭いときは縦に積む
    <div className="@container">
    <div className="grid items-start gap-6 @[36rem]:grid-cols-[minmax(0,1fr)_16rem] @[36rem]:gap-5">
      <div className="ui-real min-w-0 overflow-hidden rounded-xl bg-white p-5 shadow-[0_18px_40px_-16px_rgb(28_42_48/0.35),0_0_0_1px_rgb(28_42_48/0.08)]">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard className="size-4 text-primary-600" aria-hidden="true" />
          <p className="text-[12px] text-gray-500">顧客詳細 / 山田 花子 様</p>
          <span className="ml-auto grid size-7 place-items-center rounded-full bg-gray-100">
            <User className="size-3.5 text-gray-500" aria-hidden="true" />
          </span>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-gray-800">
          <h4 className="mb-3 text-[14px] font-bold text-gray-900">ポイント管理</h4>
          <p className="flex items-baseline gap-2">
            <motion.span key={balance} initial={{ y: -6, opacity: 0.3 }} animate={{ y: 0, opacity: 1 }} className="text-3xl font-bold text-primary-700">
              {balance.toLocaleString()}
            </motion.span>
            <span className="text-[13px] text-gray-500">pt</span>
          </p>
          <div className="mt-4 flex rounded-lg bg-gray-200 p-1">
            {[
              { id: 'add' as const, label: '付与する', icon: Gift },
              { id: 'use' as const, label: '利用する', icon: CreditCard },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tab === t.id}
                onClick={() => {
                  setTab(t.id)
                  setError('')
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-[12.5px] font-bold transition-all ${
                  tab === t.id ? `bg-white shadow-sm ${t.id === 'add' ? 'text-primary-700' : 'text-red-600'}` : 'text-gray-500'
                }`}
              >
                <t.icon className="size-4" aria-hidden="true" />
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
            <label htmlFor="points-amount" className="mb-2 block text-[12px] font-medium text-gray-500">
              {tab === 'add' ? '付与するポイント数' : '利用するポイント数'}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="points-amount"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  className="w-full rounded-md border border-gray-300 py-2 pl-3 pr-8 text-[14px] text-gray-800 outline-none focus:border-primary-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400">pt</span>
              </div>
              <button
                type="button"
                onClick={run}
                className={`rounded-md px-4 py-2 text-[14px] font-bold text-white shadow-sm ${tab === 'add' ? 'bg-primary-700 hover:bg-primary-800' : 'bg-red-600 hover:bg-red-700'}`}
              >
                実行
              </button>
            </div>
            <p className={`mt-2 text-[11px] ${error ? 'font-bold text-red-600' : 'text-gray-500'}`} role={error ? 'alert' : undefined}>
              {error || (tab === 'add' ? '※ 来店時やキャンペーン等でポイントを付与します' : '※ 特典交換などでポイントを消費します')}
            </p>
          </div>
        </div>
      </div>
      <PrintedLog className="mx-auto w-full max-w-[17rem] @[36rem]:mt-2 @[36rem]:max-w-none" title="山田 花子 様" sub="ポイントの記録" lines={log} printing={false} maxListHeight="15rem" />
    </div>
    </div>
  )
}
