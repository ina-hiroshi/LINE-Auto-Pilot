import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, useScroll, useSpring } from 'framer-motion'
import { ArrowRight, Check, ChevronDown, Scissors } from 'lucide-react'
import SiteShell from '../components/site/SiteShell'
import HeroDemo from '../components/site/HeroDemo'
import AuthPanel from '../components/site/AuthPanel'
import BookingScreenPreview, { type BookingPreviewScreen } from '../components/booking/BookingScreenPreview'
import { PhoneFrame } from '../components/site/LinePhone'
import { LeaderRow, Slip, Stamp, SlipNumbers } from '../components/site/Receipt'
import TryTag from '../components/site/TryTag'
import { FEATURES, LINE_DEMO_URL, PLANS, SETUP_SERVICE_PRICE, CONTACT_MAIL } from '../components/site/siteData'
import { btnInk, btnOutline, btnPrimary, textLink, wrap } from '../components/site/ui'
import { DESIGN_THEMES } from '../constants/designThemes'
import LogoSettingDemo from '../components/site/demos/LogoSettingDemo'
import type { LogoLayout } from '../lib/bookingLogoLayout'
import { CHORES, DAY, FAQ, INDUSTRIES, STEPS } from '../components/site/topContent'

/* ------------------------------------------------------------------ */
/* ファーストビュー                                                     */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-paper">
      <div className={`${wrap} grid min-w-0 grid-cols-1 items-center gap-12 pb-20 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_36rem] lg:pb-24 lg:pt-16`}>
        <div className="min-w-0 max-w-xl">
          <h1 className="text-[2rem] font-black leading-[1.3] tracking-[-0.02em] sm:text-[2.75rem] sm:leading-[1.25] xl:text-[3rem]">
            <span className="block">
              <span className="inline-block">予約も、</span>
              <span className="inline-block">よくある質問も、</span>
            </span>
            <span className="block">会員証も。</span>
            <span className="block">
              <span className="relative inline-block">
                <span className="relative z-10">お店のLINEが</span>
                <span className="absolute inset-x-[-0.08em] bottom-[0.06em] z-0 h-[0.34em] bg-primary-300" aria-hidden="true" />
              </span>
              <span className="inline-block">引き受けます。</span>
            </span>
          </h1>
          <p className="mt-7 text-[17px] leading-[1.9] text-ink-soft">
            IToguchi（イトグチ）は、LINE公式アカウントとつないで、予約の受付、質問への自動返信、会員証とポイントの管理を、LINEでまとめて行えるサービスです。お客様はいつものLINEで用が済み、お店は施術や調理の手を止めずに済みます。
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href="#auth" className={btnPrimary}>
              無料で始める
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            <a href={LINE_DEMO_URL} target="_blank" rel="noopener noreferrer" className={btnOutline}>
              <span className="size-2 rounded-full bg-[#06C755]" aria-hidden="true" />
              LINEで動きを試す
            </a>
          </div>
          <p className="mt-5 text-[14px] leading-relaxed text-ink-soft">
            無料プランがあります。Proプランは30日間無料で試せます。
            <br />
            LINE公式アカウントをまだお持ちでない方は
            <a href="#start" className={`inline-link ${textLink} font-medium`}>
              始めるまでの流れ
            </a>
            をご覧ください。
          </p>
        </div>

        <HeroDemo />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 手を離れる仕事（消し込み）                                            */
/* ------------------------------------------------------------------ */


