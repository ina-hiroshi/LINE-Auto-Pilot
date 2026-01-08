import { X, Check, Loader2, MessageSquare, UserCheck, Shield } from 'lucide-react'
import { useState, useEffect } from 'react'

interface SetupServiceModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: SetupServiceFormData) => void
  submitting: boolean
  defaultEmail?: string
}

export interface SetupServiceFormData {
  contact_email: string
  has_line_account: boolean
  line_account_basic_id?: string
  additional_notes?: string
}

export default function SetupServiceModal({ isOpen, onClose, onSubmit, submitting, defaultEmail }: SetupServiceModalProps) {
  const [formData, setFormData] = useState<SetupServiceFormData>({
    contact_email: defaultEmail || '',
    has_line_account: false,
    line_account_basic_id: '',
    additional_notes: ''
  })

  // defaultEmailが変更されたらformDataを更新
  useEffect(() => {
    if (defaultEmail) {
      setFormData(prev => ({ ...prev, contact_email: defaultEmail }))
    }
  }, [defaultEmail])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="sticky top-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6 rounded-t-2xl">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 className="text-2xl font-bold mb-1">LINE初期設定代行サービス</h2>
              <p className="text-white/90 text-sm">専門スタッフがあなたの代わりに設定を完了させます</p>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition"
            >
              <X size={24} />
            </button>
          </div>
          <div className="text-3xl font-bold mt-4">¥9,980 <span className="text-lg font-normal">（税込・買い切り）</span></div>
        </div>

        {/* サービス内容 */}
        <div className="p-6 border-b">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Check className="text-green-600" size={20} />
            サービスに含まれるもの
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { icon: MessageSquare, text: 'LINE Developersチャネル作成サポート' },
              { icon: UserCheck, text: '認証情報の取得と登録' },
              { icon: Shield, text: 'Webhook URLの設定' },
              { icon: Check, text: 'LINE連携の完了確認' }
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <item.icon size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>作業方法：</strong> お客様のLINE公式アカウントに当社スタッフを一時的にメンバー招待していただき、メールでのやり取りを通じて設定作業を実施します。
              作業完了後、すぐにメンバー権限を削除していただきます。
            </p>
          </div>
        </div>

        {/* 申し込みフォーム */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <h3 className="font-bold text-gray-900 mb-4">ご連絡先情報</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              placeholder="example@example.com"
            />
            <p className="text-xs text-gray-500 mt-1">
              設定手順や必要情報のやり取りはこちらのメールアドレスに送信いたします
            </p>
          </div>

          <div className="border-t pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_line_account}
                onChange={(e) => setFormData({ ...formData, has_line_account: e.target.checked })}
                className="w-4 h-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">すでにLINE公式アカウントをお持ちです</span>
            </label>

            {formData.has_line_account && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Basic ID（お持ちの場合）
                </label>
                <input
                  type="text"
                  value={formData.line_account_basic_id}
                  onChange={(e) => setFormData({ ...formData, line_account_basic_id: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="@example"
                />
                <p className="text-xs text-gray-500 mt-1">
                  既存のアカウントがある場合は、そちらを設定いたします
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              その他ご要望（任意）
            </label>
            <textarea
              value={formData.additional_notes}
              onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none h-24"
              placeholder="特別な要望や質問があればご記入ください"
            />
          </div>

          {/* 注意事項 */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-600 space-y-1">
              <strong className="block mb-2">ご注意事項：</strong>
              • メールでのやり取りを通じて設定を完了させます（通話不要）<br />
              • LINE公式アカウントをお持ちでない場合は、作成方法もご案内いたします<br />
              • 設定完了まで通常3〜5営業日程度かかります
            </p>
          </div>

          {/* アクション */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-lg hover:from-amber-600 hover:to-orange-600 transition font-bold disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  処理中...
                </>
              ) : (
                <>
                  決済へ進む（¥9,980）
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
