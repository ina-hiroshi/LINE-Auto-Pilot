import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Lock, Eye, Server, Mail, AlertCircle } from 'lucide-react'
import LegalLayout from '../components/site/LegalLayout'

const PrivacyPolicy: React.FC = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <LegalLayout>
          {/* Title Section */}
          <div className="mb-12">
            <h1 className="text-[2rem] font-black leading-tight tracking-[-0.02em] sm:text-[2.6rem] mb-3">プライバシーポリシー</h1>
            <p className="text-ink-soft">最終更新日: 2026年5月23日</p>
          </div>

          <div className="space-y-14">
            {/* Introduction */}
            <div className="border-t-2 border-ink pt-8 pb-2">
              <p className="text-ink-soft leading-relaxed">
                IToguchi（運営: 個人事業主 伊奈洋、以下「当サービス」といいます）は、ユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
                当サービスは、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。
              </p>
            </div>

            {/* Section 1: Collection */}
            <section className="border-t-2 border-ink pt-8 pb-2">
              <div className="mb-5">
                <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">1. 収集する情報</h2>
              </div>
              <p className="text-ink-soft mb-4">当サービスは、サービスの提供にあたり、以下の情報を収集・利用します。</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-counter/60 rounded-xl border border-rule">
                  <h3 className="font-bold text-ink mb-2">アカウント情報</h3>
                  <p className="text-sm text-ink-soft">氏名、メールアドレス、パスワードなど、アカウント作成時に提供される基本情報。</p>
                </div>
                <div className="p-4 bg-counter/60 rounded-xl border border-rule">
                  <h3 className="font-bold text-ink mb-2">LINEアカウント情報</h3>
                  <p className="text-sm text-ink-soft">LINEログインおよびMessaging APIを通じて取得されるユーザーID、プロフィール情報、メッセージ履歴。</p>
                </div>
                <div className="p-4 bg-counter/60 rounded-xl border border-rule md:col-span-2">
                  <h3 className="font-bold text-ink mb-2">Googleアカウント情報</h3>
                  <p className="text-sm text-ink-soft mb-3">
                    カレンダー連携機能利用時、OAuth 2.0 により Google カレンダーの読み取り・書き込み（予約の同期・空き状況確認）に必要なカレンダーリストおよびイベント情報（タイトル、日時、詳細）を取得します。
                  </p>
                  <p className="text-xs text-ink-soft">
                    要求する OAuth スコープ: <code className="bg-counter px-1 rounded">calendar</code>、<code className="bg-counter px-1 rounded">calendar.events</code>
                  </p>
                </div>
                <div className="p-4 bg-counter/60 rounded-xl border border-rule">
                  <h3 className="font-bold text-ink mb-2">利用ログ</h3>
                  <p className="text-sm text-ink-soft">サービスの利用状況、IPアドレス、ブラウザ情報、アクセス日時などのログ情報。</p>
                </div>
              </div>
            </section>

            {/* Section 2: Purpose */}
            <section className="border-t-2 border-ink pt-8 pb-2">
              <div className="mb-5">
                <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">2. 情報の利用目的</h2>
              </div>
              <ul className="space-y-3">
                {[
                  '本サービスの提供・運営（予約管理、メッセージ自動応答など）',
                  'Googleカレンダーとの同期機能の提供',
                  'ユーザーからのお問い合わせへの対応',
                  'サービスの改善および新機能の開発',
                  '不正利用の防止およびセキュリティ対策'
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-ink-soft">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-600 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Section 3: Google Data (Highlighted) */}
            <section className="bg-paper rounded-xl border-2 border-primary-300 p-8 relative overflow-hidden">
              <div className="relative z-10">
                <div className="mb-5">
                  <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">3. Googleユーザーデータの取り扱い</h2>
                </div>
                
                <div className="bg-primary-50/50 rounded-xl p-6 mb-6 border border-primary-100">
                  <p className="text-ink font-medium mb-4">
                    当サービスは、Google APIを通じて取得した情報を、Googleカレンダーとの予約同期機能の提供にのみ使用します。
                  </p>
                  <div className="flex items-start gap-3 text-sm text-ink-soft bg-paper p-4 rounded-lg border border-primary-100">
                    <AlertCircle className="w-5 h-5 text-primary-500 flex-shrink-0" />
                    <div>
                      <strong>Google API Services User Data Policyへの準拠:</strong><br />
                      当サービスによるGoogle APIから受け取った情報の使用および他のアプリへの転送は、
                      <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary-800 hover:underline font-medium ml-1">
                        Google API Services User Data Policy
                      </a>
                      （Limited Use要件を含む）を遵守します。
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h4 className="font-bold text-ink mb-2 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-ink-soft" />
                      利用の制限
                    </h4>
                    <p className="text-sm text-ink-soft leading-relaxed">
                      取得したカレンダーデータは、ユーザー自身の予約管理、空き状況の確認、ダブルブッキング防止のためにのみ使用され、広告・プロファイリング目的などで使用されることは一切ありません。
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-ink mb-2 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-ink-soft" />
                      共有の制限
                    </h4>
                    <p className="text-sm text-ink-soft leading-relaxed">
                      ユーザーの明示的な同意がある場合、または法的義務がある場合を除き、Googleユーザーデータを第三者と共有・販売することはありません。
                    </p>
                  </div>
                </div>

                <div className="bg-counter/60 rounded-xl p-6 border border-rule">
                  <h4 className="font-bold text-ink mb-3 flex items-center gap-2">
                    <Server className="w-4 h-4 text-ink-soft" />
                    保存方法
                  </h4>
                  <ul className="space-y-2 text-sm text-ink-soft">
                    <li className="flex items-start gap-2">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-600 flex-shrink-0" />
                      <span>Google 連携に必要なリフレッシュトークンおよびカレンダー設定情報を、当サービスのデータベース（Supabase）に保存します。</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-600 flex-shrink-0" />
                      <span>予約データと Google カレンダーイベントを紐づけるため、イベント ID（google_event_id）を保存します。</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-600 flex-shrink-0" />
                      <span>カレンダーイベント本体は Google Calendar API 経由で都度取得し、永続的な一括保存は行いません。</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 4: Third Party */}
            <section className="border-t-2 border-ink pt-8 pb-2">
              <div className="mb-5">
                <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">4. 第三者への提供</h2>
              </div>
              <p className="text-ink-soft mb-4">
                当サービスは、以下の場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。
              </p>
              <ul className="grid md:grid-cols-2 gap-3 mb-6">
                {['法令に基づく場合', '人の生命・身体・財産の保護に必要な場合', '公衆衛生・児童の健全育成に必要な場合', '国の機関等への協力が必要な場合'].map((item, i) => (
                  <li key={i} className="bg-counter/60 px-4 py-3 rounded-lg text-sm text-ink border border-rule">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-ink-soft mb-4">
                サービス提供のために必要な範囲で、以下の委託先に個人情報の取り扱いを委託する場合があります。
              </p>
              <ul className="grid md:grid-cols-2 gap-3">
                {[
                  { name: 'Supabase', desc: 'データベース・認証基盤' },
                  { name: 'Stripe', desc: '決済処理' },
                  { name: 'LINEヤフー株式会社', desc: 'メッセージング・ログイン' },
                  { name: 'Resend', desc: 'メール認証' },
                  { name: 'Google LLC', desc: 'カレンダー API（ユーザーが連携を許可した場合のみ）、Gemini API（AI自動応答・分析でメッセージ内容を処理）' },
                  { name: 'Vercel Inc.', desc: 'Webアプリのホスティング' },
                  { name: 'QR Server（api.qrserver.com）', desc: '会員証のQRコード表示' },
                ].map((item, i) => (
                  <li key={i} className="bg-counter/60 px-4 py-3 rounded-lg text-sm border border-rule">
                    <span className="font-bold text-ink">{item.name}</span>
                    <span className="text-ink-soft"> — {item.desc}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Section 5: Retention */}
            <section className="border-t-2 border-ink pt-8 pb-2">
              <div className="mb-5">
                <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">5. データの保存場所と保持期間</h2>
              </div>
              <p className="text-ink-soft mb-4">
                当サービスは、ユーザーデータを Supabase が提供するクラウドサーバー上に保存します。通信は暗号化され、データベースへのアクセスは Row Level Security（RLS）等により制御されます。
              </p>
              <ul className="space-y-3">
                {[
                  'アカウント情報: サービス利用中は保持します。管理画面から退会された場合は即時、メール等でのご申請の場合は30日以内に削除します。',
                  'Google 連携トークン: 連携解除時、または退会時に失効・削除します。',
                  '予約・メッセージデータ: 管理画面から退会された場合は即時、メール等でのご申請の場合は30日以内に削除します。',
                  'アクセスログ: セキュリティ目的で最大90日間保持した後、自動削除します。',
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-ink-soft">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-600 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Section 6: Deletion & Revocation */}
            <section className="border-t-2 border-ink pt-8 pb-2">
              <div className="mb-5">
                <h2 className="text-[22px] font-black leading-snug tracking-[-0.01em] scroll-mt-24">6. データの削除とアクセス取り消し</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-ink mb-2">Google カレンダー連携の解除（アプリ内）</h3>
                  <p className="text-sm text-ink-soft mb-3">以下のいずれかの方法で、Google カレンダー連携を解除できます。連携解除後、保存されたリフレッシュトークンは削除されます。</p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-ink-soft">
                    <li>予約管理画面（<Link to="/reservations" className="text-primary-800 hover:underline">/reservations</Link>）の Google カレンダー連携設定から「連携を解除」を選択</li>
                    <li>LINE 設定 &gt; カレンダー連携タブから「連携を解除」を選択</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-bold text-ink mb-2">Google アカウント側からの取り消し</h3>
                  <p className="text-sm text-ink-soft">
                    <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary-800 hover:underline font-medium">
                      Google アカウントの連携アプリ管理
                    </a>
                    から IToguchi のアクセス権を削除することもできます。
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-ink mb-2">アカウント退会・全データ削除</h3>
                  <p className="text-sm text-ink-soft">
                    管理画面の「設定」→「プラン」タブから、いつでもご自身でアカウントを削除できます。
                    削除を実行すると、アカウント情報・店舗データ・外部サービスとの連携がその場で削除され、
                    ご契約中のプランは無料お試し期間中のものも含めて解約されます。
                  </p>
                  <p className="text-sm text-ink-soft mt-2">
                    操作でお困りの場合は
                    <a href="mailto:itoguchi.app@gmail.com" className="text-primary-800 hover:underline font-medium mx-1">itoguchi.app@gmail.com</a>
                    または
                    <a href="https://line.me/R/ti/p/@431cghfd" target="_blank" rel="noopener noreferrer" className="text-primary-800 hover:underline font-medium mx-1">公式 LINE（@431cghfd）</a>
                    までご連絡ください。ご連絡による退会申請の場合は、30日以内にデータを削除いたします。
                  </p>
                </div>
              </div>
            </section>

            {/* Section 7 & 8: Management & Changes */}
            <div className="grid md:grid-cols-2 gap-8">
              <section className="border-t-2 border-ink pt-8 pb-2">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-lg font-bold text-ink">7. 情報の管理と保護</h2>
                </div>
                <p className="text-ink-soft text-sm leading-relaxed">
                  当サービスは、ユーザーの個人情報を正確かつ最新の状態に保ち、個人情報への不正アクセス・紛失・破損・改ざん・漏洩などを防止するため、セキュリティシステムの維持・管理体制の整備等の必要な措置を講じます。
                </p>
              </section>

              <section className="border-t-2 border-ink pt-8 pb-2">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-lg font-bold text-ink">8. ポリシーの変更</h2>
                </div>
                <p className="text-ink-soft text-sm leading-relaxed">
                  本ポリシーの内容は、法令その他本ポリシーに別段の定めのある事項を除いて、ユーザーに通知することなく変更することができるものとします。変更後のプライバシーポリシーは、本ウェブサイトに掲載したときから効力を生じるものとします。
                </p>
              </section>
            </div>

            {/* Section 9: Contact */}
            <section className="bg-paper rounded-xl border border-rule p-8 text-center">
              <div className="inline-flex p-3 bg-primary-50 rounded-full mb-6">
                <Mail className="w-8 h-8 text-primary-800" />
              </div>
              <h2 className="text-2xl font-bold text-ink mb-4">9. お問い合わせ</h2>
              <p className="text-ink-soft mb-8 max-w-lg mx-auto">
                本ポリシーに関するお問い合わせは、以下の窓口までお願いいたします。
              </p>
              <div className="bg-counter/60 rounded-xl p-6 max-w-md mx-auto border border-rule">
                <p className="font-bold text-lg text-ink mb-2">IToguchi 運営事務局</p>
                <p className="text-ink-soft mb-2">
                  <a href="mailto:itoguchi.app@gmail.com" className="text-primary-800 hover:text-primary-800 transition-colors font-medium">
                    itoguchi.app@gmail.com
                  </a>
                </p>
                <p className="text-ink-soft text-sm">
                  <a href="https://line.me/R/ti/p/@431cghfd" target="_blank" rel="noopener noreferrer" className="text-primary-800 hover:text-primary-800 transition-colors font-medium">
                    公式LINE: @431cghfd
                  </a>
                </p>
              </div>
            </section>
          </div>
        </LegalLayout>
  )
}

export default PrivacyPolicy