function Chores() {
  return (
    <section className="bg-counter py-24">
      <div className={`${wrap} grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]`}>
        <div>
          <h2 className="text-3xl font-black leading-snug tracking-[-0.02em] sm:text-4xl">
            店主の手から、
            <br />
            この仕事が離れます
          </h2>
          <p className="mt-5 max-w-md text-[17px] leading-[1.9] text-ink-soft">
            お客様とのやりとりのうち、毎日くり返している仕事をLINEに任せられます。空いた時間は、目の前のお客様に使えます。
          </p>
        </div>

        <Slip className="py-8">
          <p className="text-center text-[15px] font-bold">消し込み票</p>
          <p className="mt-1 text-center font-slip text-[12px] text-ink-soft">これまでの仕事 → IToguchiでは</p>
          <div className="slip-rule my-4" />
          <ul>
            {CHORES.map((c, i) => (
              <li key={c.before} className="grid gap-1 border-b border-dashed border-rule py-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
                <span className="relative w-fit text-[16px] text-ink-soft">
                  {c.before}
                  <motion.span
                    className="absolute left-0 right-0 top-1/2 h-[2.5px] origin-left -rotate-1 rounded bg-stamp"
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true, amount: 1 }}
                    transition={{ delay: 0.25 + i * 0.18, duration: 0.45, ease: [0.65, 0, 0.35, 1] }}
                    aria-hidden="true"
                  />
                </span>
                <span className="flex items-center gap-2 text-[16px] font-bold">
                  <ArrowRight className="size-4 text-primary-700" aria-hidden="true" />
                  {c.after}
                </span>
              </li>
            ))}
          </ul>
        </Slip>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* お店の一日（時刻の縦軸）                                              */
/* ------------------------------------------------------------------ */


