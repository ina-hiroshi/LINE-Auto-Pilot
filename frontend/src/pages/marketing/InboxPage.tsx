import { useState } from 'react'
import { AlertTriangle, Instagram, Loader2, RefreshCw, Send, Sparkles } from 'lucide-react'
import Toast from '../../components/Toast'
import { useSocialInbox, useConversationMessages, type ConversationSummary } from '../../features/marketing/hooks/useSocialInbox'

function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type Notify = (r: { success: boolean; message: string }) => void

/**
 * 選択中の会話1件分のスレッド表示＋返信フォーム。
 *
 * 親から `key={conversationId}` を付けてマウントすることで、会話を
 * 切り替えるたびに returnText / isAiDraft を含む内部状態がまっさらな
 * 状態から始まる（前の相手への下書きが別の相手に誤って送られることを
 * effect でのリセットなしに防げる）。
 */
function ThreadPane({ conversationId, selected, notify }: {
  conversationId: string
  selected: ConversationSummary
  notify: Notify
}) {
  const {
    messages,
    loading: messagesLoading,
    loadError: messagesError,
    sending,
    drafting,
    sendReply,
    generateDraft,
  } = useConversationMessages(conversationId)
  const [replyText, setReplyText] = useState('')
  const [isAiDraft, setIsAiDraft] = useState(false)

  const handleGenerateDraft = async () => {
    const result = await generateDraft()
    notify({ success: result.success, message: result.message })
    if (result.success && result.draft) {
      setReplyText(result.draft)
      setIsAiDraft(true)
    }
  }

  const handleSend = async () => {
    const text = replyText.trim()
    if (!text) return
    const result = await sendReply(text, isAiDraft ? 'ai_draft_approved' : 'manual')
    notify(result)
    if (result.success) {
      setReplyText('')
      setIsAiDraft(false)
    }
  }

  if (messagesLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-10 text-gray-500">
        <Loader2 className="mr-2 animate-spin" size={16} /> 読み込み中...
      </div>
    )
  }

  if (messagesError) {
    return (
      <div className="m-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertTriangle size={16} className="shrink-0" /> {messagesError}
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        <div className="mb-3 border-b border-gray-100 pb-2 text-sm font-bold text-gray-900">
          {selected.displayName ?? '（表示名不明）'}
        </div>
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400">メッセージがありません。</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  m.direction === 'inbound' ? 'bg-gray-100 text-gray-900' : 'bg-primary-500 text-white'
                }`}
              >
                {m.messageType === 'text' ? (
                  <p className="whitespace-pre-wrap">{m.text}</p>
                ) : (
                  <p className="italic opacity-80">
                    [{m.messageType}] {m.text ?? '(本文なし)'}
                  </p>
                )}
                <div className="mt-1 text-[10px] opacity-60">{formatDateTime(m.occurredAt)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-gray-100 p-3">
        <textarea
          value={replyText}
          onChange={(e) => {
            setReplyText(e.target.value)
            // 生成された下書きを手で書き換えた時点で、記録上も
            // 「人が書いた」ものとして扱う（AI下書きの承認送信とは区別する）。
            setIsAiDraft(false)
          }}
          placeholder="返信を入力（受信から24時間を過ぎるとHUMAN_AGENTタグ付きで7日まで、それ以降は送信できません）"
          rows={2}
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            disabled={drafting || sending}
            onClick={handleGenerateDraft}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {drafting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            AI下書き
          </button>
          <button
            type="button"
            disabled={sending || drafting || !replyText.trim()}
            onClick={handleSend}
            className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            送信
          </button>
        </div>
      </div>
    </>
  )
}

/**
 * DM 受信箱。ポーリング（5分ごとの pg_cron + 手動「今すぐ取得」）で取り込んだ
 * social_conversations / social_messages を Realtime 購読しながら表示する。
 *
 * 返信は social-send-reply が同期的に送る。24時間〜7日のウィンドウ判定
 * （HUMAN_AGENT タグの要否含む）はすべてサーバー側
 * （_shared/meta-messaging-window.ts）で行い、ここでは結果をそのまま表示する。
 */
export default function InboxPage() {
  const { conversations, loading, loadError, syncing, syncNow } = useSocialInbox()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false, message: '', type: 'success',
  })

  const notify: Notify = (r) => setToast({ isVisible: true, message: r.message, type: r.success ? 'success' : 'error' })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="mr-2 animate-spin" size={20} /> 読み込み中...
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="mb-2 flex items-center gap-2 font-medium">
          <AlertTriangle size={18} /> 読み込めませんでした
        </div>
        <p className="text-sm">{loadError}</p>
      </div>
    )
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null

  return (
    <div className="space-y-4">
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((p) => ({ ...p, isVisible: false }))}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">DM受信箱</h2>
          <p className="text-sm text-gray-500">
            Instagram / Facebook の DM を5分ごとに自動取得します（webhook 未導入のためポーリング方式）。
          </p>
        </div>
        <button
          type="button"
          disabled={syncing}
          onClick={async () => notify(await syncNow())}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          今すぐ取得
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          まだ会話がありません。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
          <div className="divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 bg-white md:max-h-[70vh]">
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-gray-50 ${
                  selectedId === c.id ? 'bg-primary-50' : ''
                }`}
              >
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                  <Instagram size={13} className="shrink-0 text-gray-400" />
                  {c.displayName ?? '（表示名不明）'}
                </div>
                <div className="truncate text-xs text-gray-500">{c.lastText ?? '(メッセージなし)'}</div>
                <div className="text-[11px] text-gray-400">{formatDateTime(c.lastMessageAt)}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-col rounded-lg border border-gray-200 bg-white md:max-h-[70vh]">
            {!selected ? (
              <div className="flex flex-1 items-center justify-center p-4 text-sm text-gray-400">
                左の一覧から会話を選んでください
              </div>
            ) : (
              <ThreadPane key={selected.id} conversationId={selected.id} selected={selected} notify={notify} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
