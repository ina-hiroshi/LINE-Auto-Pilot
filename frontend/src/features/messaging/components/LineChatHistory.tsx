import { useEffect, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { LogEntry } from '../types'
import { STATUS_LABELS } from '../types'
import { LineImageViewer } from './LineImageViewer'

type LineChatHistoryProps = {
  messages: LogEntry[]
  loading?: boolean
  highlightLogId?: string | null
  scrollRef?: React.RefObject<HTMLDivElement | null>
  emptyMessage?: string
  /** latest: 常に最新へ。highlight: 返信対象を中央表示（ダッシュボード返信モーダル用） */
  scrollMode?: 'latest' | 'highlight'
  /** 枠の大きさ・背景を差し替える（既定は顧客ページ向けの高さ制限付き） */
  className?: string
}

const DEFAULT_FRAME_CLASS =
  'bg-gray-50 p-3 rounded-lg border border-gray-100 min-h-[200px] max-h-[400px]'

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

function ChatImage({ src, onOpen }: { src: string; onOpen: (src: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(src)}
      className="block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      aria-label="画像を拡大して見る"
    >
      <img src={src} alt="" loading="lazy" className="block max-h-64 w-auto max-w-[min(260px,70vw)] object-cover" />
    </button>
  )
}

export function LineChatHistory({
  messages,
  loading = false,
  highlightLogId = null,
  scrollRef: externalScrollRef,
  emptyMessage = '履歴がありません',
  scrollMode = 'latest',
  className = DEFAULT_FRAME_CLASS,
}: LineChatHistoryProps) {
  const internalScrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = externalScrollRef ?? internalScrollRef
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)

  useEffect(() => {
    if (loading || messages.length === 0) return

    const timer = setTimeout(() => {
      if (scrollMode === 'highlight' && highlightLogId) {
        const target = document.getElementById(`msg-${highlightLogId}`)
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return
        }
      }
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 50)

    return () => clearTimeout(timer)
  }, [messages, loading, highlightLogId, scrollMode])

  return (
    <div ref={scrollRef} className={`${className} overflow-y-auto space-y-3`}>
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400" />
        </div>
      ) : messages.length > 0 ? (
        <>
          {messages.map((msg) => {
            const isHighlight = msg.id === highlightLogId
            const hasInbound = msg.message_content !== '(店舗から送信)'
            const hasReply = Boolean(msg.reply_content || msg.reply_image_url)
            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`space-y-1 ${isHighlight ? 'bg-yellow-50/60 -mx-2 px-2 py-2 rounded' : ''}`}
              >
                <div className="flex justify-start flex-col items-start">
                  {isHighlight && (
                    <span className="text-[11px] font-bold text-primary-700 mb-1 ml-1">返信対象</span>
                  )}
                  {hasInbound && (
                    <>
                      {msg.message_image_url ? (
                        <ChatImage src={msg.message_image_url} onOpen={setViewerSrc} />
                      ) : (
                        <div
                          className={`border rounded-lg rounded-tl-none p-2 max-w-[min(85%,560px)] text-sm shadow-sm whitespace-pre-wrap break-words ${
                            isHighlight
                              ? 'bg-white border-primary-300 ring-2 ring-primary-100 text-gray-900'
                              : 'bg-white border-gray-200 text-gray-800'
                          }`}
                        >
                          {msg.message_image_path ? (
                            <span className="inline-flex items-center gap-1.5 text-gray-500">
                              <ImageOff size={14} />
                              画像を表示できませんでした
                            </span>
                          ) : (
                            msg.message_content
                          )}
                        </div>
                      )}
                      <div className="text-[11px] text-gray-400 ml-1">{formatTime(msg.created_at)}</div>
                    </>
                  )}
                </div>

                {hasReply && (
                  <>
                    <div className="flex flex-col items-end gap-1">
                      {msg.reply_content && (
                        <div
                          className={`rounded-lg rounded-tr-none p-2 max-w-[min(85%,560px)] text-sm shadow-sm whitespace-pre-wrap break-words ${
                            msg.status === 'manual_replied'
                              ? 'bg-emerald-100 text-emerald-900'
                              : msg.status === 'ai_replied'
                                ? 'bg-blue-50 text-blue-900'
                                : 'bg-gray-200 text-gray-800'
                          }`}
                        >
                          {msg.reply_content}
                        </div>
                      )}
                      {msg.reply_image_url && <ChatImage src={msg.reply_image_url} onOpen={setViewerSrc} />}
                    </div>
                    <div className="text-[11px] text-gray-400 text-right mr-1">
                      {STATUS_LABELS[msg.status] ?? msg.status}
                      {' · '}
                      {formatTime(msg.created_at)}
                    </div>
                  </>
                )}
              </div>
            )
          })}
          <div ref={bottomRef} aria-hidden className="h-0 shrink-0" />
        </>
      ) : (
        <p className="text-center text-gray-400 text-sm py-4">{emptyMessage}</p>
      )}
      <LineImageViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </div>
  )
}
