import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import SiteShell from '../components/site/SiteShell'
import HeroDemo from '../components/site/HeroDemo'
import { LeaderRow, Slip, Stamp } from '../components/site/Receipt'
import { FEATURES, LINE_DEMO_URL, SETUP_SERVICE_PRICE } from '../components/site/siteData'
import { recordSiteClick } from '../lib/sitePageViews'
import { btnOutline, btnPrimary, textLink, wrap } from '../components/site/ui'

/**
 * モニター特典の説明ページ。広告の着地点。
 *
 * 以前はここに独立した申込フォームがあったが、申込者が登録前で user_id を
 * 持たないため、設定代行（setup_service_orders.user_id が必須）へ引き渡せず、
 * 管理者がメールアドレスで手動照合する必要があった。
 * 申込は登録フローのプラン選択（インタビュー協力への同意）へ移し、
 * このページは訴求と導線に専念する。
 */

// 代行の範囲は「LINE公式アカウントと IToguchi の接続」まで。
// 公式アカウントの開設はオーナー権限を店舗が持つため、お客様ご自身で行っていただく。
// 予約枠・リッチメニューなどの運用設定は代行に含まない（SetupServiceModal と同じ範囲）。
const BENEFITS = [
  'Messaging APIの有効化をサポートします',
  '認証情報（チャネルID・シークレットなど）の取得と登録を代行します',
  'Webhook URLの設定と、LINE連携の完了確認まで行います',
  'やりとりはメールだけで済み、お店に伺う必要はありません',
]

const STEPS = [
  { title: 'アカウントを登録する', body: 'メールアドレスと店舗情報を入力してください。数分で終わります。' },
  { title: 'Proプランを選ぶ', body: '30日間は無料です。その画面で「インタビューに協力する」にチェックを入れてください。' },
  { title: '接続の設定はこちらで代行します', body: 'こちらからご連絡し、LINE公式アカウントとの接続設定を無料で行います。終わったらお知らせします。' },
]

// 「まずは試す」節。既存のLINE公式アカウント(@431cghfd)は
// line_accounts / auto_responses / stores.rich_menu_actions にデモとして機能する
// 設定が既に入っており（自動応答稼働中、リッチメニューに予約する/会員証あり）、
// 新規の実装なしでそのまま宣伝に使える。
const TRY_ITEMS = [
  { title: '自動応答', body: '気になることをメッセージで送ると、その場で自動の返事が届きます。' },
  { title: '予約', body: 'リッチメニューの「予約する」から、実際の予約の流れを試せます。' },
  { title: '会員証', body: 'リッチメニューの「会員証」から、会員証の見え方を確かめられます。' },
]

type MonitorCapacity = { remaining: number; isFull: boolean }

const h2 = 'text-3xl font-black leading-snug tracking-[-0.02em] sm:text-4xl'

