import { Loader2, Lock } from 'lucide-react'
import type { FormEvent } from 'react'

interface PasswordTabProps {
  newPassword: string
  confirmPassword: string
  saving: boolean
  onChangeNew: (value: string) => void
  onChangeConfirm: (value: string) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

export function PasswordTab({ newPassword, confirmPassword, saving, onChangeNew, onChangeConfirm, onSubmit }: PasswordTabProps) {
  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-6 pb-2 border-b">
        <Lock className="text-gray-600" size={24} />
        <h2 className="text-xl font-bold text-gray-800">パスワード変更</h2>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => onChangeNew(e.target.value)}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-gray-200 outline-none"
            placeholder="6文字以上"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード（確認）</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => onChangeConfirm(e.target.value)}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-gray-200 outline-none"
            placeholder="もう一度入力してください"
          />
        </div>
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-gray-800 text-white px-6 py-2.5 rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock size={18} />}
            {saving ? '変更中...' : 'パスワードを変更'}
          </button>
        </div>
      </form>
    </section>
  )
}
