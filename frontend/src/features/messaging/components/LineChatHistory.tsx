import { useEffect, useRef } from 'react'
import type { LogEntry } from '../types'
import { STATUS_LABELS } from '../types'

type LineChatHistoryProps = {
  messages: LogEntry[]
  loading?: boolean
  highlightLogId?: string | null
  scrollRef?: React.RefObject<HTMLDivElement | null>
  emptyMessage?: string
  /** latest: 常に最新へ。highlight: 返信対象を中央表示（ダッシュボード返信モーダル用） */
  scrollMode?: 'latest' | 'highlight'
}

export function LineChatHistory({
  messages,
  loading = false,
  highlightLogId = null,
  scrollRef: externalScrollRef,
  emptyMessage = '履歴がありません',
  scrollMode = 'latest',
}: LineChatHistoryProps) {
  const internalScrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = externalScrollRef ?? internalScrollRef

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
    <div
      ref={scrollRef}
      className="bg-gray-50 p-3 rounded-lg border border-gray-100 min-h-[200px] max-h-[400px] overflow-y-auto space-y-3"
    >
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400" />
        </div>
      ) : messages.length > 0 ? (
        <>
          {messages.map((msg) => (
            <div
              key={msg.id}
              id={`msg-${msg.id}`}
              className={`space-y-1 ${msg.id === highlightLogId ? 'bg-yellow-50/30 -mx-2 px-2 py-2 rounded' : ''}`}
            >
              <div className="flex justify-start flex-col items-start">
                {msg.id === highlightLogId && (
                  <span className="text-[10px] font-bold text-primary-600 mb-1 ml-1">返信対象</span>
                )}
                {msg.message_content !== '(店舗から送信)' && (
                  <>
                    <div
                      className={`border rounded-lg rounded-tl-none p-2 max-w-[85%] text-sm shadow-sm ${
                        msg.id === highlightLogId
                          ? 'bg-white border-primary-300 ring-2 ring-primary-100 text-gray-900'
                          : 'bg-white border-gray-200 text-gray-800'
                      }`}
                    >
                      {msg.message_content}
                    </div>
                    <div className="text-[10px] text-gray-400 ml-1">
                      {new Date(msg.created_at).toLocaleString('ja-JP', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </>
                )}
              </div>

              {msg.reply_content && (
                <>
                  <div className="flex justify-end">
                    <div
                      className={`rounded-lg rounded-tr-none p-2 max-w-[85%] text-sm shadow-sm ${
                        msg.status === 'manual_replied'
                          ? 'bg-emerald-100 text-emerald-900'
                          : msg.status === 'ai_replied'
                            ? 'bg-blue-50 text-blue-900'
                            : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      {msg.reply_content}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 text-right mr-1">
                    {STATUS_LABELS[msg.status] ?? msg.status}
                    {' · '}
                    {new Date(msg.created_at).toLocaleString('ja-JP', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </>
              )}
            </div>
          ))}
          <div ref={bottomRef} aria-hidden className="h-0 shrink-0" />
        </>
      ) : (
        <p className="text-center text-gray-400 text-sm py-4">{emptyMessage}</p>
      )}
    </div>
  )
}
