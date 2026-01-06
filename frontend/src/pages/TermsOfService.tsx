import React from 'react'
import { Link } from 'react-router-dom'
import { 
  FileText, UserPlus, Lock, CreditCard, Share2, AlertTriangle, 
  Power, UserX, LogOut, ShieldAlert, RefreshCw, FileEdit, 
  Shield, Bell, Ban, Scale
} from 'lucide-react'
import iconImage from '../assets/icon.png'

const TermsOfService: React.FC = () => {
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
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">利用規約</h1>
            <p className="text-slate-500">制定日: 2025年12月31日</p>
          </div>

          <div className="space-y-8">
            {/* Introduction */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <p className="text-slate-600 leading-relaxed">
                この利用規約（以下，「本規約」といいます。）は，IToguchi（以下，「当サービス」といいます。）が提供するサービス（以下，「本サービス」といいます。）の利用条件を定めるものです。登録ユーザーの皆さま（以下，「ユーザー」といいます。）には，本規約に従って，本サービスをご利用いただきます。
              </p>
            </div>

            {/* 第1条 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <FileText className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">第1条（適用）</h2>
              </div>
              <ol className="list-decimal list-outside pl-5 space-y-2 text-slate-600">
                <li>本規約は，ユーザーと当サービスとの間の本サービスの利用に関わる一切の関係に適用されるものとします。</li>
                <li>当サービスは本サービスに関し，本規約のほか，ご利用にあたってのルール等，各種の定め（以下，「個別規定」といいます。）をすることがあります。これら個別規定はその名称のいかんに関わらず，本規約の一部を構成するものとします。</li>
                <li>本規約の規定が前項の個別規定の規定と矛盾する場合には，個別規定において特段の定めなき限り，個別規定の規定が優先されるものとします。</li>
              </ol>
            </section>

            {/* 第2条 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <UserPlus className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">第2条（利用登録）</h2>
              </div>
              <ol className="list-decimal list-outside pl-5 space-y-2 text-slate-600">
                <li>本サービスにおいては，登録希望者が本規約に同意の上，当サービスの定める方法によって利用登録を申請し，当サービスがこれを承認することによって，利用登録が完了するものとします。</li>
                <li>当サービスは，利用登録の申請者に以下の事由があると判断した場合，利用登録の申請を承認しないことがあり，その理由については一切の開示義務を負わないものとします。
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>利用登録の申請に際して虚偽の事項を届け出た場合</li>
                    <li>本規約に違反したことがある者からの申請である場合</li>
                    <li>その他，当サービスが利用登録を相当でないと判断した場合</li>
                  </ul>
                </li>
              </ol>
            </section>

            {/* 第3条 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">第3条（ユーザーIDおよびパスワードの管理）</h2>
              </div>
              <ol className="list-decimal list-outside pl-5 space-y-2 text-slate-600">
                <li>ユーザーは，自己の責任において，本サービスのユーザーIDおよびパスワードを適切に管理するものとします。</li>
                <li>ユーザーは，いかなる場合にも，ユーザーIDおよびパスワードを第三者に譲渡または貸与し，もしくは第三者と共用することはできません。当サービスは，ユーザーIDとパスワードの組み合わせが登録情報と一致してログインされた場合には，そのユーザーIDを登録しているユーザー自身による利用とみなします。</li>
                <li>ユーザーID及びパスワードが第三者によって使用されたことによって生じた損害は，当サービスに故意又は重大な過失がある場合を除き，当サービスは一切の責任を負わないものとします。</li>
              </ol>
            </section>

            {/* 第4条 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">第4条（利用料金および支払方法）</h2>
              </div>
              <ol className="list-decimal list-outside pl-5 space-y-2 text-slate-600">
                <li>ユーザーは，本サービスの有料部分（Proプラン、Executiveプラン等）の対価として，当サービスが別途定め，本ウェブサイトに表示する利用料金を，当サービスが指定する方法により支払うものとします。</li>
                <li>ユーザーが利用料金の支払を遅滞した場合には，ユーザーは年14.6％の割合による遅延損害金を支払うものとします。</li>
              </ol>
            </section>

            {/* 第5条 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <Share2 className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">第5条（外部サービス連携）</h2>
              </div>
              <ol className="list-decimal list-outside pl-5 space-y-2 text-slate-600">
                <li>本サービスは、LINE株式会社が提供するLINE Messaging APIおよびGoogle LLCが提供するGoogle Calendar API等の外部サービス（以下「外部サービス」といいます）と連携して機能を提供します。</li>
                <li>ユーザーは、外部サービスの利用規約および運用ルールを遵守するものとします。</li>
                <li>外部サービスの仕様変更、障害、またはユーザーによる外部サービス設定の不備等により本サービスが正常に動作しない場合において、当サービスは一切の責任を負わないものとします。</li>
                <li>Googleカレンダー連携において、本サービスはGoogleカレンダーを予約情報の「正（Source of Truth）」として扱います。同期の遅延や不整合により生じた損害（ダブルブッキング等を含む）について、当サービスは商業的に合理的な範囲で対策を行いますが、完全な整合性を保証するものではありません。</li>
              </ol>
            </section>

            {/* 第6条 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-red-50 rounded-lg text-red-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">第6条（禁止事項）</h2>
              </div>
              <p className="text-slate-600 mb-4">ユーザーは，本サービスの利用にあたり，以下の行為をしてはなりません。</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>法令または公序良俗に違反する行為</li>
                <li>犯罪行為に関連する行為</li>
                <li>本サービスの内容等，本サービスに含まれる著作権，商標権ほか知的財産権を侵害する行為</li>
                <li>当サービス，ほかのユーザー，またはその他第三者のサーバーまたはネットワークの機能を破壊したり，妨害したりする行為</li>
                <li>本サービスによって得られた情報を商業的に利用する行為</li>
                <li>当サービスのサービスの運営を妨害するおそれのある行為</li>
                <li>不正アクセスをし，またはこれを試みる行為</li>
                <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
                <li>不正な目的を持って本サービスを利用する行為</li>
                <li>本サービスの他のユーザーまたはその他の第三者に不利益，損害，不快感を与える行為</li>
                <li>他のユーザーに成りすます行為</li>
                <li>当サービスが許諾しない本サービス上での宣伝，広告，勧誘，または営業行為</li>
                <li>面識のない異性との出会いを目的とした行為</li>
                <li>当サービスのサービスに関連して，反社会的勢力に対して直接または間接に利益を供与する行為</li>
                <li>その他，当サービスが不適切と判断する行為</li>
              </ul>
            </section>

            {/* 第7条 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <Power className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">第7条（本サービスの提供の停止等）</h2>
              </div>
              <ol className="list-decimal list-outside pl-5 space-y-2 text-slate-600">
                <li>当サービスは，以下のいずれかの事由があると判断した場合，ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>本サービスにかかるコンピュータシステムの保守点検または更新を行う場合</li>
                    <li>地震，落雷，火災，停電または天災などの不可抗力により，本サービスの提供が困難となった場合</li>
                    <li>コンピュータまたは通信回線等が事故により停止した場合</li>
                    <li>その他，当サービスが本サービスの提供を困難と判断した場合</li>
                  </ul>
                </li>
                <li>当サービスは，本サービスの提供の停止または中断により，ユーザーまたは第三者が被ったいかなる不利益または損害についても，一切の責任を負わないものとします。</li>
              </ol>
            </section>

            {/* 第8条 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <UserX className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">第8条（利用制限および登録抹消）</h2>
              </div>
              <ol className="list-decimal list-outside pl-5 space-y-2 text-slate-600">
                <li>当サービスは，ユーザーが以下のいずれかに該当する場合には，事前の通知なく，ユーザーに対して，本サービスの全部もしくは一部の利用を制限し，またはユーザーとしての登録を抹消することができるものとします。
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>本規約のいずれかの条項に違反した場合</li>
                    <li>登録事項に虚偽の事実があることが判明した場合</li>
                    <li>料金等の支払債務の不履行があった場合</li>
                    <li>当サービスからの連絡に対し，一定期間返答がない場合</li>
                    <li>本サービスについて，最終の利用から一定期間利用がない場合</li>
                    <li>その他，当サービスが本サービスの利用を適当でないと判断した場合</li>
                  </ul>
                </li>
                <li>当サービスは，本条に基づき当サービスが行った行為によりユーザーに生じた損害について，一切の責任を負いません。</li>
              </ol>
            </section>

            {/* 第9条 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <LogOut className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">第9条（退会）</h2>
              </div>
              <p className="text-slate-600">ユーザーは，当サービスの定める退会手続により，本サービスから退会できるものとします。</p>
            </section>

            {/* 第10条 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">第10条（保証の否認および免責事項）</h2>
              </div>
              <ol className="list-decimal list-outside pl-5 space-y-2 text-slate-600">
                <li>当サービスは，本サービスに事実上または法律上の瑕疵（安全性，信頼性，正確性，完全性，有効性，特定の目的への適合性，セキュリティなどに関する欠陥，エラーやバグ，権利侵害などを含みます。）がないことを明示的にも黙示的にも保証しておりません。</li>
                <li>当サービスは，本サービスに起因してユーザーに生じたあらゆる損害について、当サービスの故意又は重過失による場合を除き、一切の責任を負いません。ただし，本サービスに関する当サービスとユーザーとの間の契約（本規約を含みます。）が消費者契約法に定める消費者契約となる場合，この免責規定は適用されません。</li>
                <li>前項ただし書に定める場合であっても，当サービスは，当サービスの過失（重過失を除きます。）による債務不履行または不法行為によりユーザーに生じた損害のうち特別な事情から生じた損害（当サービスまたはユーザーが損害発生につき予見し，または予見し得た場合を含みます。）について一切の責任を負いません。また，当サービスの過失（重過失を除きます。）による債務不履行または不法行為によりユーザーに生じた損害の賠償は，ユーザーから当該損害が発生した月に受領した利用料の額を上限とします。</li>
              </ol>
            </section>

            {/* 第10条の2: 予約管理およびAI応答に関する責任 */}
            <section className="bg-white rounded-2xl shadow-md border-l-4 border-red-500 p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <AlertTriangle className="w-32 h-32 text-red-500" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-red-50 rounded-lg text-red-600">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">第10条の2（予約管理およびAI応答に関する責任）</h2>
                </div>
                <div className="bg-red-50/50 rounded-xl p-6 mb-6 border border-red-100">
                  <p className="text-slate-700 font-medium mb-4">
                    本サービスは予約管理やAI応答などの店舗運営支援機能を提供しますが、これらの機能の利用により生じた問題について、以下のとおり責任を制限します。
                  </p>
                </div>
                <ol className="list-decimal list-outside pl-5 space-y-3 text-slate-600">
                  <li><strong>予約管理機能に関する責任</strong>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li>本サービスは予約情報の管理・表示機能を提供しますが、予約の受付、確認、キャンセル等の最終的な判断および実行は、ユーザー（店舗オーナー）の責任において行われるものとします。</li>
                      <li>予約の重複（ダブルブッキング）、予約情報の誤り、予約の取り消し漏れ、営業時間外の予約受付等により生じた損害について、当サービスは一切の責任を負いません。</li>
                      <li>Googleカレンダーとの連携機能において、同期の遅延や不整合により予約の重複等が発生した場合、当サービスは商業的に合理的な範囲で対策を行いますが、完全な整合性を保証するものではありません。</li>
                      <li>ユーザーは、予約情報を定期的に確認し、必要に応じて手動で調整する責任を負います。</li>
                    </ul>
                  </li>
                  <li><strong>AI応答機能に関する責任</strong>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li>本サービスのAI応答機能は、ユーザーが提供した資料を学習して自動応答を生成しますが、応答内容の正確性、適切性、法的妥当性等について、当サービスは一切保証しません。</li>
                      <li>AI応答により顧客に誤った情報が伝達された場合、顧客とのトラブルが発生した場合、または法的問題が生じた場合において、当サービスは一切の責任を負いません。</li>
                      <li>ユーザーは、AI応答の内容を定期的に確認し、必要に応じて修正・改善する責任を負います。</li>
                      <li>AI応答により生じた顧客からのクレーム、損害賠償請求等については、ユーザーが責任を負うものとし、当サービスは一切の責任を負いません。</li>
                    </ul>
                  </li>
                  <li><strong>その他の店舗運営に関する責任</strong>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li>本サービスは店舗運営を支援するツールを提供するものであり、店舗運営そのものに関する責任はユーザーが負うものとします。</li>
                      <li>顧客との契約、取引、サービス提供等に関する一切の責任はユーザーが負うものとし、当サービスは一切の責任を負いません。</li>
                      <li>本サービスの利用により生じた顧客からのクレーム、損害賠償請求等については、ユーザーが責任を負うものとします。</li>
                    </ul>
                  </li>
                </ol>
              </div>
            </section>

            {/* 第11条 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">第11条（サービス内容の変更等）</h2>
              </div>
              <p className="text-slate-600">当サービスは，ユーザーへの事前の告知をもって、本サービスの内容を変更、追加または廃止することがあり、ユーザーはこれを承諾するものとします。</p>
            </section>

            {/* 第12条 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <FileEdit className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">第12条（利用規約の変更）</h2>
              </div>
              <ol className="list-decimal list-outside pl-5 space-y-2 text-slate-600">
                <li>当サービスは以下の場合には、ユーザーの個別の同意を要せず、本規約を変更することができるものとします。
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>本規約の変更がユーザーの一般の利益に適合するとき。</li>
                    <li>本規約の変更が本サービス利用契約の目的に反せず、かつ、変更の必要性、変更後の内容の相当性その他の変更に係る事情に照らして合理的なものであるとき。</li>
                  </ul>
                </li>
                <li>当サービスはユーザーに対し、前項による本規約の変更にあたり、事前に、本規約を変更する旨及び変更後の本規約の内容並びにその効力発生時期を通知します。</li>
              </ol>
            </section>

            {/* 第13条 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <Shield className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">第13条（個人情報の取扱い）</h2>
              </div>
              <p className="text-slate-600">当サービスは，本サービスの利用によって取得する個人情報については，当サービス「プライバシーポリシー」に従い適切に取り扱うものとします。</p>
            </section>

            {/* 第14条 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <Bell className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">第14条（通知または連絡）</h2>
              </div>
              <p className="text-slate-600">ユーザーと当サービスとの間の通知または連絡は，当サービスの定める方法によって行うものとします。当サービスは,ユーザーから,当サービスが別途定める方式に従った変更届け出がない限り,現在登録されている連絡先が有効なものとみなして当該連絡先へ通知または連絡を行い,これらは,発信時にユーザーへ到達したものとみなします。</p>
            </section>

            {/* 第15条 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <Ban className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">第15条（権利義務の譲渡の禁止）</h2>
              </div>
              <p className="text-slate-600">ユーザーは，当サービスの書面による事前の承諾なく，利用契約上の地位または本規約に基づく権利もしくは義務を第三者に譲渡し，または担保に供することはできません。</p>
            </section>

            {/* 第16条 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <Scale className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">第16条（準拠法・裁判管轄）</h2>
              </div>
              <ol className="list-decimal list-outside pl-5 space-y-2 text-slate-600">
                <li>本規約の解釈にあたっては，日本法を準拠法とします。</li>
                <li>本サービスに関して紛争が生じた場合には，当サービスの本店所在地を管轄する裁判所を専属的合意管轄とします。</li>
              </ol>
            </section>

            <div className="mt-8 pt-8 border-t border-slate-200 text-center">
              <p className="text-sm text-slate-500">
                以上
              </p>
            </div>
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

export default TermsOfService