function DayTimeline() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 60%', 'end 60%'] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 })

  return (
    <section className="bg-paper py-24" aria-labelledby="day-heading">
      <div className={wrap}>
        <div className="max-w-2xl">
          <h2 id="day-heading" className="text-3xl font-black leading-snug tracking-[-0.02em] sm:text-4xl">
            お店の一日のうち、
            <br />
            ここを任せられます
          </h2>
          <p className="mt-5 text-[17px] leading-[1.9] text-ink-soft">
            開店前から閉店後まで、IToguchiが受け持つ仕事を時刻の順に並べました。画面は実際の管理画面と、それを元にした表示例です。
          </p>
        </div>

        <div ref={ref} className="relative mt-16">
          {/* 時刻の軸 */}
          <div className="absolute bottom-0 left-[0.4rem] top-0 w-[3px] rounded bg-rule sm:left-[5.6rem]" aria-hidden="true" />
          <motion.div
            className="absolute bottom-0 left-[0.4rem] top-0 w-[3px] origin-top rounded bg-primary-500 sm:left-[5.6rem]"
            style={{ scaleY: progress }}
            aria-hidden="true"
          />

          <ol className="space-y-20 sm:space-y-24">
            {DAY.map((d) => (
              <li key={d.time} className="relative grid gap-6 pl-8 sm:grid-cols-[5.6rem_1fr] sm:gap-0 sm:pl-0">
                <div className="sm:pr-6 sm:text-right">
                  <time className="block font-slip text-[22px] font-bold leading-none tracking-tight sm:text-[26px]">{d.time}</time>
                  <span className="mt-1.5 block text-[13px] font-bold text-ink-soft">{d.when}</span>
                </div>
                <span
                  className="absolute left-0 top-1.5 size-[15px] rounded-full border-[3px] border-paper bg-primary-600 shadow-[0_0_0_2px_var(--color-primary-500)] sm:left-[5.6rem] sm:-translate-x-[6px]"
                  aria-hidden="true"
                />
                <div className="grid gap-8 sm:pl-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
                  <div>
                    <h3 className="text-[22px] font-black leading-snug tracking-[-0.01em] sm:text-2xl">
                      {d.title}
                      {d.pro && <span className="ml-2 inline-block -translate-y-0.5 rounded bg-ink px-1.5 py-0.5 align-middle font-slip text-[11px] font-bold text-paper">Pro</span>}
                    </h3>
                    <p className="mt-4 text-[16px] leading-[1.9] text-ink-soft">{d.body}</p>
                    <Link to={d.link.to} className={`mt-5 inline-flex items-center gap-1.5 ${textLink}`}>
                      {d.link.label}を詳しく見る
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </div>
                  <div>{d.visual}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 機能の明細                                                           */
/* ------------------------------------------------------------------ */

function FeatureMenu() {
  return (
    <section id="features" className="scroll-mt-20 bg-counter py-24">
      <div className={`${wrap} grid items-start gap-12 lg:grid-cols-[0.8fr_1.2fr]`}>
        <div className="lg:sticky lg:top-28">
          <h2 className="text-3xl font-black leading-snug tracking-[-0.02em] sm:text-4xl">できることの明細</h2>
          <p className="mt-5 text-[17px] leading-[1.9] text-ink-soft">
            IToguchiの8つの機能です。どれもLINE公式アカウントひとつで動くので、お客様に別のアプリを入れてもらう必要はありません。
          </p>
          <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">
            右端に「無料から」とある機能は、無料プランでも使えます。Proプランにすると、使える設定が増え、件数の上限も上がります。
          </p>
        </div>

        <Slip className="py-8">
          <div className="text-center">
            <p className="text-[17px] font-black tracking-wide">IToguchi</p>
            <p className="mt-1 font-slip text-[12px] text-ink-soft">機能明細</p>
          </div>
          <div className="slip-rule my-4" />
          <ul>
            {FEATURES.map((f) => (
              <li key={f.slug}>
                <Link
                  to={f.path}
                  className="group -mx-3 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-lg px-3 py-3.5 transition-colors hover:bg-counter/70"
                >
                  <span className="flex items-end gap-2">
                    <span className="shrink-0 text-[17px] font-bold">{f.name}</span>
                    <span className="slip-leader" aria-hidden="true" />
                  </span>
                  <span className={`font-slip text-[14px] font-bold ${f.plan === 'Pro' ? 'text-ink' : 'text-primary-800'}`}>{f.plan}</span>
                  <span className="col-span-2 flex items-center justify-between gap-3 text-[14px] text-ink-soft">
                    {f.gain}
                    <ArrowRight className="size-4 shrink-0 text-ink-soft transition-transform group-hover:translate-x-1 group-hover:text-ink" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="slip-rule my-4" />
          <LeaderRow label="Proプラン（すべての機能）" value="¥4,980 / 月" strong />
          <p className="mt-1 text-right font-slip text-[12px] text-ink-soft">初回は30日間無料</p>
        </Slip>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 予約ページのテーマ（実際の予約ページの部品で切り替える）                    */
/* ------------------------------------------------------------------ */

const SCREENS: { id: BookingPreviewScreen; label: string }[] = [
  { id: 'menu', label: 'メニュー選択' },
  { id: 'date', label: '日時選択' },
  { id: 'confirm', label: '確認' },
]

function ThemeShowcase() {
  const [themeId, setThemeId] = useState('simple')
  const [screen, setScreen] = useState<BookingPreviewScreen>('date')
  // お店のアイコンは、選んだらすぐ予約ページに反映する
  const [saved, setSaved] = useState<{ logoUrl?: string; layout: LogoLayout; version: number }>({ layout: 'center', version: 0 })
  const theme = DESIGN_THEMES.find((t) => t.id === themeId) ?? DESIGN_THEMES[0]

  return (
    <section id="customization" className="scroll-mt-20 bg-paper py-24">
      <div className={`${wrap} grid items-center gap-14 lg:grid-cols-[1fr_auto] lg:items-start`}>
        <div className="max-w-xl">
          <h2 className="text-3xl font-black leading-snug tracking-[-0.02em] sm:text-4xl">
            予約ページの見た目も、
            <br />
            お店に合わせて選べます
          </h2>
          <p className="mt-5 text-[17px] leading-[1.9] text-ink-soft">
            お客様が予約に使うページは、6種類のテーマから選べます。お店のアイコンを載せることもできます。下のボタンを押すと、右の予約ページが切り替わります。右の画面は、実際の予約ページと同じ部品で作っています。
          </p>

          <TryTag className="mt-8" />

          <fieldset className="mt-6">
            <legend className="text-[14px] font-bold">テーマ</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {DESIGN_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={themeId === t.id}
                  onClick={() => setThemeId(t.id)}
                  className={`rounded-lg border-2 px-3.5 py-2 text-[14px] font-bold transition-colors ${
                    themeId === t.id ? 'border-ink bg-ink text-paper' : 'border-rule bg-white text-ink hover:border-ink/60'
                  }`}
                >
                  {t.name}
                  {t.isPro && <span className={`ml-1.5 font-slip text-[11px] ${themeId === t.id ? 'text-primary-300' : 'text-ink-soft'}`}>Pro</span>}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="text-[14px] font-bold">画面</legend>
            <div className="mt-3 inline-flex rounded-lg border-2 border-rule bg-white p-1">
              {SCREENS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={screen === s.id}
                  onClick={() => setScreen(s.id)}
                  className={`rounded-md px-3.5 py-1.5 text-[14px] font-bold transition-colors ${
                    screen === s.id ? 'bg-primary-100 text-ink' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-6">
            <LogoSettingDemo onChange={(logoUrl, layout) => setSaved((v) => ({ logoUrl, layout, version: v.version + 1 }))} />
          </div>

          <p className="mt-6 text-[15px] leading-relaxed text-ink-soft">
            {theme.description}。{theme.isPro ? 'Proプランで使えます。' : '無料プランで使えます。'}
            リッチメニューも、お店の写真をボタンごとに置いて作れます。
            <Link to="/feature/rich-menu" className={`inline-link ml-1 ${textLink}`}>
              リッチメニューを見る
            </Link>
          </p>
        </div>

        <PhoneFrame className="mx-auto w-[18.5rem] shrink-0 lg:sticky lg:top-24">
          <div className="h-[34rem] overflow-y-auto pt-7 [scrollbar-width:none]">
            <motion.div key={`${themeId}-${screen}-${saved.version}`} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
              <div className="w-[133.4%] origin-top-left scale-75">
                <BookingScreenPreview themeId={themeId} color="#00c3dc" screen={screen} logoUrl={saved.logoUrl} logoLayout={saved.layout} />
              </div>
            </motion.div>
          </div>
        </PhoneFrame>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 始めるまでの流れ                                                     */
/* ------------------------------------------------------------------ */


function Steps() {
  return (
    <section id="start" className="scroll-mt-20 bg-counter py-24">
      <div className={wrap}>
        <div className="max-w-2xl">
          <h2 className="text-3xl font-black leading-snug tracking-[-0.02em] sm:text-4xl">始めるまでの流れ</h2>
          <p className="mt-5 text-[17px] leading-[1.9] text-ink-soft">
            アカウントの作成からLINEとの接続、最初の設定まで、合わせて20分ほどが目安です。
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:gap-14">
          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[3.5rem_1fr] gap-5 rounded-xl bg-paper p-6 sm:grid-cols-[4.5rem_1fr_auto] sm:items-center sm:p-7">
                <span className="font-slip text-[40px] font-bold leading-none text-primary-600 sm:text-[48px]">{i + 1}</span>
                <div>
                  <h3 className="text-[20px] font-black">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-[1.85] text-ink-soft">{s.body}</p>
                </div>
                <span className="col-start-2 w-fit rounded border border-rule px-2.5 py-1 font-slip text-[13px] font-bold sm:col-start-auto">{s.minutes}</span>
              </li>
            ))}
          </ol>

          <Slip className="h-fit py-8">
            <p className="text-[18px] font-black leading-snug">LINE公式アカウントをまだお持ちでない方へ</p>
            <div className="slip-rule my-4" />
            <p className="text-[15px] leading-[1.9]">
              LINE公式アカウントの開設は無料で、数分で済みます。お店が管理者として持つアカウントなので、開設はご自身でお願いしていますが、手順はこちらからご案内します。
            </p>
            <p className="mt-4 text-[15px] leading-[1.9]">
              IToguchiとの接続に不安がある方には、接続の設定をこちらで行う初期設定代行（{SETUP_SERVICE_PRICE}）があります。モニター店舗は無料です。
            </p>
            <Link to="/monitor" className={`mt-5 inline-flex items-center gap-1.5 ${textLink}`}>
              モニター特典を見る
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Slip>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 業種                                                                 */
/* ------------------------------------------------------------------ */


function Industries() {
  return (
    <section className="bg-paper py-24">
      <div className={wrap}>
        <div className="max-w-2xl">
          <h2 className="text-3xl font-black leading-snug tracking-[-0.02em] sm:text-4xl">個人経営のお店のために作りました</h2>
          <p className="mt-5 text-[17px] leading-[1.9] text-ink-soft">
            予約を受けるお店や、常連のお客様を大切にしたいお店に向いています。業種ごとに、任せやすい仕事の例を挙げました。
          </p>
        </div>
        <ul className="mt-14 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((ind) => (
            <li key={ind.name}>
              <Slip className="py-6">
                <p className="text-[17px] font-black">{ind.name}</p>
                <div className="slip-rule my-3" />
                {ind.rows.map(([task, feature]) => (
                  <LeaderRow key={task} label={<span className="text-[14px]">{task}</span>} value={<span className="text-[13px] text-primary-800">{feature}</span>} />
                ))}
              </Slip>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* キャンペーン（クーポン券）                                            */
/* ------------------------------------------------------------------ */

function Campaign() {
  return (
    <section id="campaign" className="scroll-mt-20 bg-counter py-24">
      <div className={`${wrap} max-w-4xl`}>
        <div className="relative rounded-2xl border-[3px] border-dashed border-ink/40 p-2">
          <Scissors className="absolute -top-[15px] left-10 size-6 rotate-[-90deg] bg-counter px-0.5 text-ink/60" aria-hidden="true" />
          <div className="grid gap-8 rounded-xl bg-primary-500 p-8 text-ink sm:p-12 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 className="text-3xl font-black leading-snug tracking-[-0.02em] sm:text-[2.6rem]">Proプランを30日間無料で</h2>
              <p className="mt-4 max-w-lg text-[16px] font-medium leading-[1.85]">
                リリース記念として、初めてお申し込みの方はProプラン<span className="whitespace-nowrap">（通常 月額¥4,980）</span>のすべての機能を30日間無料で試せます。登録したデータは、そのまま続けて使えます。
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a href="#auth" className={btnInk}>
                  無料で始める
                  <ArrowRight className="size-4" aria-hidden="true" />
                </a>
                <Link to="/monitor" className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-ink px-6 py-3 text-[15px] font-bold hover:bg-ink hover:text-paper">
                  モニター特典を見る
                </Link>
              </div>
            </div>
            <Stamp className="mx-auto h-28 w-28 rotate-[-12deg] border-[4px] border-ink bg-primary-400/40 text-center text-[22px] leading-tight text-ink mix-blend-normal">
              <span className="font-slip">30</span>日間
              <br />
              無料
            </Stamp>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 料金                                                                 */
/* ------------------------------------------------------------------ */

function Pricing() {
  const plans = [
    { ...PLANS.free, note: '登録してすぐ使えます', action: <a href="#auth" className={`${btnOutline} w-full`}>無料で始める</a> },
    { ...PLANS.pro, note: '初回は30日間無料', action: <a href="#auth" className={`${btnPrimary} w-full`}>30日間無料で試す</a>, featured: true },
    { ...PLANS.executive, note: '準備中です', action: <a href={`mailto:${CONTACT_MAIL}`} className={`${btnOutline} w-full`}>問い合わせる</a> },
  ]
  return (
    <section id="pricing" className="scroll-mt-20 bg-paper py-24">
      <div className={wrap}>
        <div className="max-w-2xl">
          <h2 className="text-3xl font-black leading-snug tracking-[-0.02em] sm:text-4xl">料金</h2>
          <p className="mt-5 text-[17px] leading-[1.9] text-ink-soft">
            無料プランで始めて、必要になったらProプランに切り替えられます。金額は税込、月ごとのお支払いです。
          </p>
        </div>
        <div className="mt-14 grid items-start gap-8 md:grid-cols-3">
          {plans.map((p) => (
            <div key={p.name} className={'featured' in p && p.featured ? 'md:-mt-4' : ''}>
              <Slip className={`py-8 ${'featured' in p && p.featured ? 'ring-0' : ''}`}>
                <div className="flex items-baseline justify-between">
                  <p className="text-[22px] font-black">{p.name}</p>
                  {'featured' in p && p.featured && <span className="rounded-sm bg-ink px-2 py-0.5 text-[12px] font-bold text-paper">おすすめ</span>}
                </div>
                <p className="mt-4">
                  <span className="font-slip text-[40px] font-bold leading-none tracking-tight">{p.price}</span>
                  <span className="ml-1 text-[14px] text-ink-soft">/ 月</span>
                </p>
                <p className="mt-2 font-slip text-[13px] text-primary-800">{p.note}</p>
                <div className="slip-rule my-5" />
                <ul className="space-y-2.5">
                  {p.items.map((item) => (
                    <li key={item} className="flex gap-2.5 text-[15px] leading-snug">
                      <span className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-ink" aria-hidden="true" />
                      <span><SlipNumbers>{item}</SlipNumbers></span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">{p.action}</div>
              </Slip>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* よくある質問                                                          */
/* ------------------------------------------------------------------ */


function Faq() {
  return (
    <section className="bg-counter py-24">
      <div className={`${wrap} grid gap-12 lg:grid-cols-[0.7fr_1.3fr]`}>
        <h2 className="text-3xl font-black leading-snug tracking-[-0.02em] sm:text-4xl">よくある質問</h2>
        <div className="divide-y divide-dashed divide-ink/20 border-y border-dashed border-ink/20">
          {FAQ.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-[17px] font-bold leading-snug [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="mt-0.5 size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="pb-6 pr-10 text-[16px] leading-[1.9] text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 安全性と相談                                                          */
/* ------------------------------------------------------------------ */

function TrustAndContact() {
  return (
    <section className="bg-paper py-20">
      <div className={`${wrap} grid gap-6 md:grid-cols-2`}>
        <div className="rounded-xl border-2 border-rule p-8">
          <h2 className="text-[22px] font-black">お客様のデータを守る仕組み</h2>
          <p className="mt-3 text-[16px] leading-[1.9] text-ink-soft">
            店舗ごとのデータの分離、通信の暗号化、カード情報を持たない決済など、IToguchiの安全への取り組みを、専門用語を使わずに説明しています。
          </p>
          <Link to="/security-guide" className={`mt-5 inline-flex items-center gap-1.5 ${textLink}`}>
            セキュリティへの取り組みを見る
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="rounded-xl bg-ink p-8 text-paper">
          <h2 className="text-[22px] font-black">導入前の相談は、LINEで</h2>
          <p className="mt-3 text-[16px] leading-[1.9] text-paper/80">
            IToguchiのLINE公式アカウントで、いつでも相談を受け付けています。友だち追加すると、自動返信・予約・会員証の動きもそのまま試せます。
          </p>
          <a
            href={LINE_DEMO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-paper px-6 py-3 text-[15px] font-bold text-ink hover:bg-primary-100"
          >
            <span className="size-2 rounded-full bg-[#06C755]" aria-hidden="true" />
            LINEで相談する
          </a>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 登録                                                                 */
/* ------------------------------------------------------------------ */

function SignUp() {
  return (
    <section id="auth" className="scroll-mt-20 bg-counter py-24">
      <div className={`${wrap} grid items-start gap-12 lg:grid-cols-[1fr_28rem]`}>
        <div className="max-w-lg">
          <h2 className="text-3xl font-black leading-snug tracking-[-0.02em] sm:text-4xl">まずは無料で始めてください</h2>
          <p className="mt-5 text-[17px] leading-[1.9] text-ink-soft">
            登録に必要なのはメールアドレスだけです。無料プランのまま使い続けることも、Proプランを30日間試すこともできます。
          </p>
          <ul className="mt-8 space-y-3 text-[16px]">
            {['登録は無料、メールアドレスだけで済みます', 'Proプランは30日間無料で試せます', '設定は管理画面の案内に沿って進められます'].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <Check className="size-5 shrink-0 text-primary-700" strokeWidth={3} aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <AuthPanel />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

export default function TopPage() {
  const location = useLocation()

  // 機能ページやモニターページから戻ってきたときは、指定の位置まで移動する
  useEffect(() => {
    const state = location.state as { scrollTo?: string } | null
    if (!state?.scrollTo) return
    if (state.scrollTo === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const target = document.getElementById(state.scrollTo)
    if (target) target.scrollIntoView({ behavior: 'smooth' })
  }, [location])

  return (
    <SiteShell scrollToTopOnNavigate={false}>
      <Hero />
      <Chores />
      <DayTimeline />
      <FeatureMenu />
      <ThemeShowcase />
      <Steps />
      <Industries />
      <Campaign />
      <Pricing />
      <Faq />
      <TrustAndContact />
      <SignUp />
    </SiteShell>
  )
}
