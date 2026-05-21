import { Edit2, MessageSquare, Save } from 'lucide-react'
import { Loader2 } from 'lucide-react'

type CustomerGeneralNotesProps = {
  realName: string
  furigana: string
  notes: string
  onChange: (field: 'real_name' | 'furigana' | 'notes', value: string) => void
  onSave: () => void
  saving?: boolean
}

export function CustomerGeneralNotes({
  realName,
  furigana,
  notes,
  onChange,
  onSave,
  saving = false,
}: CustomerGeneralNotesProps) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Edit2 className="w-4 h-4 text-primary-500" />
          基本情報
        </h4>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">本名</label>
            <input
              type="text"
              value={realName}
              onChange={(e) => onChange('real_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
              placeholder="山田 太郎"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">フリガナ</label>
            <input
              type="text"
              value={furigana}
              onChange={(e) => onChange('furigana', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
              placeholder="ヤマダ タロウ"
            />
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary-500" />
          顧客メモ
        </h4>
        <textarea
          value={notes}
          onChange={(e) => onChange('notes', e.target.value)}
          rows={5}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
          placeholder="特記事項や好みなどを入力..."
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存
        </button>
      </div>
    </div>
  )
}
