import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Phone, Mail, DollarSign, Calendar } from 'lucide-react'
import LegalLayout from '../components/site/LegalLayout'

const SpecifiedCommercialTransactions: React.FC = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <LegalLayout>
          {/* Title Section */}
          <div className="mb-12">
            <h1 className="text-[2rem] font-black leading-tight tracking-[-0.02em] sm:text-[2.6rem] mb-3">特定商取引法に基づく表記</h1>
            <p className="text-ink-soft">最終更新日: 2025年12月31日</p>
          </div>

          <div className="space-y-14">
            {/* Introduction */}
            <div className="border-t-2 border-ink pt-8 pb-2">
              <p className="text-ink-soft leading-relaxed mb-4">
                IToguchi（以下「当サービス」といいます）は、特定商取引法に基づき、以下のとおり表記いたします。
              </p>
              <div className="bg-primary-50 rounded-xl p-6 border border-primary-100 mt-4">
                <h3 className="font-bold text-ink mb-2">サービス概要</h3>
                <p className="text-sm text-ink leading-relaxed">
                  IToguchiは、店舗運営を支援するSaaS型の予約管理システムです。LINE公式アカウントを通じて、予約管理、自動応答、顧客管理、デジタル会員証などの機能を提供します。店舗オーナーがLINEひとつで予約・会員証・接客を自動化し、本業に集中できる環境を提供することを目的としています。
                </p>
              </div>
            </div>

            {/* Section 1: 販売業者名 */}
            <section className="border-t-2 border-ink pt-8 pb-2">
              <div className="mb-5">
                <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">販売業者名</h2>
              </div>
              <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                <p className="text-ink font-medium text-lg">
                  個人事業主 伊奈洋
                </p>
              </div>
            </section>

            {/* Section 2: 運営責任者 */}
            <section className="border-t-2 border-ink pt-8 pb-2">
              <div className="mb-5">
                <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">運営責任者</h2>
              </div>
              <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                <p className="text-ink font-medium text-lg">
                  伊奈洋
                </p>
              </div>
            </section>

            {/* Section 3: 所在地 */}
            <section className="border-t-2 border-ink pt-8 pb-2">
              <div className="mb-5">
                <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">所在地</h2>
              </div>
              <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                <p className="text-ink font-medium text-lg">
                  〒160-0023<br />
                  東京都新宿区西新宿3丁目3番13号西新宿水間ビル2F
                </p>
              </div>
            </section>

            {/* Section 4: 電話番号・メールアドレス */}
            <section className="border-t-2 border-ink pt-8 pb-2">
              <div className="mb-5">
                <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">電話番号・メールアドレス</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                  <h3 className="font-bold text-ink mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-ink-soft" />
                    電話番号
                  </h3>
                  <p className="text-ink font-medium">
                    090-2237-2872
                  </p>
                  {/* 電話番号は特商法上の必須表示のため掲載する。実際の問い合わせ窓口は
                      公式LINEとメールなので、受付方針をここで明示しておく。 */}
                  <p className="text-xs text-ink-soft mt-2 leading-relaxed">
                    お問い合わせは公式LINEまたはメールにて承っております。<br />
                    お電話でのご対応が難しい場合がございますので、あらかじめご了承ください。
                  </p>
                </div>
                <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                  <h3 className="font-bold text-ink mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-ink-soft" />
                    メールアドレス
                  </h3>
                  <a href="mailto:info@itoguchi-app.jp" className="text-ink font-medium hover:text-primary-800 transition-colors">
                    info@itoguchi-app.jp
                  </a>
                </div>
              </div>
            </section>

            {/* Section 5: 販売価格 */}
            <section className="border-t-2 border-ink pt-8 pb-2">
              <div className="mb-5">
                <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">販売価格</h2>
              </div>
              <p className="text-ink-soft mb-4">サービス料金は以下のとおりです。詳細は<Link to="/" onClick={() => setTimeout(() => { const element = document.getElementById('pricing'); if (element) element.scrollIntoView({ behavior: 'smooth' }); }, 100)} className="text-primary-800 hover:underline font-medium">料金プランページ</Link>をご確認ください。</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                  <h3 className="font-bold text-ink mb-2">Freeプラン</h3>
                  <p className="text-2xl font-bold text-primary-800 mb-1">¥0</p>
                  <p className="text-sm text-ink-soft">/月（税込）</p>
                </div>
                <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                  <h3 className="font-bold text-ink mb-2">Proプラン</h3>
                  <p className="text-2xl font-bold text-primary-800 mb-1">¥4,980</p>
                  <p className="text-sm text-ink-soft">/月（税込）</p>
                </div>
                <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                  <h3 className="font-bold text-ink mb-2">Executiveプラン</h3>
                  <p className="text-2xl font-bold text-primary-800 mb-1">¥19,800〜</p>
                  <p className="text-sm text-ink-soft">/月（税込）</p>
                </div>
                <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                  <h3 className="font-bold text-ink mb-2">オプション</h3>
                  <ul className="text-sm text-ink-soft space-y-1">
                    <li>初期設定代行: ¥9,980（一回のみ）</li>
                    <li>スポットコンサル: ¥5,500/30分</li>
                  </ul>
                  {/* 役務の範囲を明示する。代行は公式アカウントとの接続設定までで、
                      公式アカウントの開設や運用設定は含まない。 */}
                  <p className="text-xs text-ink-soft mt-3 leading-relaxed">
                    初期設定代行の役務内容：LINE公式アカウントと本サービスの接続設定（LINE Developersでのチャネル作成サポート、認証情報の取得と登録、Webhook URLの設定、連携の完了確認）。
                    LINE公式アカウントの開設、および予約枠・リッチメニュー等の運用設定は含まれません。
                  </p>
                </div>
              </div>
            </section>

            {/* Section 6: 商品代金以外の必要料金 */}
            <section className="border-t-2 border-ink pt-8 pb-2">
              <div className="mb-5">
                <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">商品代金以外の必要料金</h2>
              </div>
              <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                <p className="text-ink">
                  クレジットカード決済手数料、銀行振込手数料など、お客様が別途負担する必要がある料金はございません。
                </p>
                <p className="text-sm text-ink-soft mt-3">
                  ※ お客様がご利用のクレジットカード会社によっては、海外決済手数料が発生する場合があります。
                </p>
              </div>
            </section>

            {/* Section 7: お支払方法と期限 */}
            <section className="border-t-2 border-ink pt-8 pb-2">
              <div className="mb-5">
                <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">お支払方法と期限</h2>
              </div>
              <div className="space-y-4">
                <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                  <h3 className="font-bold text-ink mb-3">お支払方法</h3>
                  <ul className="space-y-2 text-ink">
                    <li className="flex items-start gap-2">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-600 flex-shrink-0" />
                      <span>クレジットカード決済（Visa、Mastercard、American Express、JCB）</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-600 flex-shrink-0" />
                      <span>Stripeを通じた安全な決済処理</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                  <h3 className="font-bold text-ink mb-3">支払時期</h3>
                  <p className="text-ink">
                    月額プランは毎月の契約更新日に自動的に課金されます。初回のお支払いは、プラン登録時に行われます。
                  </p>
                </div>
              </div>
            </section>

            {/* Section 8: サービス提供時期 */}
            <section className="border-t-2 border-ink pt-8 pb-2">
              <div className="mb-5">
                <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">サービス提供時期</h2>
              </div>
              <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                <p className="text-ink font-medium mb-3">
                  決済完了後、即時にサービスをご利用いただけます。
                </p>
                <p className="text-ink-soft text-sm">
                  アカウント作成後、LINE公式アカウントとの連携設定が完了次第、すべての機能をご利用いただけます。
                </p>
              </div>
            </section>

            {/* Section 9: 返品・交換・キャンセル */}
            <section className="bg-paper rounded-xl border-2 border-primary-300 p-8 relative overflow-hidden">
              <div className="relative z-10">
                <div className="mb-5">
                  <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">返品・交換・キャンセル</h2>
                </div>
                
                <div className="bg-primary-50/50 rounded-xl p-6 mb-6 border border-primary-100">
                  <p className="text-ink font-medium mb-4">
                    本サービスは、インターネットを通じて提供されるSaaS（Software as a Service）サービスであり、商品の性質上、返品・交換はできません。
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-paper rounded-xl p-6 border border-rule">
                    <h4 className="font-bold text-ink mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-ink-soft" />
                      解約について
                    </h4>
                    <p className="text-sm text-ink-soft leading-relaxed mb-3">
                      ご契約は月単位の自動更新となります。解約をご希望の場合は、管理画面の設定ページからいつでも解約手続きを行っていただけます。
                    </p>
                    <p className="text-sm text-ink-soft leading-relaxed">
                      解約手続き後、現在の契約期間終了日までサービスをご利用いただけます。解約後は自動更新されません。
                    </p>
                  </div>
                  <div className="bg-paper rounded-xl p-6 border border-rule">
                    <h4 className="font-bold text-ink mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-ink-soft" />
                      返金について
                    </h4>
                    <p className="text-sm text-ink-soft leading-relaxed mb-3">
                      月額プランの場合、既にお支払いいただいた月額料金の返金は原則として行っておりません。
                    </p>
                    <p className="text-sm text-ink-soft leading-relaxed">
                      ただし、当サービスの不具合によりサービスが提供できない場合など、当社に責任がある場合には、該当期間分の料金を返金いたします。
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 10: お問い合わせ */}
            <section className="bg-paper rounded-xl border border-rule p-8 text-center">
              <div className="inline-flex p-3 bg-primary-50 rounded-full mb-6">
                <Mail className="w-8 h-8 text-primary-800" />
              </div>
              <h2 className="text-2xl font-bold text-ink mb-4">お問い合わせ</h2>
              <p className="text-ink-soft mb-8 max-w-lg mx-auto">
                本表記に関するお問い合わせは、以下の窓口までお願いいたします。<br />
                <span className="text-sm text-ink-soft mt-2 block">お問い合わせは公式LINEまたはメールにて承っております。</span>
              </p>
              <div className="bg-counter/60 rounded-xl p-6 max-w-md mx-auto border border-rule space-y-3">
                <p className="font-bold text-lg text-ink mb-4">IToguchi 運営事務局</p>
                <div>
                  <p className="text-sm text-ink-soft mb-1">公式LINE（推奨）</p>
                  <a href="https://line.me/R/ti/p/@431cghfd" target="_blank" rel="noopener noreferrer" className="text-primary-800 hover:text-primary-800 transition-colors font-medium inline-block">
                    @431cghfd
                  </a>
                </div>
                <div>
                  <p className="text-sm text-ink-soft mb-1">メールアドレス</p>
                  <a href="mailto:info@itoguchi-app.jp" className="text-ink hover:text-primary-800 transition-colors">
                    info@itoguchi-app.jp
                  </a>
                </div>
              </div>
            </section>
          </div>
        </LegalLayout>
  )
}

export default SpecifiedCommercialTransactions
