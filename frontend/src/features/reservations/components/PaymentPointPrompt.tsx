import Modal from '../../../components/Modal'
import { formatYen } from '../../../lib/reservationStatus'
import type { MembershipCardSettings } from '../../../hooks/usePointOperation'
import { PointOperationPanel } from './PointOperationPanel'

type PaymentPointPromptProps = {
  isOpen: boolean
  paidAmount: number
  balance: number
  storeSettings: MembershipCardSettings | null
  saving?: boolean
  onSubmit: (amount: number, type: 'add' | 'use') => void
  onSkip: () => void
}

export function PaymentPointPrompt({
  isOpen,
  paidAmount,
  balance,
  storeSettings,
  saving = false,
  onSubmit,
  onSkip,
}: PaymentPointPromptProps) {
  const isStamp = storeSettings?.card_type === 'stamp'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onSkip}
      title="決済完了"
      showDefaultButtons={false}
      footerContent={
        <div className="flex justify-end w-full">
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            あとで
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-emerald-700 font-medium">
          決済が完了しました（{formatYen(paidAmount)}）
        </p>
        <p className="text-sm text-gray-700">
          {isStamp ? 'スタンプの押印・特典交換を行いますか？' : 'ポイントの付与・利用を行いますか？'}
        </p>
        <PointOperationPanel
          variant="card"
          showHints
          initialAmount="10"
          balance={balance}
          storeSettings={storeSettings}
          saving={saving}
          onSubmit={onSubmit}
        />
      </div>
    </Modal>
  )
}
