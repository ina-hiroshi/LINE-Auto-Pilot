import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Grid, ArrowLeft, ArrowRight, MousePointerClick, Smartphone, MessageSquare, CreditCard, Layout, ImageIcon, Upload, Info } from 'lucide-react'
import Logo from '../components/Logo'
import yoyakuImage from '../assets/yoyaku.png'
import membersImage from '../assets/members.png'

// frontend/src/features/line-settings/constants.ts の RICH_MENU_LAYOUTS と一致させている。
const LAYOUTS = [
  { id: 'large_4', name: '標準 (2×2)', slots: 4 },
  { id: 'large_6', name: '多機能 (3×2)', slots: 6 },
  { id: 'compact_2', name: 'コンパクト (2列)', slots: 2 },
]

// frontend/src/constants/designThemes.ts の DESIGN_THEMES と実際のプレビュー配色
// （RichMenuTab.tsx の template_id 分岐）に合わせている。
const THEMES = [
  { id: 'simple', label: 'シンプル', outer: '#e5e7eb', slot: '#ffffff', text: '#1F2937', locked: false },
  { id: 'pop', label: 'ポップ', outer: '#00B8A9', slot: '#f0fdfa', text: '#0e7490', locked: true },
  { id: 'dark', label: 'ダーク', outer: '#334155', slot: '#1e293b', text: '#ffffff', locked: true },
  { id: 'elegant', label: 'エレガント', outer: '#D4C4B7', slot: '#F5F5F0', text: '#5D4037', locked: true },
]

// 「ボタン別背景画像」機能（RichMenuTab.tsx）を反映し、一部のスロットには
// 実際に店舗が設定できる写真を、残りはアイコン表示のままにして両方の見え方を示す。
const SLOTS = [
  { icon: Smartphone, label: '予約する', image: yoyakuImage },
  { icon: MessageSquare, label: 'メッセージ入力', image: null },
  { icon: CreditCard, label: '会員証', image: membersImage },
  { icon: Grid, label: 'クーポン', image: null },
]

