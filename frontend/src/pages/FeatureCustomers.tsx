import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, ArrowLeft, ArrowRight, Search, QrCode, User, ChevronRight, Save, ClipboardList } from 'lucide-react'
import Logo from '../components/Logo'

const dummyRows = [
  { name: '山田 花子', line: '花子 Y', points: 1250, lastVisit: '2026/8/28', status: 'VIP' },
  { name: '佐藤 太郎', line: 'taro.s', points: 320, lastVisit: '2026/8/20', status: '会員' },
  { name: '田中 美咲', line: 'misaki_t', points: 80, lastVisit: '2026/7/15', status: '会員' },
]

export default function FeatureCustomers() {
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
                <Users className="w-4 h-4" />
                顧客一覧・来店メモ
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-slate-900 mb-4 sm:mb-6 leading-[1.15] tracking-tight">
                お客様の記録を、<br className="hidden sm:block" />
                <span className="text-primary-600">その場で確認</span>
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed mb-8">
                ポイント残高・最終来店日をひと目で一覧表示。詳細画面では施術メモも記録でき、
                担当が変わっても前回の内容をその場で確認しながら接客できます。
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
            className="bg-white rounded-2xl shadow-2xl border-4 border-white overflow-hidden max-w-4xl mx-auto"
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-lg font-bold text-gray-900">顧客一覧</h3>
                <p className="text-xs text-gray-500 mt-0.5">顧客を選択すると詳細ページで施術メモ・LINEメッセージを管理できます。</p>
              </div>
              <div className="flex gap-2">
                <div className="relative hidden sm:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <div className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-400 w-48">
                    名前で検索...
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold">
                  <QrCode className="w-4 h-4" />
                  会員証読取
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">本名</th>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">LINE名</th>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">ポイント残高</th>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">最終来店日</th>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dummyRows.map((row) => (
                    <tr key={row.name} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                            <User className="h-4 w-4 text-gray-500" />
                          </div>
                          <span className="font-medium text-gray-900">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{row.line}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900">{row.points.toLocaleString()} pt</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{row.lastVisit}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${row.status === 'VIP' ? 'bg-yellow-100 text-yellow-800' : 'bg-primary-100 text-primary-800'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-400">
                        <ChevronRight className="w-5 h-5 inline-block" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              施術メモは、来店ごとに残せます
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              顧客詳細ページの「施術メモ」タブでは、予約ごとに内容を記録できます。
            </p>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
          >
            <div className="flex flex-wrap justify-between gap-2 mb-3">
              <div>
                <p className="font-bold text-gray-900 text-sm">2026年8月28日（金）</p>
                <p className="text-xs text-gray-500 mt-0.5">カラー・トリートメント · 佐藤スタイリスト</p>
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-medium h-fit bg-green-100 text-green-700">完了</span>
            </div>
            <label className="block text-xs font-medium text-gray-500 mb-1">施術メモ</label>
            <div className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 min-h-[84px] bg-white">
              かゆみに敏感なので低刺激剤を使用。次回は集中トリートメントを提案する。
            </div>
            <div className="flex justify-end mt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg">
                <Save className="w-3 h-3" />
                保存
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              お店のメリット
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: ClipboardList, title: 'ゼロからの接客をなくす', description: '施術メモが残っているので、初めて対応するスタッフでも同じ質を保てます。' },
              { icon: Users, title: 'ポイント・来店日をひと目で', description: '一覧画面でポイント残高と最終来店日を確認でき、フォローの判断がしやすくなります。' },
              { icon: QrCode, title: '会員証をその場で読み取り', description: 'お客様のLINE会員証をQRコードで読み取り、すぐに詳細ページを開けます。' },
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
            顧客管理も、LINEひとつで
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
