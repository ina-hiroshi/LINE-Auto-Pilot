import { useEffect, useState } from 'react'
import { Gift, CreditCard } from 'lucide-react'
import type { MembershipCardSettings } from '../../../hooks/usePointOperation'

type PointOperationPanelProps = {
  balance: number
  storeSettings: MembershipCardSettings | null
  saving?: boolean
  onSubmit: (amount: number, type: 'add' | 'use') => void
  compact?: boolean
  /** 顧客管理と同じグレーカードで囲む */
  variant?: 'plain' | 'card'
  /** 付与のみ（決済後プロンプト向け） */
  addOnly?: boolean
  /** 操作説明の注釈を表示 */
  showHints?: boolean
  initialAmount?: string
}

export function PointOperationPanel({
  balance,
  storeSettings,
  saving = false,
  onSubmit,
  compact = false,
  variant = 'plain',
  addOnly = false,
  showHints = false,
  initialAmount = '',
}: PointOperationPanelProps) {
  const [amount, setAmount] = useState(initialAmount)
  const [type, setType] = useState<'add' | 'use'>('add')

  useEffect(() => {
    if (initialAmount) setAmount(initialAmount)
  }, [initialAmount])

  const isStamp = storeSettings?.card_type === 'stamp'
  const unit = isStamp ? '個' : 'pt'
  const operationType = addOnly ? 'add' : type

  const handleExecute = () => {
    const n = parseInt(amount, 10)
    if (isNaN(n) || n <= 0) return
    onSubmit(n, operationType)
    setAmount(initialAmount || '')
  }

  const panel = (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="flex items-baseline gap-2">
        <span className={`font-bold text-primary-600 ${compact ? 'text-2xl' : 'text-3xl'}`}>
          {balance.toLocaleString()}
        </span>
        <span className="text-sm text-gray-500">{unit}</span>
      </div>

      {!addOnly && (
        <div className="flex p-1 bg-gray-200 rounded-lg">
          <button
            type="button"
            onClick={() => setType('add')}
            className={`flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${
              type === 'add' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Gift className="w-4 h-4" />
            {isStamp ? 'スタンプ押印' : '付与する'}
          </button>
          <button
            type="button"
            onClick={() => setType('use')}
            className={`flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${
              type === 'use' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            {isStamp ? '特典交換' : '利用する'}
          </button>
        </div>
      )}

      <div className="bg-white p-3 rounded-lg border border-gray-200">
        <label className="block text-xs font-medium text-gray-500 mb-2">
          {operationType === 'add'
            ? isStamp
              ? '押印するスタンプ数'
              : '付与するポイント数'
            : isStamp
              ? '消費するスタンプ数'
              : '利用するポイント数'}
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
              placeholder="0"
              min={1}
            />
            <span className="absolute right-3 top-2.5 text-xs text-gray-400">{unit}</span>
          </div>
          <button
            type="button"
            onClick={handleExecute}
            disabled={!amount || saving}
            className={`px-4 py-2 rounded-md text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              operationType === 'add' ? 'bg-primary-600 hover:bg-primary-700' : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            実行
          </button>
        </div>
        {showHints && (
          <p className="mt-2 text-[10px] text-gray-400">
            {operationType === 'add'
              ? isStamp
                ? '※ 来店ごとにスタンプを押印します'
                : '※ 来店時やキャンペーン等でポイントを付与します'
              : isStamp
                ? '※ スタンプカード満了時に特典と交換します'
                : '※ 特典交換などでポイントを消費します'}
          </p>
        )}
      </div>
    </div>
  )

  if (variant === 'card') {
    return (
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
        <h4 className="text-sm font-bold text-gray-900 mb-3">
          {isStamp ? 'スタンプカード管理' : 'ポイント管理'}
        </h4>
        {panel}
      </div>
    )
  }

  return panel
}
