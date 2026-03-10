import { motion } from 'framer-motion'
import { CreditCard, Loader2, ArrowRight, ArrowLeft, Check, Gift, AlertTriangle } from 'lucide-react'

type PlanType = 'free' | 'pro' | 'executive'

interface PlanSelectStepProps {
  selectedPlan: PlanType
  onSelectedPlanChange: (plan: PlanType) => void
  hasUsedTrial: boolean
  isPreReleaseMode: boolean
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

        {/* プレリリース特典 or リリース特典（トライアル未使用の場合のみ表示） */}
        {!hasUsedTrial && isPreReleaseMode && (
          /* プレリリースモニター特典 */
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Gift className="w-6 h-6" />
              <span className="font-bold text-lg">🎁 プレリリースモニター限定特典</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 mb-4">
              <div className="text-center mb-4">
                <div className="text-4xl md:text-5xl font-bold text-yellow-300 mb-2">
                  2ヶ月無料
                </div>
                <p className="text-primary-100">
                  Proプラン（通常 ¥4,980/月）が無料で使えます
                </p>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-yellow-300 shrink-0 mt-0.5" />
                  <span>Proプランの全機能を<span className="font-bold text-yellow-300">2ヶ月間無料</span>で利用可能</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-yellow-300 shrink-0 mt-0.5" />
                  <span>ご登録いただいた<span className="font-bold text-yellow-300">データはそのまま継続</span>利用可能</span>
                </li>
              </ul>
            </div>
            {/* 注意事項 */}
            <div className="bg-primary-900/30 border border-primary-300/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-300 shrink-0 mt-0.5" />
                <div className="text-sm text-primary-100">
                  <p className="font-bold text-yellow-300 mb-2">プレリリース版についてのご注意</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>現在開発中のため、<span className="font-medium text-yellow-300">仕様が予告なく変更</span>される場合があります</li>
                    <li>一部機能に<span className="font-medium text-yellow-300">不具合</span>が発生する可能性があります</li>
                    <li>プレリリース期間中は<span className="font-medium text-yellow-300">サポート対応ができません</span></li>
                    <li>LINE初期設定代行（¥9,980）は<span className="font-medium text-yellow-300">ご利用いただけません</span></li>
                    <li>クレジットカード登録が必須です。<span className="font-medium text-yellow-300">2ヶ月後から自動更新</span>で課金されます</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 正式リリース時のリリース特典（トライアル未使用の場合のみ表示） */}
        {!hasUsedTrial && !isPreReleaseMode && (
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Gift className="w-6 h-6" />
              <span className="font-bold text-lg">🎉 リリース特典 - 2つのコースから選べます</span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Course 1 */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <div className="bg-white text-primary-700 text-xs font-bold px-2 py-1 rounded-full inline-block mb-3">
                  すぐ使いたい方向け
                </div>
                <h4 className="text-lg font-bold mb-3 text-yellow-300">スピード導入コース</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-yellow-300 shrink-0 mt-0.5" />
                    <span>初期設定代行費（¥9,980）が<span className="font-bold text-yellow-300">無料</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-yellow-300 shrink-0 mt-0.5" />
                    <span>Proプラン<span className="font-bold text-yellow-300">初月無料</span></span>
                  </li>
                </ul>
              </div>
              {/* Course 2 */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <div className="bg-white text-primary-700 text-xs font-bold px-2 py-1 rounded-full inline-block mb-3">
                  安く使いたい方向け
                </div>
                <h4 className="text-lg font-bold mb-3 text-yellow-300">じっくりお得コース</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-yellow-300 shrink-0 mt-0.5" />
                    <span>Proプランが<span className="font-bold text-yellow-300">3ヶ月間無料</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-yellow-300 shrink-0 mt-0.5" />
                    <span>初期設定代行（¥9,980）を利用可能</span>
                  </li>
                </ul>
              </div>
            </div>
            <p className="text-center text-primary-100 text-xs mt-4">
              ※ 特典の適用には、導入後のインタビューフォームへの回答が必要です。
            </p>
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
                  {isPreReleaseMode ? '2ヶ月無料' : '初月無料'}
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
