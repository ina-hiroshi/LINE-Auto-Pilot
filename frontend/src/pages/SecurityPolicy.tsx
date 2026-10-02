import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Shield, Lock, Eye, Server, Key, Database, AlertCircle } from 'lucide-react'
import LegalLayout from '../components/site/LegalLayout'

const SecurityPolicy: React.FC = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <LegalLayout>
          {/* Title Section */}
          <div className="mb-12">
            <h1 className="text-[2rem] font-black leading-tight tracking-[-0.02em] sm:text-[2.6rem] mb-3">セキュリティポリシー</h1>
            <p className="text-ink-soft">最終更新日: 2025年12月31日</p>
          </div>

          <div className="space-y-14">
            {/* Introduction */}
            <div className="border-t-2 border-ink pt-8 pb-2">
              <p className="text-ink-soft leading-relaxed">
                IToguchi（以下「当サービス」といいます）は、お客様のデータとプライバシーを保護するため、セキュリティを最優先に考えています。
                本ポリシーでは、当サービスが採用しているセキュリティ対策について説明いたします。
              </p>
            </div>

            {/* Section 1: 認証・認可 */}
            <section className="border-t-2 border-ink pt-8 pb-2">
              <div className="mb-5">
                <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">1. 認証・認可の仕組み</h2>
              </div>
              <div className="space-y-4">
                <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                  <h3 className="font-bold text-ink mb-3 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-ink-soft" />
                    ユーザー認証
                  </h3>
                  <p className="text-ink-soft text-sm leading-relaxed mb-3">
                    当サービスは、Supabase Authenticationを使用した安全な認証システムを採用しています。
                    パスワードは暗号化され、安全に保存されます。
                  </p>
                  <ul className="text-sm text-ink-soft space-y-1 ml-4">
                    <li className="list-disc">メールアドレスとパスワードによる認証</li>
                    <li className="list-disc">認証コードによる二段階認証（アカウント作成時）</li>
                    <li className="list-disc">セッショントークンの安全な管理</li>
                  </ul>
                </div>
                <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                  <h3 className="font-bold text-ink mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-ink-soft" />
                    LINE API認証
                  </h3>
                  <p className="text-ink-soft text-sm leading-relaxed mb-3">
                    LINE公式アカウントとの連携においては、厳格なトークン検証を行っています。
                  </p>
                  <ul className="text-sm text-ink-soft space-y-1 ml-4">
                    <li className="list-disc">LINE APIを通じたトークンの有効性確認</li>
                    <li className="list-disc">Channel IDの検証によるクロスチャネル攻撃の防止</li>
                    <li className="list-disc">ユーザーIDの確実な特定によるなりすまし防止</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 2: データベースセキュリティ */}
            <section className="border-t-2 border-ink pt-8 pb-2">
              <div className="mb-5">
                <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">2. データベースセキュリティ</h2>
              </div>
              <p className="text-ink-soft mb-4">
                当サービスは、Supabase（PostgreSQL）を使用し、Row Level Security (RLS) によりデータアクセスを厳格に制御しています。
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                  <h3 className="font-bold text-ink mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-ink-soft" />
                    オーナー専用データ
                  </h3>
                  <p className="text-sm text-ink-soft leading-relaxed mb-2">
                    以下のデータは、店舗オーナーのみがアクセス可能です：
                  </p>
                  <ul className="text-xs text-ink-soft space-y-1 ml-4">
                    <li className="list-disc">顧客情報（氏名、LINE ID、写真等）</li>
                    <li className="list-disc">予約情報</li>
                    <li className="list-disc">メッセージログ</li>
                    <li className="list-disc">LINE API認証情報</li>
                  </ul>
                </div>
                <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                  <h3 className="font-bold text-ink mb-2 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-ink-soft" />
                    公開データ
                  </h3>
                  <p className="text-sm text-ink-soft leading-relaxed mb-2">
                    予約ページ表示に必要な以下のデータのみ、限定的に公開されています：
                  </p>
                  <ul className="text-xs text-ink-soft space-y-1 ml-4">
                    <li className="list-disc">店舗基本情報（店名、住所、営業時間）</li>
                    <li className="list-disc">スタッフ情報（公開設定のもの）</li>
                    <li className="list-disc">メニュー情報（公開設定のもの）</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 3: データ保護 */}
            <section className="bg-paper rounded-xl border-2 border-primary-300 p-8 relative overflow-hidden">
              <div className="relative z-10">
                <div className="mb-5">
                  <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">3. データ保護の取り組み</h2>
                </div>
                
                <div className="bg-primary-50/50 rounded-xl p-6 mb-6 border border-primary-100">
                  <p className="text-ink font-medium mb-4">
                    当サービスは、お客様のデータを保護するため、以下の対策を実施しています。
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-paper rounded-xl p-6 border border-rule">
                    <h4 className="font-bold text-ink mb-3 flex items-center gap-2">
                      <Server className="w-4 h-4 text-ink-soft" />
                      暗号化通信
                    </h4>
                    <p className="text-sm text-ink-soft leading-relaxed">
                      すべての通信はHTTPS（TLS/SSL）により暗号化されています。データの送受信において、第三者による傍受や改ざんを防止します。
                    </p>
                  </div>
                  <div className="bg-paper rounded-xl p-6 border border-rule">
                    <h4 className="font-bold text-ink mb-3 flex items-center gap-2">
                      <Database className="w-4 h-4 text-ink-soft" />
                      データベースの保護
                    </h4>
                    <p className="text-sm text-ink-soft leading-relaxed">
                      Supabaseのセキュアなインフラストラクチャを使用し、データベースへの不正アクセスを防止します。定期的なバックアップにより、データの安全性を確保しています。
                    </p>
                  </div>
                  <div className="bg-paper rounded-xl p-6 border border-rule">
                    <h4 className="font-bold text-ink mb-3 flex items-center gap-2">
                      <Key className="w-4 h-4 text-ink-soft" />
                      アクセス制御
                    </h4>
                    <p className="text-sm text-ink-soft leading-relaxed">
                      Row Level Security (RLS) により、ユーザーは自分のデータのみにアクセス可能です。他のユーザーのデータにアクセスすることはできません。
                    </p>
                  </div>
                  <div className="bg-paper rounded-xl p-6 border border-rule">
                    <h4 className="font-bold text-ink mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-ink-soft" />
                      不正アクセス対策
                    </h4>
                    <p className="text-sm text-ink-soft leading-relaxed">
                      IDOR（Insecure Direct Object Reference）対策を実施し、リソースへの不正アクセスを防止します。予約のキャンセル等において、操作権限を厳格に検証します。
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 4: 外部サービス連携 */}
            <section className="border-t-2 border-ink pt-8 pb-2">
              <div className="mb-5">
                <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">4. 外部サービス連携のセキュリティ</h2>
              </div>
              <div className="space-y-4">
                <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                  <h3 className="font-bold text-ink mb-3">LINE API</h3>
                  <p className="text-ink-soft text-sm leading-relaxed mb-3">
                    LINE公式アカウントとの連携において、Channel SecretやAccess Tokenなどの機密情報は安全に管理されています。
                  </p>
                  <ul className="text-sm text-ink-soft space-y-1 ml-4">
                    <li className="list-disc">認証情報は暗号化して保存</li>
                    <li className="list-disc">トークンの有効性を定期的に検証</li>
                    <li className="list-disc">Webhook署名による改ざん検知</li>
                  </ul>
                </div>
                <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                  <h3 className="font-bold text-ink mb-3">Google Calendar API</h3>
                  <p className="text-ink-soft text-sm leading-relaxed mb-3">
                    Googleカレンダーとの連携において、Google API Services User Data Policyに準拠しています。
                  </p>
                  <ul className="text-sm text-ink-soft space-y-1 ml-4">
                    <li className="list-disc">Limited Use要件の遵守</li>
                    <li className="list-disc">取得したデータの用途制限</li>
                    <li className="list-disc">第三者への提供禁止</li>
                  </ul>
                </div>
                <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                  <h3 className="font-bold text-ink mb-3">Stripe決済</h3>
                  <p className="text-ink-soft text-sm leading-relaxed mb-3">
                    決済処理はStripeを通じて行われ、クレジットカード情報は当サービスに保存されません。
                  </p>
                  <ul className="text-sm text-ink-soft space-y-1 ml-4">
                    <li className="list-disc">PCI DSS準拠のStripeが決済を処理</li>
                    <li className="list-disc">Webhook署名による改ざん検知</li>
                    <li className="list-disc">決済情報の安全な管理</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 5: セキュリティインシデント対応 */}
            <section className="border-t-2 border-ink pt-8 pb-2">
              <div className="mb-5">
                <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">5. セキュリティインシデント対応</h2>
              </div>
              <p className="text-ink-soft mb-4">
                万が一、セキュリティインシデントが発生した場合、当サービスは以下の対応を行います。
              </p>
              <ul className="space-y-3">
                {[
                  'インシデントの迅速な検知と対応',
                  '影響範囲の特定と評価',
                  '必要に応じたお客様への通知',
                  '再発防止策の実施'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-ink-soft">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-600 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Section 6: お問い合わせ */}
            <section className="bg-paper rounded-xl border border-rule p-8 text-center">
              <div className="inline-flex p-3 bg-primary-50 rounded-full mb-6">
                <Shield className="w-8 h-8 text-primary-800" />
              </div>
              <h2 className="text-2xl font-bold text-ink mb-4">セキュリティに関するお問い合わせ</h2>
              <p className="text-ink-soft mb-8 max-w-lg mx-auto">
                セキュリティに関するご質問や、セキュリティ上の問題を発見された場合は、以下の窓口までお願いいたします。
              </p>
              <div className="bg-counter/60 rounded-xl p-6 max-w-md mx-auto border border-rule">
                <p className="font-bold text-lg text-ink mb-2">IToguchi 運営事務局</p>
                <p className="text-ink-soft mb-2">
                  <a href="https://line.me/R/ti/p/@431cghfd" target="_blank" rel="noopener noreferrer" className="text-primary-800 hover:text-primary-800 transition-colors font-medium">
                    公式LINE: @431cghfd
                  </a>
                </p>
                <p className="text-ink-soft text-sm">
                  メール: itoguchi.app@gmail.com
                </p>
              </div>
            </section>
          </div>
        </LegalLayout>
  )
}

export default SecurityPolicy
