import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Shield,
  ShieldCheck,
  Lock,
  CreditCard,
  KeyRound,
  Link2,
  FileCheck,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import Logo from '../components/Logo'

const BENEFITS = [
  {
    icon: Lock,
    title: '他の店舗からは見えません',
    description:
      'お客様の名前・予約情報・メッセージのやり取りは、店舗ごとに厳密に分離して保管しています。他店のオーナーがあなたのデータを見ることはできません。',
  },
  {
    icon: ShieldCheck,
    title: '通信はすべて暗号化',
    description:
      '管理画面とサーバー間のやり取りは、すべてHTTPS（TLS）で暗号化。第三者に盗み見られたり書き換えられたりする心配はありません。',
  },
  {
    icon: CreditCard,
    title: 'カード情報は一切保管しません',
    description:
      '決済はStripe社が処理します。クレジットカード番号がIToguchiのサーバーに保存されることはありません。',
  },
  {
    icon: KeyRound,
    title: '登録時に本人確認',
    description:
      'アカウント作成時には確認コードによる本人確認を実施。パスワードも暗号化して安全に保管しています。',
  },
  {
    icon: Link2,
    title: 'LINE連携もなりすまし対策済み',
    description:
      'LINEからの通知が本物かどうかを毎回検証しています。偽のメッセージでシステムを操作されることはありません。',
  },
  {
    icon: FileCheck,
    title: '予約の変更もご本人だけ',
    description:
      '予約のキャンセル・変更には、操作する権限を厳密にチェック。URLを知っているだけで他人の予約を操作することはできません。',
  },
]

export default function SecurityGuide() {
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
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-primary-50 border border-primary-100 text-primary-600 text-sm font-semibold">
              <Shield className="w-4 h-4" />
              セキュリティへの取り組み
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-slate-900 mb-4 sm:mb-6 leading-[1.15] tracking-tight">
              大切なお客様の情報を、<br className="hidden sm:block" />
              <span className="text-primary-600">しっかり守ります</span>
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed mb-8">
              IToguchiは、店舗ごとにデータを厳密に分離し、通信もすべて暗号化しています。
              わかりやすく、その仕組みをご紹介します。
            </p>
            <Link to="/" state={{ scrollTo: 'auth' }} className="inline-flex px-6 sm:px-8 py-3 sm:py-4 bg-primary-600 text-white rounded-full font-bold hover:bg-primary-700 transition shadow-lg hover:shadow-primary-200 items-center justify-center gap-2 group text-sm sm:text-base">
              無料で始める
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              6つの取り組み
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              むずかしい設定は不要です。安心して使っていただくために、裏側でこれだけの対策をしています。
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {BENEFITS.map((b, i) => (
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

      <section className="py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-lg font-bold text-slate-900 mb-2">Googleカレンダー連携について</h3>
            <p className="text-slate-600 leading-relaxed">
              取得した予定の情報は、予約管理以外の目的には使用せず、第三者に提供することもありません。
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-lg font-bold text-slate-900 mb-2">もしものときも</h3>
            <p className="text-slate-600 leading-relaxed">
              万が一セキュリティ上の問題が発生した場合も、影響範囲を速やかに確認し、必要な方には個別にご連絡のうえ、再発防止に取り組みます。
            </p>
          </motion.div>
          <p className="text-sm text-slate-500">
            技術的な詳細は<Link to="/security" className="text-primary-600 hover:text-primary-700 underline">セキュリティポリシー</Link>をご覧ください。
          </p>
        </div>
      </section>

      <section className="py-20 bg-linear-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">
            安心して、LINE運用をお任せください
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

      <footer className="bg-slate-900 text-slate-300 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl font-bold text-white tracking-tight">IToguchi</span>
              </div>
              <p className="text-slate-400 max-w-sm leading-relaxed">
                お店とお客様を繋ぐ、確かな糸ぐち。<br />
                LINE運用の自動化で、業務効率化と売上アップを実現します。
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-6">サービス</h4>
              <ul className="space-y-4">
                <li><a href="/#features" className="hover:text-white transition">機能一覧</a></li>
                <li><a href="/#pricing" className="hover:text-white transition">料金プラン</a></li>
                <li><a href="#" className="hover:text-white transition">導入事例</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-6">サポート</h4>
              <ul className="space-y-4">
                <li><a href="https://line.me/R/ti/p/@431cghfd" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">お問い合わせ</a></li>
                <li>
                  <Link
                    to="/terms"
                    className="hover:text-white transition"
                    onClick={() => window.scrollTo(0, 0)}
                  >
                    利用規約
                  </Link>
                </li>
                <li>
                  <Link
                    to="/privacy"
                    className="hover:text-white transition"
                    onClick={() => window.scrollTo(0, 0)}
                  >
                    プライバシーポリシー
                  </Link>
                </li>
                <li>
                  <Link
                    to="/specified-commercial-transactions"
                    className="hover:text-white transition"
                    onClick={() => window.scrollTo(0, 0)}
                  >
                    特定商取引法に基づく表記
                  </Link>
                </li>
                <li>
                  <Link
                    to="/security"
                    className="hover:text-white transition"
                    onClick={() => window.scrollTo(0, 0)}
                  >
                    セキュリティポリシー
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-16 pt-8 text-center text-slate-500 text-sm">
            © 2025 IToguchi. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
