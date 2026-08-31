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
  return (
    <PointOperationPanel
      variant="card"
      showHints
      balance={balance}
      storeSettings={storeSettings}
      saving={saving}
      onSubmit={onSubmit}
    />
  )
}
