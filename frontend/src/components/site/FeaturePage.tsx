import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import SiteShell from './SiteShell'
import { LeaderRow, Slip, SlipNumbers } from './Receipt'
import TryTag from './TryTag'
import { FEATURES, LINE_DEMO_URL, PLANS, type FeatureSlug } from './siteData'
import { recordSiteClick } from '../../lib/sitePageViews'
import { btnInk, btnOutline, btnPrimary, wrap } from './ui'

export type Gain = { title: string; body: string; pro?: boolean }
export type SetupStep = { title: string; body: string; pro?: boolean }
export type PlanColumn = { name: string; items: string[] }

export type FeaturePageProps = {
  slug: FeatureSlug
  /** h1。改行位置は <br /> で指定する */
  title: ReactNode
  lead: string
  /** ファーストビュー右側。実際の画面か、それを元に組み直した動く画面 */
  hero: ReactNode
  /** ファーストビューの画面が操作して試せるときの一言。指定すると画面の上に「さわって試せます」の札を出す */
  heroTry?: ReactNode
  /** 横に広い画面（スマホとレシートを並べるものなど）。xl 未満では文章の下に全幅で置く */
  wideHero?: boolean
  /** 「お店にとって」の伝票に並べる項目 */
  gains: Gain[]
  /** 画面を大きく見せる節。複数並べられる */
  showcases?: { title: string; lead: ReactNode; body: ReactNode; tone?: 'paper' | 'counter'; /** 操作して試せる画面なら true */ interactive?: boolean }[]
  steps?: SetupStep[]
  plans?: { free: PlanColumn; pro: PlanColumn }
  /** plans を出さない機能で、無料/Proの範囲を一文で伝える */
  planNote?: string
  closing: { title: string; body: string }
}

const h2 = 'text-3xl font-black leading-snug tracking-[-0.02em] sm:text-4xl'
const leadText = 'mt-5 text-[17px] leading-[1.9] text-ink-soft'

