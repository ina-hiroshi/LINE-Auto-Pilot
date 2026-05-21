import { PointOperationPanel } from '../../reservations/components/PointOperationPanel'
import type { MembershipCardSettings } from '../../../hooks/usePointOperation'

type CustomerPointsSectionProps = {
  balance: number
  storeSettings: MembershipCardSettings | null
  saving?: boolean
  onSubmit: (amount: number, type: 'add' | 'use') => void
}

export function CustomerPointsSection({
  balance,
  storeSettings,
  saving = false,
  onSubmit,
}: CustomerPointsSectionProps) {
  const isStamp = storeSettings?.card_type === 'stamp'

  return (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
      <h4 className="text-sm font-bold text-gray-900 mb-3">
        {isStamp ? 'スタンプカード管理' : 'ポイント管理'}
      </h4>
      <PointOperationPanel
        variant="card"
        showHints
        balance={balance}
        storeSettings={storeSettings}
        saving={saving}
        onSubmit={onSubmit}
      />
    </div>
  )
}
