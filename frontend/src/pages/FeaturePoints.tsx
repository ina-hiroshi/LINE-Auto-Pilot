import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, ArrowLeft, ArrowRight, Gift, Repeat, Award, CreditCard } from 'lucide-react'
import Logo from '../components/Logo'

export default function FeaturePoints() {
  const location = useLocation()
  const [tab, setTab] = useState<'add' | 'use'>('add')

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
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="lg:w-1/2 text-left w-full"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-primary-50 border border-primary-100 text-primary-600 text-sm font-semibold">
                <Star className="w-4 h-4" />
                ポイント管理
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-slate-900 mb-4 sm:mb-6 leading-[1.15] tracking-tight">
                紙のカードは、<br />
                <span className="text-primary-600">もう要りません</span>
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-slate-600 mb-6 sm:mb-8 max-w-2xl leading-relaxed">
                顧客詳細ページからワンタップでポイントを付与・利用。スタンプカード運用にも切り替えられます。
                お客様はLINEの会員証を見せるだけ、店舗側は数字を入れて「実行」を押すだけです。
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Link to="/" state={{ scrollTo: 'auth' }} className="px-6 sm:px-8 py-3 sm:py-4 bg-primary-600 text-white rounded-full font-bold hover:bg-primary-700 transition shadow-lg hover:shadow-primary-200 flex items-center justify-center gap-2 group text-sm sm:text-base">
                  無料で始める
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:w-1/2 w-full"
            >
              <div className="bg-white rounded-2xl shadow-2xl border-4 border-white overflow-hidden p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4 text-primary-600" />
                  <p className="text-xs text-gray-500">顧客詳細 / 山田 花子 様</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <h4 className="text-sm font-bold text-gray-900 mb-3">ポイント管理</h4>
                  <div className="space-y-4">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-primary-600 text-3xl">1,250</span>
                      <span className="text-sm text-gray-500">pt</span>
                    </div>
                    <div className="flex p-1 bg-gray-200 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setTab('add')}
                        className={`flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${tab === 'add' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}
                      >
                        <Gift className="w-4 h-4" />
                        付与する
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab('use')}
                        className={`flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${tab === 'use' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
                      >
                        <CreditCard className="w-4 h-4" />
                        利用する
                      </button>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                      <label className="block text-xs font-medium text-gray-500 mb-2">
                        {tab === 'add' ? '付与するポイント数' : '利用するポイント数'}
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <div className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-md text-sm text-gray-700">100</div>
                          <span className="absolute right-3 top-2.5 text-xs text-gray-400">pt</span>
                        </div>
                        <span className={`px-4 py-2 rounded-md text-white text-sm font-bold shadow-sm ${tab === 'add' ? 'bg-primary-600' : 'bg-red-500'}`}>
                          実行
                        </span>
                      </div>
                      <p className="mt-2 text-[10px] text-gray-400">
                        {tab === 'add' ? '※ 来店時やキャンペーン等でポイントを付与します' : '※ 特典交換などでポイントを消費します'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
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
              { icon: Repeat, title: '再来店のきっかけに', description: 'ポイントやスタンプが貯まっていると、次の来店の後押しになります。' },
              { icon: Gift, title: '紙のカード運用から解放', description: '紛失・忘れの心配がなく、店舗側の集計の手間もなくなります。' },
              { icon: Award, title: 'スタンプカードにも切替可能', description: 'ポイント制・スタンプ制のどちらでも、同じ画面で運用できます。' },
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
            ポイントカードも、LINEひとつで
          </h2>
          <p className="text-primary-100 text-lg mb-10 max-w-2xl mx-auto">
            基本機能は無料プランからご利用いただけます。
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
