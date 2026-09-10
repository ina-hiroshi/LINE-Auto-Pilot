import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Gift,
  Sparkles,
  MessageCircle,
  Calendar,
  CreditCard,
  StickyNote,
  Star,
  Send,
  BarChart3,
  TrendingUp,
  Shield,
} from 'lucide-react'
import Logo from '../components/Logo'
import smartAutoChatImage from '../assets/smartautochat.jpg'
import yoyakuImage from '../assets/yoyaku.png'
import membersImage from '../assets/members.png'
import featureCustomersImage from '../assets/feature-customers.png'
import featurePointsImage from '../assets/feature-points.png'
import featureMessagingImage from '../assets/feature-messaging.png'
import featureRichMenuImage from '../assets/feature-richmenu.png'
import featureAiImage from '../assets/feature-ai.png'

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

// 「まずはお試しください」セクション。既存のLINE公式アカウント(@431cghfd)は
// line_accounts / auto_responses / stores.rich_menu_actions にデモとして機能する
// 設定が既に入っており（自動応答8件稼働中、リッチメニューに予約する/会員証あり）、
// 新規の実装なしでそのまま宣伝に使える。
const TRY_ITEMS = [
  {
    icon: MessageCircle,
    image: smartAutoChatImage,
    title: '自動応答チャット',
    body: '気になることをメッセージで送ると、その場で自動応答が返ってきます。',
  },
  {
    icon: Calendar,
    image: yoyakuImage,
    title: '予約体験',
    body: 'リッチメニューの「予約する」から、実際の予約の流れを体験できます。',
  },
  {
    icon: CreditCard,
    image: membersImage,
    title: 'デジタル会員証',
    body: 'リッチメニューの「会員証」から、会員証の見え方を確認できます。',
  },
]

const LINE_ADD_FRIEND_URL = 'https://line.me/R/ti/p/@431cghfd'

