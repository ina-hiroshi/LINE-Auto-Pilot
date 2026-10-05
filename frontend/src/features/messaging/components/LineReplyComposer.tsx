import { useEffect, useMemo, useRef } from 'react'
import { CheckCircle2, ImagePlus, Send, X } from 'lucide-react'
import {
  LineMessagingQuotaFooterLinks,
  LineMessagingQuotaPanel,
  type LineQuotaInfo,
} from '../../../components/line/LineMessagingQuotaNotice'

type LineReplyComposerProps = {
  replyText: string
  onReplyTextChange: (text: string) => void
  /** 添付する画像。渡さなければ画像ボタンを出さない */
  imageFile?: File | null
  onImageFileChange?: (file: File | null) => void
  onSend: () => void
  onResolve?: () => void
  showResolve?: boolean
  sending?: boolean
  quotaInfo?: LineQuotaInfo | null
  placeholder?: string
  label?: string
  /** chat: モーダル下部に固定する、通数表示を 1 行にした形 */
  variant?: 'default' | 'chat'
}

const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp,image/gif'

function QuotaInline({ quotaInfo }: { quotaInfo: LineQuotaInfo }) {
  const unlimited = quotaInfo.type === 'none' || !quotaInfo.limit
  return (
    <a
      href="https://manager.line.biz/"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center whitespace-nowrap text-xs text-gray-500 hover:text-gray-700 tabular-nums"
      title="今月の送信数（LINE公式アカウントの無料メッセージ通数）。クリックでLINE Official Account Managerを開きます"
    >
      今月の送信数 {quotaInfo.totalUsage.toLocaleString()}
      {unlimited ? '' : ` / ${quotaInfo.limit?.toLocaleString()}通`}
    </a>
  )
}

export function LineReplyComposer({
  replyText,
  onReplyTextChange,
  imageFile = null,
  onImageFileChange,
  onSend,
  onResolve,
  showResolve = false,
  sending = false,
  quotaInfo = null,
  placeholder = 'メッセージを入力してください...',
  label = '返信内容',
  variant = 'default',
}: LineReplyComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile])
  const canSend = !sending && (replyText.trim().length > 0 || Boolean(imageFile))

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 日本語の変換確定の Enter で送らないよう、Ctrl / ⌘ + Enter だけで送る
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing && canSend) {
      e.preventDefault()
      onSend()
    }
  }

  const isChat = variant === 'chat'

  return (
    <div className={isChat ? 'space-y-2' : 'space-y-4'}>
      {!isChat && quotaInfo && <LineMessagingQuotaPanel quotaInfo={quotaInfo} />}
      <div>
        <label htmlFor="line-reply-text" className={isChat ? 'sr-only' : 'block text-sm font-medium text-gray-700 mb-1'}>
          {label}
        </label>
        <div className="rounded-xl border border-gray-300 bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/30">
          {previewUrl && (
            <div className="flex items-start gap-3 border-b border-gray-100 p-3">
              <div className="relative">
                <img src={previewUrl} alt="添付する画像" className="h-16 w-16 sm:h-24 sm:w-24 rounded-lg border border-gray-200 object-cover" />
                <button
                  type="button"
                  onClick={() => onImageFileChange?.(null)}
                  disabled={sending}
                  className="absolute -right-2.5 -top-2.5 flex h-7 w-7 min-h-0! items-center justify-center rounded-full bg-gray-800 text-white shadow ring-2 ring-white hover:bg-gray-900 disabled:opacity-50"
                  aria-label="添付した画像を外す"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="min-w-0 pt-1 text-xs leading-relaxed text-gray-500 hidden sm:block">
                送信時に1MB以下のJPEGに縮小して送ります。
                <br />
                文と画像を一緒に送ると、LINEでは2つの吹き出しに分かれて届きます。
              </p>
              <p className="min-w-0 pt-1 text-xs leading-relaxed text-gray-500 sm:hidden">送信時に縮小して送ります</p>
            </div>
          )}
          <textarea
            id="line-reply-text"
            value={replyText}
            onChange={(e) => onReplyTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`block w-full resize-y rounded-xl border-0 bg-transparent p-3 text-[15px] leading-relaxed focus:outline-none focus:ring-0 ${
              isChat ? 'min-h-[64px] sm:min-h-[88px] max-h-[40vh]' : 'min-h-[100px]'
            }`}
            placeholder={placeholder}
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div className="flex items-center gap-2">
              {onImageFileChange && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT_IMAGES}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      onImageFileChange(file)
                      // 同じファイルを選び直しても onChange が届くようにする
                      e.target.value = ''
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    <ImagePlus size={18} />
                    画像
                  </button>
                </>
              )}
              {isChat && quotaInfo && <QuotaInline quotaInfo={quotaInfo} />}
            </div>
            <span className="hidden text-[11px] text-gray-400 sm:inline">⌘/Ctrl + Enter で送信</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        {showResolve && onResolve && (
          <button
            type="button"
            onClick={onResolve}
            disabled={sending}
            className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 sm:px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 whitespace-nowrap"
          >
            <CheckCircle2 size={16} />
            <span className="sm:hidden">返信せず対応済</span>
            <span className="hidden sm:inline">返信せずに対応済にする</span>
          </button>
        )}
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-5 py-2 whitespace-nowrap bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {sending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              送信中...
            </>
          ) : (
            <>
              <Send size={16} />
              送信する
            </>
          )}
        </button>
      </div>
      {!isChat && quotaInfo && <LineMessagingQuotaFooterLinks align="right" />}
    </div>
  )
}
