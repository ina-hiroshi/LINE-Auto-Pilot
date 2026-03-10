import { Crown, Shield, Zap } from 'lucide-react'

export interface PlanSwitcherTabProps {
  currentPlan: string
  planLoading: boolean
  onPlanChange: (newPlan: string) => void
}

export function PlanSwitcherTab({
  currentPlan,
  planLoading,
  onPlanChange,
}: PlanSwitcherTabProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Crown size={20} className="text-yellow-500" />
          プラン切り替え（デバッグ用）
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          現在のプラン: <span className="font-bold uppercase text-primary-600">{currentPlan}</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => onPlanChange('free')}
            disabled={planLoading || currentPlan === 'free'}
            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
              currentPlan === 'free'
                ? 'border-gray-300 bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <Shield size={20} className="text-gray-600" />
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-900">Free Plan</div>
              <div className="text-xs text-gray-500">無料プラン</div>
            </div>
          </button>

          <button
            onClick={() => onPlanChange('pro')}
            disabled={planLoading || currentPlan === 'pro'}
            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
              currentPlan === 'pro'
                ? 'border-primary-200 bg-primary-50 text-primary-400 cursor-not-allowed'
                : 'border-gray-200 hover:border-primary-400 hover:bg-primary-50'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <Zap size={20} className="text-primary-600" />
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-900">Pro Plan</div>
              <div className="text-xs text-gray-500">AI応答・無制限</div>
            </div>
          </button>

          <button
            onClick={() => onPlanChange('executive')}
            disabled={planLoading || currentPlan === 'executive'}
            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
              currentPlan === 'executive'
                ? 'border-yellow-200 bg-yellow-50 text-yellow-400 cursor-not-allowed'
                : 'border-gray-200 hover:border-yellow-400 hover:bg-yellow-50'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <Crown size={20} className="text-yellow-600" />
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-900">Executive Plan</div>
              <div className="text-xs text-gray-500">全機能・優先サポート</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
