import { useState } from 'react'
import Modal from '../../../components/Modal'

interface SpecialDateModalProps {
  isOpen: boolean
  isLoading: boolean
  date: string | null
  initialData: {
    is_closed: boolean
    override_hours: { start: string; end: string }[] | null
    note: string
  } | null
  onClose: () => void
  onConfirm: (data: {
    is_closed: boolean
    override_hours: { start: string; end: string }[] | null
    note: string
  }) => void
}

export function SpecialDateModal({ isOpen, isLoading, date, initialData, onClose, onConfirm }: SpecialDateModalProps) {
  const [isClosed, setIsClosed] = useState(initialData?.is_closed ?? false)
  const [note, setNote] = useState(initialData?.note ?? '')
  const [overrideHours, setOverrideHours] = useState<{ start: string; end: string }[]>(
    initialData?.override_hours ?? [{ start: '09:00', end: '18:00' }]
  )

  const handleConfirm = () => {
    onConfirm({
      is_closed: isClosed,
      override_hours: isClosed ? null : overrideHours,
      note,
    })
  }

  const addTimeSlot = () => {
    setOverrideHours([...overrideHours, { start: '09:00', end: '18:00' }])
  }

  const removeTimeSlot = (index: number) => {
    setOverrideHours(overrideHours.filter((_, i) => i !== index))
  }

  const updateTimeSlot = (index: number, field: 'start' | 'end', value: string) => {
    const updated = [...overrideHours]
    updated[index][field] = value
    setOverrideHours(updated)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="特別営業日設定"
      confirmText="保存"
      isLoading={isLoading}
    >
      <div className="space-y-4">
        {/* 日付ヘッダー */}
        {date && (
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-gray-900">{formatDate(date)}</div>
              <div className="text-xs text-gray-500">特別な営業設定を行います</div>
            </div>
          </div>
        )}

        {/* 休業日チェック */}
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isClosed}
              onChange={(e) => setIsClosed(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-200"
            />
            <div>
              <div className="text-sm font-bold text-gray-700">この日は休業日</div>
              <div className="text-xs text-gray-500 mt-0.5">チェックを入れると予約を受け付けません</div>
            </div>
          </label>
        </div>

        {/* 営業時間変更（休業日でない場合のみ） */}
        {!isClosed && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <label className="text-sm font-bold text-gray-700">営業時間</label>
            </div>
            <div className="space-y-2">
              {overrideHours.map((slot, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={slot.start}
                    onChange={(e) => updateTimeSlot(index, 'start', e.target.value)}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none text-sm"
                  />
                  <span className="text-gray-500">〜</span>
                  <input
                    type="time"
                    value={slot.end}
                    onChange={(e) => updateTimeSlot(index, 'end', e.target.value)}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none text-sm"
                  />
                  {overrideHours.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTimeSlot(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addTimeSlot}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                + 時間帯を追加
              </button>
            </div>
          </div>
        )}

        {/* メモ */}
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <label className="block text-sm font-bold text-gray-700 mb-2">メモ</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-200 outline-none resize-none bg-white"
            rows={3}
            placeholder="例: 年末休業、臨時営業など"
          />
        </div>
      </div>
    </Modal>
  )
}
