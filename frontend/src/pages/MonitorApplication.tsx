import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Gift, Sparkles } from 'lucide-react'
import Logo from '../components/Logo'

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
  'LINE Developersでのチャネル作成をサポートします',
  '認証情報（チャネルID・シークレット等）の取得と登録を代行します',
  'Webhook URLの設定と、LINE連携の完了確認まで行います',
  'メールのやり取りだけで完結します（店舗へ伺う必要はありません）',
]

const STEPS = [
  { n: 1, title: 'アカウントを登録', body: 'メールアドレスと店舗情報をご入力ください。数分で終わります。' },
  { n: 2, title: 'Proプランを選択', body: '30日間は無料です。その画面で「インタビューに協力する」にチェックを入れてください。' },
  { n: 3, title: '接続設定はこちらで代行', body: 'ご連絡のうえ、LINE公式アカウントとの接続設定を無償で行います。完了後にご案内します。' },
]

export default function MonitorApplication() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // 登録フォームはトップページの #auth セクション。
  // 他の機能ページと同じ遷移方法に合わせる。
  const goToSignup = () => {
    // モニター申込導線への遷移。真の申込完了（登録後のインタビュー協力同意)
    // より手前だが、広告経由の見込み度を測る指標としてLeadを発火する。
    ;(window as unknown as { fbq?: (...args: unknown[]) => void }).fbq?.('track', 'Lead')
    navigate('/', { state: { scrollTo: 'auth' } })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <Logo className="h-8" />
          </Link>
          <Link to="/" className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft size={16} />
            トップへ戻る
          </Link>
        </div>
      </header>

      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <Sparkles size={16} />
              モニター店舗募集中
            </span>
            <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
              初期設定代行 ¥9,980 を<br className="md:hidden" />無料で
            </h1>
            <p className="text-primary-100 mb-8 leading-relaxed">
              LINEでの予約受付を始めたいけれど、公式アカウントとの接続設定でつまずいてしまう。
              <br className="hidden md:inline" />
              その接続作業をこちらで代行します。お願いするのは、使ってみた感想だけです。
            </p>
            <button
              onClick={goToSignup}
              className="inline-flex items-center gap-2 bg-white text-primary-700 px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-primary-50 transition"
            >
              無料で登録して特典を受け取る
              <ArrowRight size={20} />
            </button>
            <p className="text-primary-200 text-xs mt-4">
              登録は無料です。Proプランは30日間無料でお試しいただけます。
            </p>
          </motion.div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-14">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 mb-10">
          <div className="flex items-center gap-3 mb-5">
            <Gift className="w-6 h-6 text-primary-600" />
            <h2 className="text-xl font-bold text-slate-900">特典の内容</h2>
          </div>
          <p className="text-3xl font-bold text-primary-700 mb-1">LINE初期設定代行が無料</p>
          <p className="text-sm text-slate-500 mb-6">通常 ¥9,980 のところ、モニター店舗は無償です。</p>
          <ul className="space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-slate-700">
                <Check className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs text-slate-500 leading-relaxed">
            ※ 代行の範囲はLINE公式アカウントとIToguchiの接続設定までです。
            LINE公式アカウントの開設は、管理権限をお客様が保持していただくためご自身で行っていただきます（無料・数分で作成できます。手順はご案内します）。
            予約枠やリッチメニューなどの運用設定は、管理画面からお客様ご自身で設定していただきます。
          </p>
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-5">受け取り方</h2>
        <div className="space-y-4 mb-10">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-white rounded-2xl border border-slate-200 p-5 flex gap-4">
              <span className="shrink-0 w-8 h-8 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center">
                {s.n}
              </span>
              <div>
                <p className="font-bold text-slate-900 mb-1">{s.title}</p>
                <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-4">条件</h2>
          <p className="text-slate-700 leading-relaxed mb-3">
            <span className="font-bold">設定のしやすさなどについて、簡単なインタビューフォームにご回答いただくこと。</span>
            これだけです。
          </p>
          <p className="text-sm text-slate-500 leading-relaxed">
            まだ導入実績がないサービスのため、実際に使った方の声が必要です。
            「ここが分かりにくい」と言っていただけると、いちばん助かります。
            インタビューへのご協力は任意で、ご協力いただかない場合も
            Proプランは通常どおりご利用いただけます（初期設定代行は通常価格 ¥9,980 になります）。
          </p>
        </div>

        <div className="text-center">
          <button
            onClick={goToSignup}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-primary-200 hover:bg-primary-700 transition"
          >
            無料で登録して特典を受け取る
            <ArrowRight size={20} />
          </button>
        </div>
      </section>
    </div>
  )
}
