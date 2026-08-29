import { motion } from 'framer-motion'
import { CreditCard, Loader2, ArrowRight, ArrowLeft, Check, Gift } from 'lucide-react'

type PlanType = 'free' | 'pro' | 'executive'

interface PlanSelectStepProps {
  selectedPlan: PlanType
  onSelectedPlanChange: (plan: PlanType) => void
  hasUsedTrial: boolean
  isPreReleaseMode: boolean
  /** モニター特典（初期設定代行の無償提供）に同意したか。 */
  monitorConsent: boolean
  onMonitorConsentChange: (agreed: boolean) => void
  /** LINE公式アカウントを既に持っているか。初期設定手順メールの内容が変わる。 */
  hasLineAccount: boolean
  onHasLineAccountChange: (has: boolean) => void
  /** 管理者のみ。Stripe決済を経由せずに次のステップへ進めるかどうか。 */
  isAdmin: boolean
  onSkipPayment: () => void
  loading: boolean
  progressMsg: string
  onPlanSelect: () => void
  onBack: () => void
}

export default function PlanSelectStep({
  selectedPlan,
  onSelectedPlanChange,
  hasUsedTrial,
  isPreReleaseMode,
  monitorConsent,
  onMonitorConsentChange,
  hasLineAccount,
  onHasLineAccountChange,
  isAdmin,
  onSkipPayment,
  loading,
  progressMsg,
  onPlanSelect,
  onBack,
}: PlanSelectStepProps) {
  return (
    <motion.div
      key="plan_select"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8">
        <div className="text-center mb-8">
          <div className="bg-primary-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <CreditCard className="text-primary-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">プランを選択</h1>
          <p className="text-slate-500">あなたのビジネスに合ったプランをお選びください。</p>
        </div>

        {/* トライアル未使用の場合のみ表示 */}
        {!hasUsedTrial && (
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Gift className="w-6 h-6" />
              <span className="font-bold text-lg">リリース記念特典</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <div className="text-center mb-4">
                <div className="text-4xl md:text-5xl font-bold text-yellow-300 mb-2">30日間無料</div>
                <p className="text-primary-100">
                  Proプラン（通常 ¥4,980/月）を<span className="font-bold text-yellow-300">30日間</span>お試しいただけます
                </p>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-yellow-300 shrink-0 mt-0.5" />
                  <span>Proプランの全機能を<span className="font-bold text-yellow-300">30日間無料</span>で利用可能</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-yellow-300 shrink-0 mt-0.5" />
                  <span>ご登録いただいた<span className="font-bold text-yellow-300">データはそのまま継続</span>利用可能</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* プランカード */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Free Plan */}
          <div
            onClick={() => onSelectedPlanChange('free')}
            className={`relative p-8 rounded-3xl cursor-pointer transition-all flex flex-col ${
              selectedPlan === 'free'
                ? 'border-2 border-primary-500 bg-white shadow-xl'
                : 'border border-slate-200 bg-white shadow-sm hover:shadow-md'
            }`}
          >
            {selectedPlan === 'free' && (
              <div className="absolute -top-3 -left-3 bg-primary-600 text-white p-2 rounded-full">
                <Check size={20} />
              </div>
            )}
            <div className="mb-4">
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-wider">Starter</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Free</h3>
            <div className="flex items-baseline mb-8">
              <span className="text-4xl font-bold text-slate-900">¥0</span>
              <span className="text-slate-500 ml-2">/月</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              {[
                '予約管理（無制限）',
                '固定応答 10件',
                'ポイントカード基本機能',
                '※一部機能制限あり'
              ].map((item, i) => (
                <li key={i} className="flex items-center text-slate-600">
                  <Check className="w-5 h-5 text-primary-500 mr-3 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro Plan */}
          <div
            onClick={() => onSelectedPlanChange('pro')}
            className={`relative p-8 rounded-3xl cursor-pointer transition-all flex flex-col transform md:-translate-y-4 ${
              selectedPlan === 'pro'
                ? 'border-2 border-primary-500 bg-white shadow-2xl'
                : 'border-2 border-primary-500 bg-white shadow-xl'
            }`}
          >
            <div className="absolute top-0 right-0 bg-primary-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl rounded-tr-2xl">
              おすすめ
            </div>
            {selectedPlan === 'pro' && (
              <div className="absolute -top-3 -left-3 bg-primary-600 text-white p-2 rounded-full">
                <Check size={20} />
              </div>
            )}
            <div className="mb-4">
              <span className="px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-xs font-bold uppercase tracking-wider">Standard</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Pro</h3>
            {!hasUsedTrial && (
              <div className="mb-3">
                <span className="inline-block bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded">
                  {isPreReleaseMode ? '2ヶ月無料' : '30日間無料'}
                </span>
              </div>
            )}
            <div className="flex items-baseline mb-8">
              <span className="text-4xl font-bold text-slate-900">¥4,980</span>
              <span className="text-slate-500 ml-2">/月</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              {[
                '全機能解放',
                'Googleカレンダー連携',
                'デジタル会員証（フル機能）',
                '無制限応答 & AI応答',
                '詳細分析レポート'
              ].map((item, i) => (
                <li key={i} className="flex items-center text-slate-700 font-medium">
                  <Check className="w-5 h-5 text-primary-600 mr-3 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Executive Plan */}
          <div
            className="relative p-8 rounded-3xl flex flex-col border border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
          >
            <div className="mb-4">
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-wider">Coming Soon</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Executive</h3>
            <div className="flex items-baseline mb-8">
              <span className="text-3xl font-bold text-slate-900">¥19,800〜</span>
              <span className="text-slate-500 ml-2">/月</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              {[
                '複数店舗管理',
                'ホワイトラベル',
                '個別相談・コンサル',
                '独自開発の依頼権'
              ].map((item, i) => (
                <li key={i} className="flex items-center text-slate-600">
                  <Check className="w-5 h-5 text-primary-500 mr-3 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* モニター特典。Pro を選んだときだけ意味を持つので、そのときだけ出す。
          チェックそのものが申込であり、同意しない人は特典の対象にならない。 */}
      {selectedPlan === 'pro' && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Gift className="w-6 h-6 text-primary-600" />
            <h2 className="font-bold text-lg text-slate-800">モニター特典（任意）</h2>
          </div>

          <div className="bg-primary-50 border border-primary-100 rounded-xl p-5 mb-5">
            <p className="text-2xl font-bold text-primary-700 mb-1">
              LINE初期設定代行が無料
            </p>
            <p className="text-sm text-slate-600">
              通常 ¥9,980 の初期設定代行を、こちらで無償で行います。
              LINE公式アカウントの開設から予約枠の設定まで代行するので、
              設定作業をしていただく必要はありません。
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={monitorConsent}
              onChange={(e) => onMonitorConsentChange(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 shrink-0"
            />
            <span className="text-sm text-slate-700">
              設定のしやすさなどについて、
              <span className="font-bold">簡単なインタビューフォームへの回答に協力します</span>。
              <span className="block text-slate-500 mt-1">
                これが特典の適用条件です。チェックしない場合も Pro プランには通常どおりご加入いただけます
                （初期設定代行は通常価格 ¥9,980 になります）。
              </span>
            </span>
          </label>

          {/* 送る手順が変わるため、同意した人にだけ聞く。
              「持っていない」なら公式アカウントの開設手順から案内する。 */}
          {monitorConsent && (
            <div className="mt-5 pt-5 border-t border-slate-100">
              <p className="text-sm font-bold text-slate-700 mb-3">
                LINE公式アカウントはお持ちですか？
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onHasLineAccountChange(true)}
                  className={`text-left px-4 py-3 rounded-xl border transition ${
                    hasLineAccount
                      ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="block font-bold text-slate-800 text-sm">持っている</span>
                  <span className="block text-xs text-slate-500 mt-0.5">連携の手順をお送りします</span>
                </button>
                <button
                  type="button"
                  onClick={() => onHasLineAccountChange(false)}
                  className={`text-left px-4 py-3 rounded-xl border transition ${
                    !hasLineAccount
                      ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="block font-bold text-slate-800 text-sm">持っていない</span>
                  <span className="block text-xs text-slate-500 mt-0.5">開設の手順からご案内します</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 検証用。毎回Stripeの決済を通さずに登録フローを最後まで確認するための導線。
          管理者にしか表示せず、Proプランは付与しない（決済していないため）。 */}
      {isAdmin && selectedPlan === 'pro' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-sm font-bold text-amber-900 mb-1">開発用: 決済をスキップ</p>
          <p className="text-xs text-amber-800 mb-3">
            管理者にのみ表示されます。Stripeの決済ページを経由せずに次のステップへ進みます。
            <span className="font-bold">Proプランは付与されません。</span>
            モニター特典に同意していれば、申込の記録・初期設定代行の作成・
            各種メールの送信は通常どおり実行されます。
          </p>
          <button
            onClick={onSkipPayment}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            決済せずに次へ進む
          </button>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium"
        >
          <ArrowLeft size={20} />
          戻る
        </button>
        <button
          onClick={onPlanSelect}
          disabled={loading}
          className="flex items-center gap-2 bg-primary-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-primary-700 transition shadow-lg shadow-primary-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {progressMsg || '処理中...'}
            </>
          ) : (
            <>
              次へ進む
              <ArrowRight size={20} />
            </>
          )}
        </button>
      </div>
    </motion.div>
  )
}