export default function FeaturePage({ slug, title, lead, hero, heroTry, wideHero = false, gains, showcases = [], steps, plans, planNote, closing }: FeaturePageProps) {
  const feature = FEATURES.find((f) => f.slug === slug)!
  const others = FEATURES.filter((f) => f.slug !== slug)

  return (
    <SiteShell>
      {/* ファーストビュー */}
      <section className="bg-paper">
        <div className={`${wrap} grid min-w-0 grid-cols-1 items-center gap-12 pb-20 pt-8 lg:gap-14 lg:pb-24 lg:pt-12 ${wideHero ? 'xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'}`}>
          <div className="min-w-0">
            <nav aria-label="現在地" className="font-slip text-[13px] text-ink-soft">
              <Link to="/" state={{ scrollTo: 'features' }} className="hover:text-ink">
                機能
              </Link>
              <span className="mx-2" aria-hidden="true">/</span>
              <span className="font-bold text-ink">{feature.name}</span>
              <span className="ml-3 rounded border border-rule px-1.5 py-0.5 text-[11px] font-bold text-primary-800">{feature.plan}</span>
            </nav>
            <h1 className="mt-6 text-[2rem] font-black leading-[1.3] tracking-[-0.02em] sm:text-[2.6rem] sm:leading-[1.25]">{title}</h1>
            <p className="mt-6 max-w-xl text-[17px] leading-[1.9] text-ink-soft">{lead}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link to="/" state={{ scrollTo: 'auth', authMode: 'signup' }} onClick={() => recordSiteClick('signup')} className={btnPrimary}>
                無料で始める
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link to="/monitor" onClick={() => recordSiteClick('monitor')} className={btnOutline}>
                モニター特典を見る
              </Link>
              <a href={LINE_DEMO_URL} target="_blank" rel="noopener noreferrer" onClick={() => recordSiteClick('line_demo')} className={btnOutline}>
                <span className="size-2 rounded-full bg-[#06C755]" aria-hidden="true" />
                LINEで動きを試す
              </a>
            </div>
          </div>
          <div className="min-w-0">
            {heroTry && <TryTag className="mb-4">{heroTry}</TryTag>}
            {hero}
          </div>
        </div>
      </section>

      {/* お店にとって */}
      <section className="bg-counter py-24">
        <div className={`${wrap} grid items-start gap-12 lg:grid-cols-[0.8fr_1.2fr]`}>
          <div className="lg:sticky lg:top-28">
            <h2 className={h2}>
              お店にとって、
              <br />
              ここが楽になります
            </h2>
            <p className={leadText}>{feature.gain}。</p>
          </div>
          <Slip className="py-8">
            <div className="text-center">
              <p className="text-[16px] font-black">{feature.name}</p>
              <p className="mt-1 font-slip text-[12px] text-ink-soft">減る手間の明細</p>
            </div>
            <div className="slip-rule my-4" />
            <ul>
              {gains.map((g) => (
                <li key={g.title} className="border-b border-dashed border-rule py-5 last:border-b-0">
                  <div>
                    <p className="text-[18px] font-black leading-snug [word-break:auto-phrase]">
                      {g.title}
                      {g.pro && <span className="ml-2 inline-block -translate-y-0.5 rounded bg-ink px-1.5 py-0.5 align-middle font-slip text-[11px] font-bold text-paper">Pro</span>}
                    </p>
                    <p className="mt-2 text-[15px] leading-[1.85] text-ink-soft">{g.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Slip>
        </div>
      </section>

      {/* 画面を見る */}
      {showcases.map((s, i) => (
        <section key={s.title} className={`${(s.tone ?? (i % 2 === 0 ? 'paper' : 'counter')) === 'paper' ? 'bg-paper' : 'bg-counter'} py-24`}>
          <div className={wrap}>
            <div className="max-w-2xl">
              <h2 className={h2}>{s.title}</h2>
              <div className={leadText}>{s.lead}</div>
            </div>
            {s.interactive && <TryTag className="mt-10" />}
            <div className={s.interactive ? 'mt-5' : 'mt-12'}>{s.body}</div>
          </div>
        </section>
      ))}

      {/* 設定の流れ */}
      {steps && (
        <section className="bg-counter py-24">
          <div className={wrap}>
            <h2 className={h2}>設定の流れ</h2>
            <ol className="mt-12 grid gap-4 md:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="rounded-xl bg-paper p-7">
                  <span className="font-slip text-[44px] font-bold leading-none text-primary-600">{i + 1}</span>
                  <h3 className="mt-4 text-[19px] font-black leading-snug">
                    {s.title}
                    {s.pro && <span className="ml-2 inline-block -translate-y-0.5 rounded bg-ink px-1.5 py-0.5 align-middle font-slip text-[11px] font-bold text-paper">Pro</span>}
                  </h3>
                  <p className="mt-2.5 text-[15px] leading-[1.85] text-ink-soft">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* 無料とPro */}
      {(plans || planNote) && (
        <section className="bg-paper py-24">
          <div className={wrap}>
            <h2 className={h2}>無料プランとProプラン</h2>
            {planNote && <p className={`${leadText} max-w-2xl`}>{planNote}</p>}
            {plans && (
              <div className="mt-12 grid gap-8 md:grid-cols-2">
                {[
                  { ...plans.free, label: 'Free', price: PLANS.free.price, note: '登録してすぐ使えます' },
                  { ...plans.pro, label: 'Pro', price: PLANS.pro.price, note: '初回は30日間無料' },
                ].map((p) => (
                  // 料金の見せ方は、トップページの料金カードと同じにそろえる
                  <Slip key={p.label} className="py-8">
                    <p className="text-[22px] font-black">
                      {p.label}
                      <span className="ml-3 text-[15px] font-bold text-ink-soft">{p.name}</span>
                    </p>
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
                  </Slip>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 締め */}
      <section className="bg-ink py-20 text-paper">
        <div className={`${wrap} grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]`}>
          <div>
            <h2 className="text-3xl font-black leading-snug tracking-[-0.02em] sm:text-4xl">{closing.title}</h2>
            <p className="mt-5 max-w-xl text-[17px] leading-[1.9] text-paper/80">{closing.body}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link to="/" state={{ scrollTo: 'auth', authMode: 'signup' }} onClick={() => recordSiteClick('signup')} className={btnPrimary}>
                無料で始める
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <a href={LINE_DEMO_URL} target="_blank" rel="noopener noreferrer" onClick={() => recordSiteClick('line_demo')} className={`${btnInk} border-2 border-paper/30`}>
                <span className="size-2 rounded-full bg-[#06C755]" aria-hidden="true" />
                LINEで動きを試す
              </a>
              <Link to="/monitor" onClick={() => recordSiteClick('monitor')} className={`${btnInk} border-2 border-paper/30`}>
                モニター特典を見る
              </Link>
              <Link to="/" state={{ scrollTo: 'pricing' }} className={`${btnInk} border-2 border-paper/30`}>
                料金を見る
              </Link>
            </div>
          </div>
          <div className="rounded-xl bg-paper p-6 text-ink sm:p-7">
            <p className="font-slip text-[12px] tracking-widest text-ink-soft">ほかの機能</p>
            <ul className="mt-3">
              {others.map((f) => (
                <li key={f.slug}>
                  <Link to={f.path} className="group block rounded-md py-1 hover:bg-counter/70">
                    <LeaderRow
                      label={<span className="text-[15px] font-bold group-hover:underline">{f.name}</span>}
                      value={<span className="text-[13px] text-primary-800">{f.plan}</span>}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
