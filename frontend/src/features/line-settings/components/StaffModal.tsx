import Modal from '../../../components/Modal'
import type { Staff } from '../types'

interface StaffModalProps {
  isOpen: boolean
  isLoading: boolean
  formData: Pick<Staff, 'name' | 'role' | 'image_url'>
  isEditing: boolean
  onClose: () => void
  onConfirm: () => void
  onChange: (next: Pick<Staff, 'name' | 'role' | 'image_url'>) => void
}

export function StaffModal({ isOpen, isLoading, formData, isEditing, onClose, onConfirm, onChange }: StaffModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={isEditing ? 'スタッフ編集' : 'スタッフ追加'}
      confirmText={isEditing ? '更新' : '追加'}
      isLoading={isLoading}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">名前 <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => onChange({ ...formData, name: e.target.value })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
            placeholder="例: 山田 花子"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">役職・肩書き</label>
          <input
            type="text"
            value={formData.role || ''}
            onChange={(e) => onChange({ ...formData, role: e.target.value })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
            placeholder="例: 店長, スタイリスト"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">画像URL</label>
          <input
            type="text"
            value={formData.image_url || ''}
            onChange={(e) => onChange({ ...formData, image_url: e.target.value })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
            placeholder="https://..."
          />
        </div>
      </div>
    </Modal>
  )
}
