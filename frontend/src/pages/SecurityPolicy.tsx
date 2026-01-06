import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Shield, Lock, Eye, Server, Key, Database, AlertCircle, CheckCircle, FileText } from 'lucide-react'
import iconImage from '../assets/icon.png'

const SecurityPolicy: React.FC = () => {
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
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">セキュリティポリシー</h1>
            <p className="text-slate-500">最終更新日: 2025年12月31日</p>
          </div>

          <div className="space-y-8">
            {/* Introduction */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <p className="text-slate-600 leading-relaxed">
                IToguchi（以下「当サービス」といいます）は、お客様のデータとプライバシーを保護するため、セキュリティを最優先に考えています。
                本ポリシーでは、当サービスが採用しているセキュリティ対策について説明いたします。
              </p>
            </div>

            {/* Section 1: 認証・認可 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <Key className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">1. 認証・認可の仕組み</h2>
              </div>
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-400" />
                    ユーザー認証
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-3">
                    当サービスは、Supabase Authenticationを使用した安全な認証システムを採用しています。
                    パスワードは暗号化され、安全に保存されます。
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1 ml-4">
                    <li className="list-disc">メールアドレスとパスワードによる認証</li>
                    <li className="list-disc">認証コードによる二段階認証（アカウント作成時）</li>
                    <li className="list-disc">セッショントークンの安全な管理</li>
                  </ul>
                </div>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-slate-400" />
                    LINE API認証
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-3">
                    LINE公式アカウントとの連携においては、厳格なトークン検証を行っています。
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1 ml-4">
                    <li className="list-disc">LINE APIを通じたトークンの有効性確認</li>
                    <li className="list-disc">Channel IDの検証によるクロスチャネル攻撃の防止</li>
                    <li className="list-disc">ユーザーIDの確実な特定によるなりすまし防止</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 2: データベースセキュリティ */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <Database className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">2. データベースセキュリティ</h2>
              </div>
              <p className="text-slate-600 mb-4">
                当サービスは、Supabase（PostgreSQL）を使用し、Row Level Security (RLS) によりデータアクセスを厳格に制御しています。
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-400" />
                    オーナー専用データ
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-2">
                    以下のデータは、店舗オーナーのみがアクセス可能です：
                  </p>
                  <ul className="text-xs text-slate-600 space-y-1 ml-4">
                    <li className="list-disc">顧客情報（氏名、LINE ID、写真等）</li>
                    <li className="list-disc">予約情報</li>
                    <li className="list-disc">メッセージログ</li>
                    <li className="list-disc">LINE API認証情報</li>
                  </ul>
                </div>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-slate-400" />
                    公開データ
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-2">
                    予約ページ表示に必要な以下のデータのみ、限定的に公開されています：
                  </p>
                  <ul className="text-xs text-slate-600 space-y-1 ml-4">
                    <li className="list-disc">店舗基本情報（店名、住所、営業時間）</li>
                    <li className="list-disc">スタッフ情報（公開設定のもの）</li>
                    <li className="list-disc">メニュー情報（公開設定のもの）</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 3: データ保護 */}
            <section className="bg-white rounded-2xl shadow-md border-l-4 border-primary-500 p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Shield className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">3. データ保護の取り組み</h2>
                </div>
                
                <div className="bg-primary-50/50 rounded-xl p-6 mb-6 border border-primary-100">
                  <p className="text-slate-700 font-medium mb-4">
                    当サービスは、お客様のデータを保護するため、以下の対策を実施しています。
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl p-6 border border-slate-100">
                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <Server className="w-4 h-4 text-slate-400" />
                      暗号化通信
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      すべての通信はHTTPS（TLS/SSL）により暗号化されています。データの送受信において、第三者による傍受や改ざんを防止します。
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-6 border border-slate-100">
                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <Database className="w-4 h-4 text-slate-400" />
                      データベースの保護
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Supabaseのセキュアなインフラストラクチャを使用し、データベースへの不正アクセスを防止します。定期的なバックアップにより、データの安全性を確保しています。
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-6 border border-slate-100">
                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <Key className="w-4 h-4 text-slate-400" />
                      アクセス制御
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Row Level Security (RLS) により、ユーザーは自分のデータのみにアクセス可能です。他のユーザーのデータにアクセスすることはできません。
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-6 border border-slate-100">
                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-slate-400" />
                      不正アクセス対策
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      IDOR（Insecure Direct Object Reference）対策を実施し、リソースへの不正アクセスを防止します。予約のキャンセル等において、操作権限を厳格に検証します。
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 4: 外部サービス連携 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <Server className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">4. 外部サービス連携のセキュリティ</h2>
              </div>
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-3">LINE API</h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-3">
                    LINE公式アカウントとの連携において、Channel SecretやAccess Tokenなどの機密情報は安全に管理されています。
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1 ml-4">
                    <li className="list-disc">認証情報は暗号化して保存</li>
                    <li className="list-disc">トークンの有効性を定期的に検証</li>
                    <li className="list-disc">Webhook署名による改ざん検知</li>
                  </ul>
                </div>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-3">Google Calendar API</h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-3">
                    Googleカレンダーとの連携において、Google API Services User Data Policyに準拠しています。
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1 ml-4">
                    <li className="list-disc">Limited Use要件の遵守</li>
                    <li className="list-disc">取得したデータの用途制限</li>
                    <li className="list-disc">第三者への提供禁止</li>
                  </ul>
                </div>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-3">Stripe決済</h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-3">
                    決済処理はStripeを通じて行われ、クレジットカード情報は当サービスに保存されません。
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1 ml-4">
                    <li className="list-disc">PCI DSS準拠のStripeが決済を処理</li>
                    <li className="list-disc">Webhook署名による改ざん検知</li>
                    <li className="list-disc">決済情報の安全な管理</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 5: セキュリティインシデント対応 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">5. セキュリティインシデント対応</h2>
              </div>
              <p className="text-slate-600 mb-4">
                万が一、セキュリティインシデントが発生した場合、当サービスは以下の対応を行います。
              </p>
              <ul className="space-y-3">
                {[
                  'インシデントの迅速な検知と対応',
                  '影響範囲の特定と評価',
                  '必要に応じたお客様への通知',
                  '再発防止策の実施'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-slate-600">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Section 6: お問い合わせ */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
              <div className="inline-flex p-3 bg-primary-50 rounded-full mb-6">
                <Shield className="w-8 h-8 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">セキュリティに関するお問い合わせ</h2>
              <p className="text-slate-600 mb-8 max-w-lg mx-auto">
                セキュリティに関するご質問や、セキュリティ上の問題を発見された場合は、以下の窓口までお願いいたします。
              </p>
              <div className="bg-slate-50 rounded-xl p-6 max-w-md mx-auto border border-slate-100">
                <p className="font-bold text-lg text-slate-900 mb-2">IToguchi 運営事務局</p>
                <p className="text-slate-600 mb-2">
                  <a href="https://line.me/R/ti/p/@431cghfd" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 transition-colors font-medium">
                    公式LINE: @431cghfd
                  </a>
                </p>
                <p className="text-slate-600 text-sm">
                  メール: itoguchi.app@gmail.com
                </p>
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

export default SecurityPolicy
