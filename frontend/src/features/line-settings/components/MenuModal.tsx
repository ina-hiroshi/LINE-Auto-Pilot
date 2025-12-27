import Modal from '../../../components/Modal'
import type { BookingSystemType, Menu } from '../types'

interface MenuModalProps {
  isOpen: boolean
  isLoading: boolean
  formData: Pick<Menu, 'name' | 'description' | 'price' | 'duration_minutes' | 'capacity_per_slot'>
  bookingSystemType: BookingSystemType
  isEditing: boolean
  onClose: () => void
  onConfirm: () => void
  onChange: (next: Pick<Menu, 'name' | 'description' | 'price' | 'duration_minutes' | 'capacity_per_slot'>) => void
}

export function MenuModal({ isOpen, isLoading, formData, bookingSystemType, isEditing, onClose, onConfirm, onChange }: MenuModalProps) {
  const title = isEditing
    ? bookingSystemType === 'restaurant'
      ? 'コース・メニュー編集'
      : 'メニュー編集'
    : bookingSystemType === 'restaurant'
      ? 'コース・メニュー追加'
      : 'メニュー追加'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      confirmText={isEditing ? '更新' : '追加'}
      isLoading={isLoading}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {bookingSystemType === 'restaurant' ? 'コース・メニュー名' : 'メニュー名'} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => onChange({ ...formData, name: e.target.value })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
            placeholder={bookingSystemType === 'restaurant' ? '例: 季節のディナーコース' : '例: カット & カラー'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => onChange({ ...formData, description: e.target.value })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none h-24 resize-none"
            placeholder={bookingSystemType === 'restaurant' ? 'コース内容やアレルギー情報など...' : 'メニューの詳細説明...'}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">価格 (円)</label>
            <input
              type="number"
              value={formData.price ?? 0}
              onChange={(e) => onChange({ ...formData, price: parseInt(e.target.value, 10) || 0 })}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">所要時間 (分)</label>
            <input
              type="number"
              value={formData.duration_minutes ?? 0}
              onChange={(e) => onChange({ ...formData, duration_minutes: parseInt(e.target.value, 10) || 0 })}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
              min="0"
              step="10"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">同時受付上限 (このメニュー)</label>
          <input
            type="number"
            value={formData.capacity_per_slot ?? ''}
            onChange={(e) => onChange({ ...formData, capacity_per_slot: e.target.value === '' ? null : parseInt(e.target.value, 10) || 0 })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
            min="0"
            placeholder="未設定の場合は店舗の基本上限を使用"
          />
        </div>
      </div>
    </Modal>
  )
}
