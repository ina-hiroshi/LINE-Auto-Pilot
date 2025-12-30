import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Shield, Lock, Eye, Server, Mail, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import iconImage from '../assets/icon.png'

const PrivacyPolicy: React.FC = () => {
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
              <img src={iconImage} alt="IToguchi" className="h-10 md:h-16 w-auto" />
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
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">プライバシーポリシー</h1>
            <p className="text-slate-500">最終更新日: 2025年12月31日</p>
          </div>

          <div className="space-y-8">
            {/* Introduction */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <p className="text-slate-600 leading-relaxed">
                IToguchi（以下「当サービス」といいます）は、ユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
                当サービスは、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。
              </p>
            </div>

            {/* Section 1: Collection */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <FileText className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">1. 収集する情報</h2>
              </div>
              <p className="text-slate-600 mb-4">当サービスは、サービスの提供にあたり、以下の情報を収集・利用します。</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-2">アカウント情報</h3>
                  <p className="text-sm text-slate-600">氏名、メールアドレス、パスワードなど、アカウント作成時に提供される基本情報。</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-2">LINEアカウント情報</h3>
                  <p className="text-sm text-slate-600">LINEログインおよびMessaging APIを通じて取得されるユーザーID、プロフィール情報、メッセージ履歴。</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-2">Googleアカウント情報</h3>
                  <p className="text-sm text-slate-600">カレンダー連携機能利用時のカレンダーリスト、イベント情報（タイトル、日時、詳細）。</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-2">利用ログ</h3>
                  <p className="text-sm text-slate-600">サービスの利用状況、IPアドレス、ブラウザ情報、アクセス日時などのログ情報。</p>
                </div>
              </div>
            </section>

            {/* Section 2: Purpose */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">2. 情報の利用目的</h2>
              </div>
              <ul className="space-y-3">
                {[
                  '本サービスの提供・運営（予約管理、メッセージ自動応答など）',
                  'Googleカレンダーとの同期機能の提供',
                  'ユーザーからのお問い合わせへの対応',
                  'サービスの改善および新機能の開発',
                  '不正利用の防止およびセキュリティ対策'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-slate-600">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Section 3: Google Data (Highlighted) */}
            <section className="bg-white rounded-2xl shadow-md border-l-4 border-primary-500 p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Shield className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">3. Googleユーザーデータの取り扱い</h2>
                </div>
                
                <div className="bg-primary-50/50 rounded-xl p-6 mb-6 border border-primary-100">
                  <p className="text-slate-700 font-medium mb-4">
                    当サービスは、Google APIを通じて取得した情報を、Googleカレンダーとの予約同期機能の提供にのみ使用します。
                  </p>
                  <div className="flex items-start gap-3 text-sm text-slate-600 bg-white p-4 rounded-lg border border-primary-100">
                    <AlertCircle className="w-5 h-5 text-primary-500 flex-shrink-0" />
                    <div>
                      <strong>Google API Services User Data Policyへの準拠:</strong><br />
                      当サービスによるGoogle APIから受け取った情報の使用および他のアプリへの転送は、
                      <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline font-medium ml-1">
                        Google API Services User Data Policy
                      </a>
                      （Limited Use要件を含む）を遵守します。
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-slate-400" />
                      利用の制限
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      取得したカレンダーデータは、ユーザー自身の予約管理および空き状況の確認のためにのみ使用され、広告目的などで使用されることは一切ありません。
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-slate-400" />
                      共有の制限
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      ユーザーの明示的な同意がある場合、または法的義務がある場合を除き、Googleユーザーデータを第三者と共有することはありません。
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 4: Third Party */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <Server className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">4. 第三者への提供</h2>
              </div>
              <p className="text-slate-600 mb-4">
                当サービスは、以下の場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。
              </p>
              <ul className="grid md:grid-cols-2 gap-3 mb-6">
                {['法令に基づく場合', '人の生命・身体・財産の保護に必要な場合', '公衆衛生・児童の健全育成に必要な場合', '国の機関等への協力が必要な場合'].map((item, i) => (
                  <li key={i} className="bg-slate-50 px-4 py-3 rounded-lg text-sm text-slate-700 border border-slate-100">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-slate-500">
                ※ サービス提供のために必要な範囲で、信頼できる委託先（クラウドサーバー提供者など）に個人情報の取り扱いを委託する場合があります。
              </p>
            </section>

            {/* Section 5 & 6: Management & Changes */}
            <div className="grid md:grid-cols-2 gap-8">
              <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">5. 情報の管理と保護</h2>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  当サービスは、ユーザーの個人情報を正確かつ最新の状態に保ち、個人情報への不正アクセス・紛失・破損・改ざん・漏洩などを防止するため、セキュリティシステムの維持・管理体制の整備等の必要な措置を講じます。
                </p>
              </section>

              <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">6. ポリシーの変更</h2>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  本ポリシーの内容は、法令その他本ポリシーに別段の定めのある事項を除いて、ユーザーに通知することなく変更することができるものとします。変更後のプライバシーポリシーは、本ウェブサイトに掲載したときから効力を生じるものとします。
                </p>
              </section>
            </div>

            {/* Section 7: Contact */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
              <div className="inline-flex p-3 bg-primary-50 rounded-full mb-6">
                <Mail className="w-8 h-8 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">お問い合わせ</h2>
              <p className="text-slate-600 mb-8 max-w-lg mx-auto">
                本ポリシーに関するお問い合わせは、以下の窓口までお願いいたします。
              </p>
              <div className="bg-slate-50 rounded-xl p-6 max-w-md mx-auto border border-slate-100">
                <p className="font-bold text-lg text-slate-900 mb-2">IToguchi 運営事務局</p>
                <a href="mailto:support@example.com" className="text-primary-600 hover:text-primary-700 transition-colors text-lg font-medium">
                  support@example.com
                </a>
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
                <li><a href="#" className="hover:text-white transition">ヘルプセンター</a></li>
                <li><a href="#" className="hover:text-white transition">お問い合わせ</a></li>
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

export default PrivacyPolicy
