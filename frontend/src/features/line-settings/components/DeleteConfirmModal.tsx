import Modal from '../../../components/Modal'
import type { DeletingItem } from '../types'

interface DeleteConfirmModalProps {
  isOpen: boolean
  isLoading: boolean
  target: DeletingItem | null
  onClose: () => void
  onConfirm: () => void
}

export function DeleteConfirmModal({ isOpen, isLoading, target, onClose, onConfirm }: DeleteConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="削除の確認"
      confirmText="削除"
      variant="danger"
      isLoading={isLoading}
    >
      <p className="text-gray-600">
        「{target?.name}」を削除してもよろしいですか？
        <br />
        この操作は取り消せません。
      </p>
    </Modal>
  )
}
