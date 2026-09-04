import { useState } from 'react'
import {
  AlertTriangle, ArrowDown, ArrowUp, ExternalLink, Loader2, RefreshCw,
  RotateCcw, Send, BarChart2, XCircle,
} from 'lucide-react'
import Modal from '../../components/Modal'
import Toast from '../../components/Toast'
import { useMarketingPosts } from '../../features/marketing/hooks/useMarketingPosts'
import {
  INSIGHT_LABELS, MAX_ATTEMPTS, PLATFORM_LABEL, STATUS_CLASS, STATUS_LABEL,
  type Platform, type SlugView,
} from '../../features/marketing/types'

const PLATFORMS: Platform[] = ['instagram', 'facebook']

/** キャプション編集の下書きキー。プラットフォーム別に分かれている場合は
 *  行ごとに別の下書きを持つ必要があるため、キーに platform を含める。 */
const draftKey = (slug: string, platform?: Platform) => `${slug}::${platform ?? 'all'}`

/** この slug でまだ本文を書き換えられるプラットフォーム。
 *  投稿済みは Meta 側の本文が変わらないので対象外。 */
function editablePlatforms(view: SlugView): Platform[] {
  return PLATFORMS.filter((p) => view.platforms[p] && view.platforms[p]!.status !== 'posted')
}

/** 次の起動で実際に投稿される見込みのプラットフォーム。
 *  上限に達した failed 行は自動では拾われないので数に入れない。 */
function publishablePlatforms(view: SlugView): Platform[] {
  return PLATFORMS.filter((p) => {
    const row = view.platforms[p]
    if (!row) return false
    if (row.status === 'pending' || row.status === 'publishing') return true
    return row.status === 'failed' && row.attempts < MAX_ATTEMPTS
  })
}

function formatJst(iso: string | null, withTime = true): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${tone === 'danger' && value > 0 ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  )
}

