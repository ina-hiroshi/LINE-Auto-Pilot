import { useState } from 'react'
import Modal from '../../../components/Modal'

interface StaffScheduleModalProps {
  isOpen: boolean
  isLoading: boolean
  staffName: string
  date: string | null
  initialData: {
    is_absent: boolean
    override_start: string | null
    override_end: string | null
    note: string
  } | null
  onClose: () => void
  onConfirm: (data: {
    is_absent: boolean
    override_start: string | null
    override_end: string | null
    note: string
  }) => void
}

export function StaffScheduleModal({ isOpen, isLoading, staffName, date, initialData, onClose, onConfirm }: StaffScheduleModalProps) {
  const [isAbsent, setIsAbsent] = useState(initialData?.is_absent ?? false)
  const [overrideStart, setOverrideStart] = useState(initialData?.override_start ?? '09:00')
  const [overrideEnd, setOverrideEnd] = useState(initialData?.override_end ?? '18:00')
  const [note, setNote] = useState(initialData?.note ?? '')

  const handleConfirm = () => {
    onConfirm({
      is_absent: isAbsent,
      override_start: isAbsent ? null : overrideStart,
      override_end: isAbsent ? null : overrideEnd,
      note,
    })
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
      title="スタッフシフト設定"
      confirmText="保存"
      isLoading={isLoading}
    >
      <div className="space-y-4">
        {/* スタッフ・日付ヘッダー */}
        {date && (
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
            <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-gray-900">{staffName}</div>
              <div className="text-sm text-gray-600">{formatDate(date)}</div>
            </div>
          </div>
        )}

        {/* 欠勤チェック */}
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isAbsent}
              onChange={(e) => setIsAbsent(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-200"
            />
            <div>
              <div className="text-sm font-bold text-gray-700">この日は欠勤・休み</div>
              <div className="text-xs text-gray-500 mt-0.5">チェックを入れると予約を受け付けません</div>
            </div>
          </label>
        </div>

        {/* 勤務時間（欠勤でない場合のみ） */}
        {!isAbsent && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <label className="text-sm font-bold text-gray-700">勤務時間</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={overrideStart}
                onChange={(e) => setOverrideStart(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none text-sm"
              />
              <span className="text-gray-500">〜</span>
              <input
                type="time"
                value={overrideEnd}
                onChange={(e) => setOverrideEnd(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none text-sm"
              />
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
            placeholder="例: 午後から出勤、研修参加など"
          />
        </div>
      </div>
    </Modal>
  )
}