// 自動応答・予約・会員証は上の「まずはお試しください」で体験できるため、
// ここではそれ以外の機能を主役にする。管理画面のナビゲーション（Layout.tsx）と
// 名称を揃え、画像は各機能の詳細ページ（/feature/*）の実際のUIから切り出している。
const MORE_FEATURES = [
  {
    icon: StickyNote,
    image: featureCustomersImage,
    title: '顧客一覧・来店メモ',
    body: '来店履歴やメモをお客様ごとに記録。次の接客にすぐ活かせます。',
    link: '/feature/customers',
  },
  {
    icon: Star,
    image: featurePointsImage,
    title: 'ポイント管理',
    body: '来店・購入に応じてポイントを付与。スタンプカードにも切り替えられます。',
    link: '/feature/points',
  },
  {
    icon: Send,
    image: featureMessagingImage,
    title: 'メッセージ配信',
    body: '目的を書くだけでAIが文章を下書き。条件で絞って一斉配信できます。',
    link: '/feature/messaging',
  },
  {
    icon: TrendingUp,
    image: featureRichMenuImage,
    title: 'リッチメニュー',
    body: 'お店の写真をボタンごとに設定できる、オリジナルの入り口です。',
    link: '/feature/rich-menu',
  },
  {
    icon: BarChart3,
    image: featureAiImage,
    title: 'AIチャット',
    body: 'キーワードでは拾えない自由な質問にも、学習させた情報をもとにAIが会話します。',
    link: '/feature/ai',
  },
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
    // /monitor 経由の初訪問者はデフォルトのログインタブでは新規登録フォームに
    // 辿り着けないため、新規登録タブを既定表示にするフラグを渡す。
    navigate('/', { state: { scrollTo: 'auth', authMode: 'signup' } })
  }

  // LINE友だち追加は外部サイト(line.me)への遷移。新規タブで開くため
  // goToSignup と違いページ遷移とfbq発火が競合する心配はない。
  const trackDemoClick = () => {
    ;(window as unknown as { fbq?: (...args: unknown[]) => void }).fbq?.('track', 'Lead')
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
        <div className="max-w-4xl mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid md:grid-cols-2 gap-10 items-center"
          >
            <div className="text-center md:text-left">
              <span className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
                <Sparkles size={16} />
                モニター店舗募集中
              </span>
              <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
                お客様との「つながり」を、<br className="md:hidden" />
                IToguchiでつくりませんか？
              </h1>
              <p className="text-primary-100 mb-6 leading-relaxed">
                「同じ質問に、何度も答えていませんか。」「あのお客様、二度目は来ましたか。」
                その答えのカギは、お客様とのつながりです。
                LINE公式アカウントなら、予約・自動応答・会員証・来店履歴をまとめて自動で記録し、次の接客に活かせます。
              </p>
              <p className="text-primary-100 mb-8 leading-relaxed text-sm">
                その第一歩となるLINE公式アカウントの接続設定を、モニター店舗は
                <span className="font-bold text-white">初期設定代行（通常 ¥9,980）を無料</span>
                でお任せいただけます。
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
            </div>
            <div className="hidden md:block">
              <img
                src={smartAutoChatImage}
                alt="LINEでの自動応答の画面イメージ"
                className="rounded-2xl shadow-2xl w-full"
              />
            </div>
          </motion.div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-14">
        {/* まずはお試しください: 会員登録もフォーム記入も不要。既存のLINE公式アカウント
            (@431cghfd) は自動応答・予約・会員証がすべて稼働中のデモを兼ねている。 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-1">まずはお試しください</h2>
          <p className="text-sm text-slate-500 mb-6">
            登録は不要です。LINEを友だち追加するだけで、実際の画面を今すぐ確認できます。
          </p>

          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {TRY_ITEMS.map((item) => (
              <div key={item.title} className="rounded-xl border border-slate-100 overflow-hidden">
                <img src={item.image} alt={item.title} className="w-full h-32 object-cover" />
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <item.icon className="w-4 h-4 text-primary-600 shrink-0" />
                    <p className="font-bold text-slate-900 text-sm">{item.title}</p>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <a
              href={LINE_ADD_FRIEND_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={trackDemoClick}
              className="inline-flex items-center gap-2 bg-[#06C755] text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:brightness-95 transition"
            >
              <MessageCircle size={20} />
              LINEを友だち追加してお試しする
            </a>
            <p className="text-xs text-slate-500 mt-3">
              気になることはチャットで質問できます（自動応答）。実際の予約体験・会員証確認もできます。
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-1">自動応答・予約・会員証だけじゃありません</h2>
          <p className="text-sm text-slate-500 mb-6">
            顧客管理からメッセージ配信、リッチメニューまで。店舗運営に必要な機能がこれひとつで完結します。
          </p>

          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {MORE_FEATURES.map((f) => (
              <Link
                key={f.title}
                to={f.link}
                className="rounded-xl border border-slate-100 overflow-hidden block hover:shadow-md transition"
              >
                <div className="w-full h-32 bg-slate-100">
                  <img src={f.image} alt={f.title} className="w-full h-full object-contain p-2" />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <f.icon className="w-4 h-4 text-primary-600 shrink-0" />
                    <p className="font-bold text-slate-900 text-sm">{f.title}</p>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{f.body}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center">
            <Link
              to="/"
              state={{ scrollTo: 'features' }}
              className="inline-flex items-center gap-2 bg-white border border-primary-200 text-primary-700 px-6 py-3 rounded-xl font-bold hover:bg-primary-50 transition"
            >
              機能一覧の詳細を見る
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>

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
            より使いやすいサービスにしていくために、実際に使った方の声を大切にしています。
            「ここが分かりにくい」と言っていただけると、いちばん助かります。
            インタビューへのご協力は任意で、ご協力いただかない場合も
            Proプランは通常どおりご利用いただけます（初期設定代行は通常価格 ¥9,980 になります）。
          </p>
          <p className="text-xs text-slate-500 mt-4 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 shrink-0" />
            セキュリティ対策の詳細は
            <Link to="/security" className="text-primary-600 hover:text-primary-700 underline">
              セキュリティポリシー
            </Link>
            をご確認ください。
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
