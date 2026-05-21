import {
  LineMessagingQuotaFooterLinks,
  LineMessagingQuotaPanel,
  type LineQuotaInfo,
} from '../../../components/line/LineMessagingQuotaNotice'

type LineReplyComposerProps = {
  replyText: string
  onReplyTextChange: (text: string) => void
  onSend: () => void
  onResolve?: () => void
  showResolve?: boolean
  sending?: boolean
  quotaInfo?: LineQuotaInfo | null
  placeholder?: string
  label?: string
}

export function LineReplyComposer({
  replyText,
  onReplyTextChange,
  onSend,
  onResolve,
  showResolve = false,
  sending = false,
  quotaInfo = null,
  placeholder = 'メッセージを入力してください...',
  label = '返信内容',
}: LineReplyComposerProps) {
  return (
    <div className="space-y-4">
      {quotaInfo && <LineMessagingQuotaPanel quotaInfo={quotaInfo} />}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <textarea
          value={replyText}
          onChange={(e) => onReplyTextChange(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[100px]"
          placeholder={placeholder}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        {showResolve && onResolve && (
          <button
            type="button"
            onClick={onResolve}
            disabled={sending}
            className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium text-sm"
          >
            返信せずに対応済にする
          </button>
        )}
        <button
          type="button"
          onClick={onSend}
          disabled={sending || !replyText.trim()}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
        >
          {sending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              送信中...
            </>
          ) : (
            '送信する'
          )}
        </button>
      </div>
      {quotaInfo && <LineMessagingQuotaFooterLinks align="right" />}
    </div>
  )
}