export default function FeatureRichMenu() {
  const location = useLocation()
  const [activeTheme, setActiveTheme] = useState('pop')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  const theme = THEMES.find((t) => t.id === activeTheme) ?? THEMES[0]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="bg-white/90 backdrop-blur-md fixed w-full z-50 border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center gap-3">
              <Logo className="h-10 md:h-16 w-auto" />
            </Link>
            <nav className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary-600 transition">
                <ArrowLeft className="w-4 h-4" />
                トップに戻る
              </Link>
              <Link to="/" state={{ scrollTo: 'auth' }} className="px-5 py-2.5 bg-primary-600 text-white rounded-full text-sm font-medium hover:bg-primary-700 transition shadow-md hover:shadow-lg">
                無料で始める
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <section className="pt-32 pb-16 lg:pt-40 lg:pb-24 overflow-hidden relative px-4">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-primary-50/50 blur-3xl"></div>
        </div>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="lg:w-1/2 text-left w-full lg:sticky lg:top-32"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-primary-50 border border-primary-100 text-primary-600 text-sm font-semibold">
                <Grid className="w-4 h-4" />
                リッチメニュー
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-slate-900 mb-4 sm:mb-6 leading-[1.15] tracking-tight">
                好きな写真を置くだけで、<br />
                <span className="text-primary-600">お店だけの入り口に</span>
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-slate-600 mb-6 sm:mb-8 max-w-2xl leading-relaxed">
                店内やメニューの写真をボタンごとにアップロードするだけ。難しい画像加工は不要です。
                予約・メッセージ・会員証などの行き先も自由に設定でき、変更はすぐプレビューに反映されます。
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Link to="/" state={{ scrollTo: 'auth' }} className="px-6 sm:px-8 py-3 sm:py-4 bg-primary-600 text-white rounded-full font-bold hover:bg-primary-700 transition shadow-lg hover:shadow-primary-200 flex items-center justify-center gap-2 group text-sm sm:text-base">
                  無料で始める
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              <div className="mt-10 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Layout size={16} /> レイアウト
                </h3>
                <div className="grid grid-cols-3 gap-2 mb-6">
                  {LAYOUTS.map((l) => (
                    <div key={l.id} className={`rounded-lg border-2 p-2 text-center text-[11px] font-medium ${l.id === 'large_4' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>
                      {l.name}
                    </div>
                  ))}
                </div>
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <ImageIcon size={16} /> ボタン別背景画像
                </h3>
                <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <Info size={14} className="text-blue-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-800">
                      各ボタンに個別の画像を設定して、オリジナルのリッチメニューを作成できます。
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                    <img src={yoyakuImage} alt="予約するの背景" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                      <span className="px-2 py-0.5 bg-white text-gray-700 rounded text-[10px]">変更</span>
                      <span className="px-2 py-0.5 bg-red-500 text-white rounded text-[10px]">削除</span>
                    </div>
                  </div>
                  <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center hover:border-primary-400 hover:bg-gray-50 transition">
                    <Upload size={16} className="text-gray-400 mb-0.5" />
                    <span className="text-[9px] text-gray-500">画像追加</span>
                  </div>
                  <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center hover:border-primary-400 hover:bg-gray-50 transition">
                    <Upload size={16} className="text-gray-400 mb-0.5" />
                    <span className="text-[9px] text-gray-500">画像追加</span>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">登録した画像は、ボタンの比率に合わせて自動で中央トリミングされます。</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:w-1/2 w-full"
            >
              <div className="bg-gray-800 rounded-[3rem] p-4 border-4 border-gray-900 shadow-2xl max-w-[320px] mx-auto">
                <div className="bg-white rounded-[2rem] overflow-hidden h-[600px] relative flex flex-col">
                  <div className="bg-slate-100 p-4 border-b flex items-center justify-between shrink-0">
                    <div className="w-4 h-4 rounded-full bg-slate-300" />
                    <div className="w-20 h-2 rounded-full bg-slate-300" />
                    <div className="w-4 h-4 rounded-full bg-slate-300" />
                  </div>
                  <div className="flex-1 bg-[#8C9DA9] p-4 overflow-hidden relative">
                    <div className="flex gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full bg-white shrink-0" />
                      <div className="bg-white p-2 rounded-lg rounded-tl-none text-xs max-w-[70%] shadow-sm">
                        いらっしゃいませ！<br />
                        下のメニューからご予約いただけます。
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 border-t border-gray-200">
                    <div className="bg-gray-100 px-4 py-1 flex justify-between items-center text-[10px] text-gray-500 border-b border-gray-200">
                      <span>メニュー ▲</span>
                      <span>キーボード</span>
                    </div>
                    <div
                      className="w-full relative grid grid-cols-2 grid-rows-2"
                      style={{ aspectRatio: '1686 / 1086', backgroundColor: theme.outer }}
                    >
                      {SLOTS.map((s) => (
                        <div
                          key={s.label}
                          className="relative flex flex-col items-center justify-center gap-1 overflow-hidden"
                          style={{ backgroundColor: theme.slot }}
                        >
                          {s.image && (
                            <img src={s.image} alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
                          )}
                          <s.icon
                            size={20}
                            className="relative z-10"
                            style={{ color: s.image ? '#FFFFFF' : theme.text, filter: s.image ? 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.5))' : undefined }}
                          />
                          <span
                            className="relative z-10 text-[10px] font-bold"
                            style={{ color: s.image ? '#FFFFFF' : theme.text, filter: s.image ? 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.5))' : undefined }}
                          >
                            {s.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-center gap-3 mt-5">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTheme(t.id)}
                    className="flex flex-col items-center gap-1"
                  >
                    <span
                      className={`w-8 h-8 rounded-full border-2 ${activeTheme === t.id ? 'border-primary-600' : 'border-white'} shadow`}
                      style={{ backgroundColor: t.outer }}
                    />
                    <span className="text-[10px] text-gray-500">{t.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-slate-500 mt-4">※実際の表示は端末により多少異なる場合があります</p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              お店のメリット
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: ImageIcon, title: '好きな写真をそのまま設置', description: 'お店の外観やメニュー写真をアップロードするだけ。難しい画像加工は不要です。' },
              { icon: MousePointerClick, title: '迷わせない入り口', description: '予約やメッセージへの導線が常に見えるので、お客様が迷いません。' },
              { icon: Grid, title: 'レイアウト・テーマも変更できる', description: '2×2・3×2・コンパクト表示など、ボタン数や雰囲気に合わせて選べます（Pro）。' },
            ].map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl p-8 hover:shadow-lg transition-all border border-slate-100"
              >
                <div className="w-14 h-14 rounded-xl bg-primary-100 flex items-center justify-center mb-6">
                  <b.icon className="w-7 h-7 text-primary-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{b.title}</h3>
                <p className="text-slate-600 leading-relaxed">{b.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-linear-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">
            お店の入り口を、LINEひとつで
          </h2>
          <p className="text-primary-100 text-lg mb-10 max-w-2xl mx-auto">
            無料プランからご利用いただけます。
          </p>
          <Link
            to="/"
            state={{ scrollTo: 'auth' }}
            className="inline-flex items-center gap-2 px-10 py-4 bg-white text-primary-700 rounded-full font-bold hover:bg-primary-50 transition shadow-lg group"
          >
            無料で始める
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <Link to="/" className="text-xl font-bold text-white">IToguchi</Link>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <Link to="/feature/auto-response" className="hover:text-white transition">スマート自動応答</Link>
              <Link to="/feature/reservation" className="hover:text-white transition">かんたん予約管理</Link>
              <Link to="/feature/membership" className="hover:text-white transition">デジタル会員証</Link>
              <Link to="/feature/customers" className="hover:text-white transition">顧客一覧・来店メモ</Link>
              <Link to="/feature/points" className="hover:text-white transition">ポイント管理</Link>
              <Link to="/feature/messaging" className="hover:text-white transition">メッセージ配信</Link>
              <Link to="/feature/rich-menu" className="hover:text-white transition">リッチメニュー</Link>
              <Link to="/feature/ai" className="hover:text-white transition">AIチャット</Link>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-500 text-sm">
            © 2025 IToguchi. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