export default function PostsPage() {
  const q = useMarketingPosts()
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false, message: '', type: 'success',
  })
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [confirmPublish, setConfirmPublish] = useState(false)

  const notify = (r: { success: boolean; message?: string }) =>
    setToast({ isVisible: true, message: r.message ?? '', type: r.success ? 'success' : 'error' })

  const setDraft = (key: string, value: string) => setDrafts((p) => ({ ...p, [key]: value }))
  const clearDraft = (key: string) => setDrafts((p) => { const n = { ...p }; delete n[key]; return n })

  if (q.loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="mr-2 animate-spin" size={20} /> 読み込み中...
      </div>
    )
  }

  if (q.loadError || !q.view) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="mb-2 flex items-center gap-2 font-medium">
          <AlertTriangle size={18} /> 投稿キューを読み込めませんでした
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

  const { summary, slugs, nextCronAt } = q.view

  // 並べ替えの対象と順序はサーバー側の reorder と同じ基準（remaining > 0、sort_order 順）。
  // 画面の表示順（要対応を先頭に固定）で判定すると、押しても必ず弾かれる矢印ができる。
  const movable = slugs.filter((s) => s.remaining > 0).map((s) => s.slug)
  // cron が次に掴む slug。即時投稿は「キューの先頭1件」しか動かさない。
  const nextTarget = slugs.find((s) => s.remaining > 0) ?? null
  const publishing = summary.publishing > 0

  // 手当てが要るものを先頭に。残りは投稿順。
  const ordered = [...slugs].sort((a, b) => {
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1
    return a.sortOrder - b.sortOrder
  })
  const queue = ordered.filter((s) => s.remaining > 0 || s.needsAttention)
  const finished = ordered.filter((s) => s.remaining === 0 && !s.needsAttention)

  return (
    <div className="space-y-6">
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((p) => ({ ...p, isVisible: false }))}
      />

      {/* 即時投稿は取り消せない公開操作なので、必ず対象を見せてから確認を取る。 */}
      <Modal
        isOpen={confirmPublish}
        onClose={() => setConfirmPublish(false)}
        onConfirm={async () => {
          const r = await q.publishNext()
          setConfirmPublish(false)
          notify(r)
        }}
        title="今すぐ投稿しますか？"
        confirmText="投稿する"
        cancelText="やめる"
        variant="danger"
        isLoading={q.busy === 'publish'}
      >
        <div className="space-y-3 text-sm text-gray-700">
          <p>
            キューの先頭にある <span className="font-bold text-gray-900">{nextTarget?.slug}</span> を、
            21:00 を待たずに公開します。
          </p>
          <p className="text-gray-600">
            投稿先：
            {nextTarget
              ? publishablePlatforms(nextTarget).map((p) => PLATFORM_LABEL[p]).join(' / ')
              : '—'}
          </p>
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            公開後に取り消すことはできません。Instagram / Facebook から手動で削除する必要があります。
          </p>
        </div>
      </Modal>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <StatCard label="待機中" value={summary.pending} />
        <StatCard label="処理中" value={summary.publishing} />
        <StatCard label="投稿済み" value={summary.posted} />
        <StatCard label="失敗" value={summary.failed - summary.abandoned} tone="danger" />
        <StatCard label="要対応" value={summary.stuck} tone="danger" />
        <StatCard label="見送り" value={summary.abandoned} />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <div className="text-sm text-gray-600">
          次回の自動投稿：<span className="font-medium text-gray-900">{formatJst(nextCronAt)}</span>
          <span className="ml-2 text-xs text-gray-400">毎日 21:00 に1件ずつ</span>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void q.refresh()}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={14} /> 更新
          </button>
          <button
            type="button"
            disabled={q.busy === 'insights'}
            onClick={async () => notify(await q.fetchInsights())}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {q.busy === 'insights' ? <Loader2 size={14} className="animate-spin" /> : <BarChart2 size={14} />}
            実績を取得
          </button>
          <button
            type="button"
            disabled={q.busy !== null || !nextTarget}
            onClick={() => setConfirmPublish(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
            title={nextTarget
              ? `${nextTarget.slug} を 21:00 を待たずに公開します`
              : '投稿待ちがありません'}
          >
            {q.busy === 'publish' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            次の投稿を今すぐ実行
          </button>
        </div>
      </div>

      {queue.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          投稿待ちはありません。
        </div>
      )}

      <div className="space-y-4">
        {queue.map((s) => (
          <PostCard
            key={s.slug}
            view={s}
            canReorder={s.remaining > 0 && !publishing}
            isFirst={movable[0] === s.slug}
            isLast={movable[movable.length - 1] === s.slug}
            busy={q.busy}
            drafts={drafts}
            insight={q.insights[s.slug]}
            onDraftChange={setDraft}
            onSaveCaption={async (key, platform, value) => {
              const r = await q.updateCaption(s.slug, value, platform)
              if (r.success) clearDraft(key)
              notify(r)
            }}
            onReorder={async (d) => notify(await q.reorder(s.slug, d))}
            onRetry={async (p) => notify(await q.retry(s.slug, p))}
            onAbandon={async (p) => notify(await q.abandon(s.slug, p))}
          />
        ))}
      </div>

      <details className="rounded-lg border border-gray-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700">
          投稿済み・見送り（{finished.length}件）
        </summary>
        <div className="space-y-3 border-t border-gray-100 p-4">
          {finished.map((s) => (
            <div key={s.slug} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium text-gray-900">{s.slug}</span>
              {s.abandoned > 0 && (
                <>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">見送り</span>
                  {/* 見送った slug は「要対応」から外れてこの折りたたみに落ちるので、
                      ここに戻す導線が無いと二度とキューへ戻せなくなる。 */}
                  <button
                    type="button"
                    disabled={q.busy !== null}
                    onClick={async () => notify(await q.retry(s.slug))}
                    className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RotateCcw size={11} /> キューに戻す
                  </button>
                </>
              )}
              <span className="text-gray-500">{formatJst(s.platforms.instagram?.posted_at ?? null)}</span>
              {PLATFORMS.map((p) => {
                const row = s.platforms[p]
                if (!row?.permalink) return null
                return (
                  <a
                    key={p}
                    href={row.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-primary-600 hover:underline"
                  >
                    {PLATFORM_LABEL[p]} <ExternalLink size={12} />
                  </a>
                )
              })}
              {q.insights[s.slug]?.values && (
                <span className="text-xs text-gray-500">
                  {INSIGHT_LABELS.filter((m) => q.insights[s.slug].values![m.key] !== undefined)
                    .map((m) => `${m.label} ${q.insights[s.slug].values![m.key]}`)
                    .join(' / ')}
                </span>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}

function PostCard({
  view, canReorder, isFirst, isLast, busy, drafts, insight,
  onDraftChange, onSaveCaption, onReorder, onRetry, onAbandon,
}: {
  view: SlugView
  canReorder: boolean
  isFirst: boolean
  isLast: boolean
  busy: string | null
  drafts: Record<string, string>
  insight: { values?: Record<string, number>; error?: string } | undefined
  onDraftChange: (key: string, value: string) => void
  onSaveCaption: (key: string, platform: Platform | undefined, value: string) => void
  onReorder: (d: 'up' | 'down') => void
  onRetry: (platform?: string) => void
  onAbandon: (platform?: string) => void
}) {
  const editable = editablePlatforms(view)
  // 本文がプラットフォームごとに違うときは、1枚のテキストエリアで編集させてはいけない。
  // まとめて保存すると、表示していない側の本文を黙って上書きしてしまう。
  const diverged = new Set(editable.map((p) => view.platforms[p]!.caption)).size > 1

  return (
    <div
      className={`rounded-lg border bg-white p-4 ${
        view.needsAttention ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-200'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-bold text-gray-900">{view.slug}</span>
        {view.scheduledAt ? (
          <span className="rounded bg-primary-50 px-2 py-0.5 text-xs text-primary-700">
            {formatJst(view.scheduledAt)} に投稿予定
          </span>
        ) : view.needsAttention ? (
          <span className="flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
            <AlertTriangle size={12} /> 自動再試行の上限に達しています
          </span>
        ) : null}

        {/* 投稿待ちが無い slug は動かす先が無い。矢印自体を出さない。 */}
        {canReorder && (
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              disabled={isFirst || busy !== null}
              onClick={() => onReorder('up')}
              className="rounded border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-30"
              title="1つ前に出す"
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              disabled={isLast || busy !== null}
              onClick={() => onReorder('down')}
              className="rounded border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-30"
              title="1つ後に回す"
            >
              <ArrowDown size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto">
        {view.imageUrls.map((url, i) => (
          <img
            key={url}
            src={url}
            alt={`${view.slug} ${i + 1}枚目`}
            loading="lazy"
            className="h-20 w-20 shrink-0 rounded border border-gray-200 object-cover"
          />
        ))}
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        {PLATFORMS.map((p) => {
          const row = view.platforms[p]
          if (!row) return null
          return (
            <div key={p} className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{PLATFORM_LABEL[p]}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_CLASS[row.status]}`}>
                  {STATUS_LABEL[row.status]}
                </span>
                {row.attempts > 0 && <span className="text-xs text-gray-400">試行 {row.attempts} 回</span>}
                {row.permalink && (
                  <a href={row.permalink} target="_blank" rel="noreferrer" className="ml-auto text-primary-600">
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
              {row.error && (
                <p className="mt-1 break-all text-xs text-red-600">{row.error}</p>
              )}
              {row.status === 'failed' && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => onRetry(p)}
                    className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RotateCcw size={12} /> キューに戻す
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => onAbandon(p)}
                    className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    title="この行をキューから外し、後続の投稿を先に進めます"
                  >
                    <XCircle size={12} /> 見送る
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {insight?.values && (
        <div className="mb-3 flex flex-wrap gap-3 rounded border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          {INSIGHT_LABELS.filter((m) => insight.values![m.key] !== undefined).map((m) => (
            <span key={m.key}>
              {m.label} <span className="font-medium text-gray-900">{insight.values![m.key]}</span>
            </span>
          ))}
        </div>
      )}

      {editable.length === 0 ? (
        <div>
          <div className="mb-1 text-xs text-gray-500">キャプション（投稿済みのため変更できません）</div>
          <p className="whitespace-pre-wrap rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            {view.caption}
          </p>
        </div>
      ) : diverged ? (
        <div className="space-y-3">
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            本文が Instagram と Facebook で異なります。まとめて保存すると片方が消えるため、
            それぞれ個別に編集してください。
          </p>
          {editable.map((p) => (
            <CaptionField
              key={p}
              label={`キャプション（${PLATFORM_LABEL[p]}）`}
              draftId={draftKey(view.slug, p)}
              current={view.platforms[p]!.caption}
              drafts={drafts}
              busy={busy}
              onChange={onDraftChange}
              onSave={(key, value) => onSaveCaption(key, p, value)}
            />
          ))}
        </div>
      ) : (
        <CaptionField
          label="キャプション"
          note={editable.length < PLATFORMS.filter((p) => view.platforms[p]).length
            ? '投稿済みの分は変更されません'
            : undefined}
          draftId={draftKey(view.slug)}
          current={view.platforms[editable[0]]!.caption}
          drafts={drafts}
          busy={busy}
          onChange={onDraftChange}
          onSave={(key, value) => onSaveCaption(key, undefined, value)}
        />
      )}
    </div>
  )
}

function CaptionField({
  label, note, draftId, current, drafts, busy, onChange, onSave,
}: {
  label: string
  note?: string
  draftId: string
  current: string
  drafts: Record<string, string>
  busy: string | null
  onChange: (key: string, value: string) => void
  onSave: (key: string, value: string) => void
}) {
  const draft = drafts[draftId]
  const value = draft ?? current
  const dirty = draft !== undefined && draft !== current

  return (
    <div>
      <label className="mb-1 block text-xs text-gray-500">
        {label}
        {note && <span className="ml-2 text-gray-400">（{note}）</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(draftId, e.target.value)}
        rows={5}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
      />
      {dirty && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => onSave(draftId, value)}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
          >
            保存
          </button>
          <button
            type="button"
            onClick={() => onChange(draftId, current)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            取り消し
          </button>
        </div>
      )}
    </div>
  )
}
