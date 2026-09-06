import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Send, ArrowLeft, ArrowRight, Users, Sparkles, BarChart2, Check } from 'lucide-react'
import Logo from '../components/Logo'

const STEP_LABELS = ['配信対象', 'メッセージ', '確認・配信']
const TONE_OPTIONS = ['親しみやすく', '丁寧に', 'カジュアルに']

export default function FeatureMessaging() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

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
          <div className="text-center max-w-3xl mx-auto mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-primary-50 border border-primary-100 text-primary-600 text-sm font-semibold">
                <Send className="w-4 h-4" />
                メッセージ配信
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-slate-900 mb-4 sm:mb-6 leading-[1.15] tracking-tight">
                文章はAIに任せて、<br className="hidden sm:block" />
                <span className="text-primary-600">配信はワンタップ</span>
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed mb-8">
                「久しぶりのお客様に再来店してほしい」など目的を書くだけで、AIが文章の候補を作成。
                登録者全員にも、条件で絞った一部の方にも、LINEで一斉配信できます。
              </p>
              <Link to="/" state={{ scrollTo: 'auth' }} className="inline-flex px-6 sm:px-8 py-3 sm:py-4 bg-primary-600 text-white rounded-full font-bold hover:bg-primary-700 transition shadow-lg hover:shadow-primary-200 items-center justify-center gap-2 group text-sm sm:text-base">
                無料で始める
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl border-4 border-white overflow-hidden max-w-2xl mx-auto p-5"
          >
            <ol className="flex items-center gap-2 mb-5 text-xs">
              {STEP_LABELS.map((label, index) => (
                <li key={label} className="flex items-center gap-2">
                  <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${index === 1 ? 'bg-primary-600 text-white font-bold' : index < 1 ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-500'}`}>
                    <span>{index + 1}</span>
                    {label}
                  </span>
                  {index < STEP_LABELS.length - 1 && <span className="text-gray-300">›</span>}
                </li>
              ))}
            </ol>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary-600" />
                <h3 className="text-sm font-bold text-gray-900">AIに下書きを作ってもらう</h3>
                <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full font-medium">Proプラン以上</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">配信の目的</label>
                  <div className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">久しぶりのお客様に再来店してほしい</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">盛り込みたい内容（任意）</label>
                  <div className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-400">例: 今月末まで、カット20%オフ</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">文章のトーン</label>
                  <div className="flex gap-2">
                    {TONE_OPTIONS.map((label, i) => (
                      <span
                        key={label}
                        className={`px-3 py-1 rounded-full text-xs border ${i === 0 ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-300 bg-white text-gray-600'}`}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold">
                  <Sparkles className="w-4 h-4" />
                  文章を作ってもらう
                </span>
                <div className="pt-2 space-y-2">
                  <p className="text-xs text-gray-500">使いたい案を選ぶと下の本文に入ります。そのあと自由に手直しできます。</p>
                  <div className="w-full text-left p-3 border border-primary-400 bg-primary-50 rounded-lg">
                    <div className="text-xs text-gray-400 mb-1">案1</div>
                    <div className="text-sm text-gray-800">ご無沙汰しております！お元気でお過ごしでしょうか。次回のご来店をスタッフ一同心よりお待ちしております🌿</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
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
              { icon: Sparkles, title: '文章に悩まなくていい', description: '目的とトーンを選ぶだけで、AIが配信文の候補を複数提案します。' },
              { icon: Users, title: 'セグメント配信で無駄打ちしない', description: '来店頻度や利用メニューで絞り込み、必要な方にだけお知らせできます。' },
              { icon: BarChart2, title: '配信履歴で振り返る', description: '過去の配信内容と結果を残せるので、次回の改善につなげられます。' },
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
            お知らせも、LINEひとつで
          </h2>
          <p className="text-primary-100 text-lg mb-10 max-w-2xl mx-auto">
            <Check className="inline w-5 h-5 mb-1 mr-1" />
            配信そのものは無料プランからご利用いただけます。
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
