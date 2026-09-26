import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Clock, Inbox, Loader2, MessageCircle, RefreshCw, Search, Send, Sparkles } from 'lucide-react'
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
function ThreadPane({ conversationId, selected, notify, onBack }: {
  conversationId: string
  selected: ConversationSummary
  notify: Notify
  onBack: () => void
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

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const replyState = replyWindow(selected.lastInboundAt)

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

  const header = (
    <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="一覧に戻る"
        className="-ml-2 rounded-lg p-2 text-gray-500 hover:bg-gray-100 md:hidden"
      >
        <ArrowLeft size={18} />
      </button>
      <Avatar name={selected.displayName} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-gray-900">{selected.displayName ?? '（表示名不明）'}</p>
        <p className="text-xs text-gray-500">{selected.platform === 'facebook' ? 'Facebook' : 'Instagram'}</p>
      </div>
      <ReplyWindowBadge replyState={replyState} />
    </div>
  )

  if (messagesLoading) {
    return (
      <>
        {header}
        <div className="flex flex-1 items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      </>
    )
  }

  if (messagesError) {
    return (
      <>
        {header}
        <div className="m-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={16} className="shrink-0" /> {messagesError}
        </div>
      </>
    )
  }

  return (
    <>
      {header}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-gray-50/60 p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400">メッセージがありません。</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                  m.direction === 'inbound' ? 'rounded-tl-sm bg-white text-gray-900' : 'rounded-tr-sm bg-primary-500 text-white'
                }`}
              >
                {m.messageType === 'text' ? (
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
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
        {isAiDraft && (
          <p className="mb-2 flex items-center gap-1 text-xs text-primary-700">
            <Sparkles size={12} /> AIが学習データをもとに作った下書きです。内容を確認してから送信してください。
          </p>
        )}
        <textarea
          value={replyText}
          onChange={(e) => {
            setReplyText(e.target.value)
            // 生成された下書きを手で書き換えた時点で、記録上も
            // 「人が書いた」ものとして扱う（AI下書きの承認送信とは区別する）。
            setIsAiDraft(false)
          }}
          placeholder={replyState.kind === 'closed' ? '受信から7日を過ぎたため、この会話には返信できません' : '返信を入力'}
          disabled={replyState.kind === 'closed' && !replyText}
          rows={3}
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            disabled={drafting || sending}
            onClick={handleGenerateDraft}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {drafting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-primary-600" />}
            AI下書き
          </button>
          <button
            type="button"
            disabled={sending || drafting || !replyText.trim()}
            onClick={handleSend}
            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-50"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            送信
          </button>
        </div>
      </div>
    </>
  )
}

function ReplyWindowBadge({ replyState }: { replyState: ReturnType<typeof replyWindow> }) {
  if (replyState.kind === 'open') {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700" title="受信から24時間以内は自動応答・通常の返信ができます">
        <Clock size={12} /> 返信可 あと{replyState.hoursLeft}時間
      </span>
    )
  }
  if (replyState.kind === 'human_agent') {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700" title="24時間を過ぎると、担当者による返信（HUMAN_AGENT）のみ7日まで送れます">
        <Clock size={12} /> 担当者のみ あと{replyState.daysLeft}日
      </span>
    )
  }
  return (
    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">返信期限切れ</span>
  )
}

/**
 * DM 受信箱。ポーリング（毎分の pg_cron + 手動「今すぐ取得」）で取り込んだ
 * social_conversations / social_messages を Realtime 購読しながら表示する。
 *
 * 返信は social-send-reply が同期的に送る。24時間〜7日のウィンドウ判定
 * （HUMAN_AGENT タグの要否含む）はすべてサーバー側
 * （_shared/meta-messaging-window.ts）で行う。画面上の返信期限表示は目安。
 */
export default function InboxPage() {
  const { conversations, loading, loadError, syncing, syncNow } = useSocialInbox()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false, message: '', type: 'success',
  })

  const notify: Notify = (r) => setToast({ isVisible: true, message: r.message, type: r.success ? 'success' : 'error' })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="mb-2 flex items-center gap-2 font-bold">
          <AlertTriangle size={18} /> 読み込めませんでした
        </div>
        <p className="text-sm">{loadError}</p>
      </div>
    )
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null
  const filtered = conversations.filter((c) =>
    !search || (c.displayName ?? '').includes(search) || (c.lastText ?? '').includes(search),
  )

  return (
    <div>
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((p) => ({ ...p, isVisible: false }))}
      />

      <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:h-[calc(100vh-17rem)] md:min-h-[480px]">
        {/* 会話一覧。モバイルでは会話を開いている間は隠し、スレッドを全幅で出す。 */}
        <div className={`w-full flex-col border-gray-100 md:flex md:w-80 md:shrink-0 md:border-r ${selected ? 'hidden' : 'flex'}`}>
          <div className="space-y-3 border-b border-gray-100 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-bold text-gray-900">DM受信箱</h2>
                <p className="text-xs text-gray-500">毎分自動で取り込みます</p>
              </div>
              <button
                type="button"
                disabled={syncing}
                onClick={async () => notify(await syncNow())}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                今すぐ取得
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="名前・本文で検索"
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-gray-400">
              <Inbox className="mb-3 h-12 w-12 opacity-20" />
              <p className="text-sm">{conversations.length === 0 ? 'まだ会話がありません' : '該当する会話がありません'}</p>
            </div>
          ) : (
            <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto">
              {filtered.map((c) => {
                const replyState = replyWindow(c.lastInboundAt)
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                        selectedId === c.id ? 'bg-primary-50 hover:bg-primary-50' : ''
                      }`}
                    >
                      <Avatar name={c.displayName} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-bold text-gray-900">{c.displayName ?? '（表示名不明）'}</span>
                          <span className="shrink-0 text-[11px] text-gray-400">{formatDateTime(c.lastMessageAt)}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-gray-500">{c.lastText ?? '(メッセージなし)'}</span>
                        {replyState.kind === 'open' && (
                          <span className="mt-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                            返信可
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className={`min-h-[480px] min-w-0 flex-1 flex-col md:flex md:min-h-0 ${selected ? 'flex' : 'hidden'}`}>
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-gray-400">
              <MessageCircle className="mb-3 h-12 w-12 opacity-20" />
              <p className="text-sm">左の一覧から会話を選んでください</p>
            </div>
          ) : (
            <ThreadPane
              key={selected.id}
              conversationId={selected.id}
              selected={selected}
              notify={notify}
              onBack={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function Avatar({ name }: { name: string | null }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px]">
      <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-sm font-bold text-gray-700">
        {(name ?? '?').replace(/^@/, '').slice(0, 1).toUpperCase()}
      </span>
    </span>
  )
}

const HOUR_MS = 60 * 60 * 1000

/** 最後の受信からの経過で、返信できる状態を表示用に分類する（判定の実体はサーバー側）。 */
function replyWindow(lastInboundAt: string | null):
  | { kind: 'open'; hoursLeft: number }
  | { kind: 'human_agent'; daysLeft: number }
  | { kind: 'closed' } {
  if (!lastInboundAt) return { kind: 'closed' }
  const elapsed = Date.now() - Date.parse(lastInboundAt)
  if (elapsed < 24 * HOUR_MS) return { kind: 'open', hoursLeft: Math.max(1, Math.ceil((24 * HOUR_MS - elapsed) / HOUR_MS)) }
  if (elapsed < 7 * 24 * HOUR_MS) {
    return { kind: 'human_agent', daysLeft: Math.max(1, Math.ceil((7 * 24 * HOUR_MS - elapsed) / (24 * HOUR_MS))) }
  }
  return { kind: 'closed' }
}
