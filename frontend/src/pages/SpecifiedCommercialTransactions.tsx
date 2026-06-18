import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Building2, User, MapPin, Phone, Mail, CreditCard, DollarSign, Calendar, XCircle, FileText } from 'lucide-react'
import Logo from '../components/Logo'

const SpecifiedCommercialTransactions: React.FC = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-primary-100 selection:text-primary-900">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md fixed w-full z-50 border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center gap-3">
              <Logo className="h-10 md:h-16 w-auto" />
            </Link>
            <nav className="flex space-x-8 items-center">
              <Link to="/" className="text-sm font-medium text-slate-600 hover:text-primary-600 transition">
                トップページへ戻る
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Title Section */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">特定商取引法に基づく表記</h1>
            <p className="text-slate-500">最終更新日: 2025年12月31日</p>
          </div>

          <div className="space-y-8">
            {/* Introduction */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <p className="text-slate-600 leading-relaxed mb-4">
                IToguchi（以下「当サービス」といいます）は、特定商取引法に基づき、以下のとおり表記いたします。
              </p>
              <div className="bg-primary-50 rounded-xl p-6 border border-primary-100 mt-4">
                <h3 className="font-bold text-slate-900 mb-2">サービス概要</h3>
                <p className="text-sm text-slate-700 leading-relaxed">
                  IToguchiは、店舗運営を支援するSaaS型の予約管理システムです。LINE公式アカウントを通じて、予約管理、自動応答、顧客管理、デジタル会員証などの機能を提供します。店舗オーナーがLINEひとつで予約・会員証・接客を自動化し、本業に集中できる環境を提供することを目的としています。
                </p>
              </div>
            </div>

            {/* Section 1: 販売業者名 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <Building2 className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">販売業者名</h2>
              </div>
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                <p className="text-slate-700 font-medium text-lg">
                  個人事業主 伊奈洋
                </p>
              </div>
            </section>

            {/* Section 2: 運営責任者 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <User className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">運営責任者</h2>
              </div>
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                <p className="text-slate-700 font-medium text-lg">
                  伊奈洋
                </p>
              </div>
            </section>

            {/* Section 3: 所在地 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <MapPin className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">所在地</h2>
              </div>
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                <p className="text-slate-700 font-medium text-lg">
                  〒160-0023<br />
                  東京都新宿区西新宿3丁目3番13号西新宿水間ビル2F
                </p>
              </div>
            </section>

            {/* Section 4: 電話番号・メールアドレス */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <Phone className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">電話番号・メールアドレス</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    電話番号
                  </h3>
                  <p className="text-slate-700 font-medium">
                    090-2237-2872
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    メールアドレス
                  </h3>
                  <a href="mailto:itoguchi.app@gmail.com" className="text-slate-700 font-medium hover:text-primary-600 transition-colors">
                    itoguchi.app@gmail.com
                  </a>
                </div>
              </div>
            </section>

            {/* Section 5: 販売価格 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <DollarSign className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">販売価格</h2>
              </div>
              <p className="text-slate-600 mb-4">サービス料金は以下のとおりです。詳細は<Link to="/" onClick={() => setTimeout(() => { const element = document.getElementById('pricing'); if (element) element.scrollIntoView({ behavior: 'smooth' }); }, 100)} className="text-primary-600 hover:underline font-medium">料金プランページ</Link>をご確認ください。</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-2">Freeプラン</h3>
                  <p className="text-2xl font-bold text-primary-600 mb-1">¥0</p>
                  <p className="text-sm text-slate-600">/月（税込）</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-2">Proプラン</h3>
                  <p className="text-2xl font-bold text-primary-600 mb-1">¥4,980</p>
                  <p className="text-sm text-slate-600">/月（税込）</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-2">Executiveプラン</h3>
                  <p className="text-2xl font-bold text-primary-600 mb-1">¥19,800〜</p>
                  <p className="text-sm text-slate-600">/月（税込）</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-2">オプション</h3>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>初期設定代行: ¥9,980（一回のみ）</li>
                    <li>スポットコンサル: ¥5,500/30分</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 6: 商品代金以外の必要料金 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <FileText className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">商品代金以外の必要料金</h2>
              </div>
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                <p className="text-slate-700">
                  クレジットカード決済手数料、銀行振込手数料など、お客様が別途負担する必要がある料金はございません。
                </p>
                <p className="text-sm text-slate-500 mt-3">
                  ※ お客様がご利用のクレジットカード会社によっては、海外決済手数料が発生する場合があります。
                </p>
              </div>
            </section>

            {/* Section 7: お支払方法と期限 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">お支払方法と期限</h2>
              </div>
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-3">お支払方法</h3>
                  <ul className="space-y-2 text-slate-700">
                    <li className="flex items-start gap-2">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                      <span>クレジットカード決済（Visa、Mastercard、American Express、JCB）</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                      <span>Stripeを通じた安全な決済処理</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-3">支払時期</h3>
                  <p className="text-slate-700">
                    月額プランは毎月の契約更新日に自動的に課金されます。初回のお支払いは、プラン登録時に行われます。
                  </p>
                </div>
              </div>
            </section>

            {/* Section 8: サービス提供時期 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <Calendar className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">サービス提供時期</h2>
              </div>
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                <p className="text-slate-700 font-medium mb-3">
                  決済完了後、即時にサービスをご利用いただけます。
                </p>
                <p className="text-slate-600 text-sm">
                  アカウント作成後、LINE公式アカウントとの連携設定が完了次第、すべての機能をご利用いただけます。
                </p>
              </div>
            </section>

            {/* Section 9: 返品・交換・キャンセル */}
            <section className="bg-white rounded-2xl shadow-md border-l-4 border-primary-500 p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <XCircle className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">返品・交換・キャンセル</h2>
                </div>
                
                <div className="bg-primary-50/50 rounded-xl p-6 mb-6 border border-primary-100">
                  <p className="text-slate-700 font-medium mb-4">
                    本サービスは、インターネットを通じて提供されるSaaS（Software as a Service）サービスであり、商品の性質上、返品・交換はできません。
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl p-6 border border-slate-100">
                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      解約について
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      ご契約は月単位の自動更新となります。解約をご希望の場合は、管理画面の設定ページからいつでも解約手続きを行っていただけます。
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      解約手続き後、現在の契約期間終了日までサービスをご利用いただけます。解約後は自動更新されません。
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-6 border border-slate-100">
                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-slate-400" />
                      返金について
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      月額プランの場合、既にお支払いいただいた月額料金の返金は原則として行っておりません。
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      ただし、当サービスの不具合によりサービスが提供できない場合など、当社に責任がある場合には、該当期間分の料金を返金いたします。
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 10: お問い合わせ */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
              <div className="inline-flex p-3 bg-primary-50 rounded-full mb-6">
                <Mail className="w-8 h-8 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">お問い合わせ</h2>
              <p className="text-slate-600 mb-8 max-w-lg mx-auto">
                本表記に関するお問い合わせは、以下の窓口までお願いいたします。<br />
                <span className="text-sm text-slate-500 mt-2 block">基本的にお問い合わせは公式LINEで受け付けております。</span>
              </p>
              <div className="bg-slate-50 rounded-xl p-6 max-w-md mx-auto border border-slate-100 space-y-3">
                <p className="font-bold text-lg text-slate-900 mb-4">IToguchi 運営事務局</p>
                <div>
                  <p className="text-sm text-slate-500 mb-1">公式LINE（推奨）</p>
                  <a href="https://line.me/R/ti/p/@431cghfd" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 transition-colors font-medium inline-block">
                    @431cghfd
                  </a>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">メールアドレス</p>
                  <a href="mailto:itoguchi.app@gmail.com" className="text-slate-700 hover:text-primary-600 transition-colors">
                    itoguchi.app@gmail.com
                  </a>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">電話番号</p>
                  <p className="text-slate-700">
                    090-2237-2872
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
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

export default SpecifiedCommercialTransactions
