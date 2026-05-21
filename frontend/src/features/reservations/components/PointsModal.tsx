import Modal from '../../../components/Modal'
import { PointOperationPanel } from './PointOperationPanel'
import type { MembershipCardSettings } from '../../../hooks/usePointOperation'

type PointsModalProps = {
  isOpen: boolean
  onClose: () => void
  customerName: string
  balance: number
  storeSettings: MembershipCardSettings | null
  saving?: boolean
  onSubmit: (amount: number, type: 'add' | 'use') => void
}

export function PointsModal({
  isOpen,
  onClose,
  customerName,
  balance,
  storeSettings,
  saving,
  onSubmit,
}: PointsModalProps) {
  const isStamp = storeSettings?.card_type === 'stamp'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isStamp ? 'スタンプ' : 'ポイント'}
      showDefaultButtons={false}
      footerContent={
        <div className="flex justify-end w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            閉じる
          </button>
        </div>
      }
    >
      <p className="text-sm text-gray-600 mb-4">{customerName} 様</p>
      <PointOperationPanel
        balance={balance}
        storeSettings={storeSettings}
        saving={saving}
        onSubmit={onSubmit}
        compact
      />
    </Modal>
  )
}