export default function MonitorApplication() {
  const navigate = useNavigate()
  const [capacity, setCapacity] = useState<MonitorCapacity | null>(null)

  useEffect(() => {
    // API呼び出しが失敗した場合はバッジ自体を出さない（訴求のためにダミー値は出さない）。
    supabase.functions
      .invoke('get-monitor-capacity')
      .then(({ data, error }) => {
        if (error || !data) return
        setCapacity({ remaining: data.remaining, isFull: data.isFull })
      })
      .catch(() => {})
  }, [])

  // 登録フォームはトップページの #auth セクション。
  // 他の機能ページと同じ遷移方法に合わせる。
  const goToSignup = () => {
    // モニター申込導線への遷移。真の申込完了（登録後のインタビュー協力同意)
    // より手前だが、広告経由の見込み度を測る指標としてLeadを発火する。
    ;(window as unknown as { fbq?: (...args: unknown[]) => void }).fbq?.('track', 'Lead')
    // /monitor 経由の初訪問者はデフォルトのログインタブでは新規登録フォームに
    // 辿り着けないため、新規登録タブを既定表示にするフラグを渡す。
    navigate('/', { state: { scrollTo: 'auth', authMode: 'signup' } })
  }

  // LINE友だち追加は外部サイト(line.me)への遷移。新規タブで開くため
  // goToSignup と違いページ遷移とfbq発火が競合する心配はない。
  const trackDemoClick = () => {
    recordSiteClick('line_demo')
    ;(window as unknown as { fbq?: (...args: unknown[]) => void }).fbq?.('track', 'Lead')
  }

  const lineButton = (
    <a href={LINE_DEMO_URL} target="_blank" rel="noopener noreferrer" onClick={trackDemoClick} className={btnOutline}>
      <span className="size-2 rounded-full bg-[#06C755]" aria-hidden="true" />
      LINEを友だち追加して試す
    </a>
  )

  return (
    <SiteShell>
      {/* ファーストビュー */}
      <section className="bg-paper">
        <div className={`${wrap} grid min-w-0 grid-cols-1 items-center gap-12 pb-20 pt-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:pb-24 lg:pt-14`}>
          <div className="min-w-0">
            <h1 className="text-[2rem] font-black leading-[1.3] tracking-[-0.02em] sm:text-[2.6rem] sm:leading-[1.25]">
              <span className="inline-block">LINEとの接続は、</span>
              <span className="inline-block">こちらで設定します。</span>
              <span className="block">モニター店舗は無料です</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-[1.9] text-ink-soft">
              同じ質問に、何度も答えていませんか。あのお客様は、二度目も来てくれましたか。LINE公式アカウントにIToguchiをつなぐと、予約・自動応答・会員証・来店の記録をまとめて任せられます。残った記録は、次の接客に活かせます。
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={goToSignup} className={btnPrimary}>
                無料で登録して特典を受け取る
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
              {lineButton}
            </div>
            <p className="mt-5 text-[14px] leading-relaxed text-ink-soft">
              登録は無料です。初期設定代行（通常{SETUP_SERVICE_PRICE}）も無料になり、Proプランは30日間無料で試せます。
            </p>
          </div>

          {/* 引換券 */}
          <div className="mx-auto w-full max-w-sm">
            <Slip className="py-9">
              <p className="text-center text-[15px] font-black">モニター店舗 引換券</p>
              <p className="mt-1 text-center font-slip text-[12px] text-ink-soft">IToguchi</p>
              <div className="slip-rule my-5" />
              <LeaderRow label="LINE初期設定代行" value="1回" />
              <div className="mt-4 flex items-end justify-between">
                <span className="text-[14px] text-ink-soft">通常</span>
                <span className="relative font-slip text-[22px] font-bold text-ink-soft">
                  {SETUP_SERVICE_PRICE}
                  <motion.span
                    className="absolute left-[-4%] right-[-4%] top-1/2 h-[3px] origin-left -rotate-6 rounded bg-stamp"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.6, duration: 0.5, ease: [0.65, 0, 0.35, 1] }}
                    aria-hidden="true"
                  />
                </span>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <span className="text-[16px] font-bold">モニター店舗</span>
                <span className="font-slip text-[44px] font-bold leading-none">¥0</span>
              </div>
              <div className="slip-rule my-5" />
              <LeaderRow label="Proプラン" value="30日間無料" />
              {capacity && (
                <>
                  <div className="slip-rule my-5" />
                  {capacity.isFull ? (
                    <p className="text-center text-[15px] font-bold leading-relaxed">
                      おかげさまで、モニター店舗（先着<span className="font-slip">10</span>店舗）の受付は終わりました
                    </p>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-bold">先着<span className="font-slip">10</span>店舗</span>
                      <span className="flex items-baseline gap-1">
                        <span className="text-[14px]">残り</span>
                        <span className="font-slip text-[34px] font-bold leading-none text-primary-800">{capacity.remaining}</span>
                        <span className="text-[14px]">店舗</span>
                      </span>
                    </div>
                  )}
                </>
              )}
              <div className="mt-6 flex justify-end">
                <Stamp className="px-2 py-1.5 text-[15px]">特典</Stamp>
              </div>
            </Slip>
          </div>
        </div>
      </section>

      {/* まずは試す */}
      <section className="bg-counter py-24">
        {/* スマホとレシートを横に並べるには、右の列に36rem以上の幅がいる。足りない幅では文章の下に全幅で置く */}
        <div className={`${wrap} grid min-w-0 items-center gap-14 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]`}>
          <div className="min-w-0">
            <h2 className={h2}>登録の前に、LINEで動きを試せます</h2>
            <p className="mt-5 text-[17px] leading-[1.9] text-ink-soft">
              IToguchiのLINE公式アカウントを友だち追加すると、お客様の側から次の3つをそのまま試せます。会員登録もフォームの入力もいりません。
            </p>
            <ol className="mt-8 space-y-4">
              {TRY_ITEMS.map((t, i) => (
                <li key={t.title} className="grid grid-cols-[2.5rem_1fr] gap-3">
                  <span className="font-slip text-[28px] font-bold leading-none text-primary-600">{i + 1}</span>
                  <div>
                    <p className="text-[18px] font-black">{t.title}</p>
                    <p className="mt-1 text-[15px] leading-[1.8] text-ink-soft">{t.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-8">{lineButton}</div>
          </div>
          <HeroDemo />
        </div>
      </section>

      {/* 特典の内容 */}
      <section className="bg-paper py-24">
        <div className={`${wrap} grid gap-12 lg:grid-cols-[0.9fr_1.1fr]`}>
          <div>
            <h2 className={h2}>特典の内容</h2>
            <p className="mt-5 text-[17px] leading-[1.9] text-ink-soft">
              LINE初期設定代行（通常{SETUP_SERVICE_PRICE}）を、モニター店舗は無料で行います。LINE公式アカウントとIToguchiをつなぐ設定を、こちらで引き受けます。
            </p>
          </div>
          <div>
            <ul className="divide-y divide-dashed divide-ink/20 border-y border-dashed border-ink/20">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-4 py-4 text-[16px] leading-relaxed">
                  <Check className="mt-1 size-5 shrink-0 text-primary-700" strokeWidth={3} aria-hidden="true" />
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl bg-counter p-5 text-[14px] leading-[1.9] text-ink-soft">
              <p>代行するのは、LINE公式アカウントとIToguchiの接続設定までです。</p>
              <p className="mt-2">
                LINE公式アカウントの開設は、お店が管理者の権限を持つため、ご自身でお願いしています。開設は無料で数分で済み、手順はこちらからご案内します。
              </p>
              <p className="mt-2">予約の枠やリッチメニューなどの運用の設定は、管理画面からご自身で行ってください。</p>
            </div>
          </div>
        </div>
      </section>

      {/* 受け取り方と条件 */}
      <section className="bg-counter py-24">
        <div className={wrap}>
          <h2 className={h2}>受け取り方</h2>
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl bg-paper p-7">
                <span className="font-slip text-[44px] font-bold leading-none text-primary-600">{i + 1}</span>
                <h3 className="mt-4 text-[19px] font-black leading-snug">{s.title}</h3>
                <p className="mt-2.5 text-[15px] leading-[1.85] text-ink-soft">{s.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 grid gap-8 rounded-xl border-2 border-ink/80 p-7 sm:p-9 md:grid-cols-[auto_1fr]">
            <p className="text-[22px] font-black">条件はひとつです</p>
            <div>
              <p className="text-[17px] font-bold leading-relaxed">設定のしやすさなどについて、簡単なインタビューフォームに答えていただくこと。</p>
              <p className="mt-3 text-[15px] leading-[1.9] text-ink-soft">
                使いやすいサービスにしていくために、実際に使った方の声を大切にしています。「ここがわかりにくい」と言っていただけるのが、いちばん助かります。インタビューへの協力は任意です。協力しない場合もProプランはいつもどおり使えます（初期設定代行は通常の{SETUP_SERVICE_PRICE}になります）。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ほかの機能 */}
      <section className="bg-paper py-24">
        <div className={`${wrap} grid items-start gap-12 lg:grid-cols-[0.8fr_1.2fr]`}>
          <div>
            <h2 className={h2}>自動応答・予約・会員証のほかにも</h2>
            <p className="mt-5 text-[17px] leading-[1.9] text-ink-soft">
              顧客管理からメッセージ配信、リッチメニューまで、お店のLINEに必要な機能がそろっています。
            </p>
            <Link to="/security-guide" className={`mt-6 inline-flex items-center gap-1.5 ${textLink}`}>
              お客様のデータを守る仕組みを見る
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <Slip className="py-7">
            <ul>
              {FEATURES.map((f) => (
                <li key={f.slug}>
                  <Link to={f.path} className="group block rounded-md px-1 py-1 hover:bg-counter/70">
                    <LeaderRow
                      label={<span className="text-[16px] font-bold group-hover:underline">{f.name}</span>}
                      value={<span className="text-[13px] text-primary-800">{f.plan}</span>}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Slip>
        </div>
      </section>

      {/* 締め */}
      <section className="bg-ink py-20 text-paper">
        <div className={`${wrap} flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between`}>
          <div>
            <h2 className="text-3xl font-black leading-snug tracking-[-0.02em] sm:text-4xl">接続の設定は、任せてください</h2>
            <p className="mt-4 text-[17px] leading-[1.9] text-paper/80">登録は無料です。Proプランは30日間無料で試せます。</p>
          </div>
          <button type="button" onClick={goToSignup} className={`${btnPrimary} shrink-0`}>
            無料で登録して特典を受け取る
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    </SiteShell>
  )
}
