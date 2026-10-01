import { useMemo, useState } from 'react'
import {
  AlertTriangle, AtSign, Check, ChevronDown, Copy, ExternalLink, Instagram, Loader2,
  MessageCircle, Pencil, RefreshCw, Store,
} from 'lucide-react'
import Toast from '../../components/Toast'
import {
  useOutreachItems, type OutreachChannel, type OutreachItem,
} from '../../features/marketing/hooks/useOutreachItems'

const CHANNELS: { id: OutreachChannel; label: string; action: string; icon: typeof AtSign }[] = [
  { id: 'x', label: 'X 手動投稿', action: '投稿', icon: AtSign },
  { id: 'instagram', label: 'Instagram 攻めDM', action: 'DM送信', icon: Instagram },
]

type Filter = 'todo' | 'all'

/** X の文字数（重み付き）。twitter-text と同じく、ラテン系などは1、
 *  日本語などそれ以外は2、URL は長さに関係なく23で数える。上限は280。 */
function xWeightedLength(text: string): number {
  const urlRe = /(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?/gi
  let total = 0
  const withoutUrls = text.replace(urlRe, () => {
    total += 23
    return ''
  })
  for (const ch of withoutUrls) {
    const cp = ch.codePointAt(0) ?? 0
    const light =
      cp <= 4351 || (cp >= 8192 && cp <= 8205) || (cp >= 8208 && cp <= 8223) || (cp >= 8242 && cp <= 8247)
    total += light ? 1 : 2
  }
  return total
}

function formatJst(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function OutreachPage() {
  const q = useOutreachItems()
  const [channel, setChannel] = useState<OutreachChannel>('x')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false, message: '', type: 'success',
  })
  const notify = (r: { success: boolean; message?: string }) =>
    setToast({ isVisible: true, message: r.message ?? '', type: r.success ? 'success' : 'error' })

  const { guides, sections, done, total } = useMemo(() => {
    const mine = q.items.filter((it) => it.channel === channel)
    const actions = mine.filter((it) => it.kind === 'action')
    const bySection = new Map<string, OutreachItem[]>()
    for (const it of actions) {
      if (filter === 'todo' && it.done_at) continue
      bySection.set(it.section, [...(bySection.get(it.section) ?? []), it])
    }
    return {
      guides: mine.filter((it) => it.kind === 'guide'),
      sections: [...bySection.entries()],
      done: actions.filter((it) => it.done_at).length,
      total: actions.length,
    }
  }, [q.items, channel, filter])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      notify({ success: true, message: 'コピーしました' })
    } catch {
      notify({ success: false, message: 'コピーできませんでした' })
    }
  }

  if (q.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (q.loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="mb-2 flex items-center gap-2 font-medium">
          <AlertTriangle size={18} /> 手動施策を読み込めませんでした
        </div>
        <p className="text-sm">{q.loadError}</p>
        <button
          type="button"
          onClick={() => void q.refresh()}
          className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm hover:bg-red-100"
        >
          再試行
        </button>
      </div>
    )
  }

  const meta = CHANNELS.find((c) => c.id === channel)!
  const percent = total ? Math.round((done / total) * 100) : 0

  return (
    <div className="space-y-6">
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((p) => ({ ...p, isVisible: false }))}
      />

      <div>
        <h2 className="text-lg font-bold text-gray-900">手動施策</h2>
        <p className="text-sm text-gray-500">
          X の手動投稿と Instagram の攻めDM の文面・送付先・注意点です。実施したらチェックを付けてください。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {CHANNELS.map((c) => {
          const actions = q.items.filter((it) => it.channel === c.id && it.kind === 'action')
          const n = actions.filter((it) => it.done_at).length
          const Icon = c.icon
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setChannel(c.id)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
                channel === c.id
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={16} />
              {c.label}
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-500 ring-1 ring-gray-200">
                {n}/{actions.length}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => void q.refresh()}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={14} /> 更新
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {meta.action}済み <span className="font-bold text-gray-900">{done}</span> / {total}
          </span>
          <span className="text-gray-400">{percent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {guides.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-700">方針・注意点</h3>
          {guides.map((g) => (
            <details key={g.id} className="group rounded-xl border border-gray-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-gray-900">
                {g.title}
                <ChevronDown size={16} className="text-gray-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="whitespace-pre-wrap border-t border-gray-100 px-4 py-3 text-sm leading-relaxed text-gray-700">
                {g.body}
              </div>
            </details>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">表示：</span>
        {(['all', 'todo'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 ${
              filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'すべて' : '未実施のみ'}
          </button>
        ))}
      </div>

      {sections.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">
          {filter === 'todo' ? 'すべて実施済みです' : 'まだ登録がありません'}
        </p>
      )}

      {sections.map(([section, rows]) => (
        <div key={section} className="space-y-3">
          <h3 className="text-sm font-bold text-gray-700">{section}</h3>
          {rows.map((it) => {
            const isDone = !!it.done_at
            const draft = editing[it.id]
            const isEditing = draft !== undefined
            const text = isEditing ? draft : it.body
            const xLen = channel === 'x' ? xWeightedLength(text) : null
            return (
              <div
                key={it.id}
                className={`rounded-xl border bg-white shadow-sm ${isDone ? 'border-emerald-200' : 'border-gray-200'}`}
              >
                <div className="flex flex-wrap items-start gap-3 px-4 pt-4">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isDone}
                    aria-label={`${it.title}を${meta.action}済みにする`}
                    disabled={q.busy === it.id}
                    onClick={async () => notify(await q.setDone(it.id, !isDone))}
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                      isDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 hover:border-emerald-400'
                    } disabled:opacity-50`}
                  >
                    {q.busy === it.id ? <Loader2 size={14} className="animate-spin" /> : isDone && <Check size={16} />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-bold ${isDone ? 'text-gray-400' : 'text-gray-900'}`}>{it.title}</span>
                      {isDone && (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                          {meta.action}済み {formatJst(it.done_at!)}
                        </span>
                      )}
                    </div>
                    {it.target_name && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-gray-600">
                        <Store size={14} className="text-gray-400" />
                        <span className="font-medium">{it.target_name}</span>
                        {it.target_detail && <span className="text-gray-500">{it.target_detail}</span>}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {channel === 'instagram' && it.target_handle && (
                      <>
                        <a
                          href={`https://www.instagram.com/${it.target_handle}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          <ExternalLink size={12} /> プロフィール
                        </a>
                        <a
                          href={`https://ig.me/m/${it.target_handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          <MessageCircle size={12} /> DMを開く
                        </a>
                      </>
                    )}
                    {channel === 'x' && (
                      <a
                        href={`https://x.com/intent/post?text=${encodeURIComponent(it.body)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        <ExternalLink size={12} /> Xで投稿画面を開く
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void copy(it.body)}
                      className="flex items-center gap-1 rounded-lg bg-primary-600 px-2.5 py-1 text-xs text-white hover:bg-primary-700"
                    >
                      <Copy size={12} /> 本文をコピー
                    </button>
                  </div>
                </div>

                {it.note && (
                  <div className="mx-4 mt-3 whitespace-pre-wrap rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                    {it.note}
                  </div>
                )}

                <div className="px-4 pb-4 pt-3">
                  {isEditing ? (
                    <textarea
                      value={draft}
                      onChange={(e) => setEditing((p) => ({ ...p, [it.id]: e.target.value }))}
                      rows={Math.max(6, draft.split('\n').length + 1)}
                      className="w-full rounded-lg border border-gray-300 p-3 text-sm leading-relaxed focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  ) : (
                    <div
                      className={`whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm leading-relaxed ${
                        isDone ? 'text-gray-400' : 'text-gray-800'
                      }`}
                    >
                      {it.body}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {xLen !== null && (
                      <span className={xLen > 280 ? 'font-medium text-red-600' : 'text-gray-400'}>
                        {xLen} / 280（Xの文字数換算）
                      </span>
                    )}
                    <div className="ml-auto flex gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditing((p) => { const n = { ...p }; delete n[it.id]; return n })}
                            className="rounded-lg border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-50"
                          >
                            やめる
                          </button>
                          <button
                            type="button"
                            disabled={q.busy === it.id || draft.trim() === ''}
                            onClick={async () => {
                              const r = await q.updateBody(it.id, draft)
                              notify(r)
                              if (r.success) setEditing((p) => { const n = { ...p }; delete n[it.id]; return n })
                            }}
                            className="rounded-lg bg-primary-600 px-3 py-1 text-white hover:bg-primary-700 disabled:opacity-50"
                          >
                            保存
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditing((p) => ({ ...p, [it.id]: it.body }))}
                          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-50"
                        >
                          <Pencil size={12} /> 本文を直す
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
