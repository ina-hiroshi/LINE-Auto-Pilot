import { useState } from 'react'
import { AlertTriangle, Loader2, Plus, Trash2, X } from 'lucide-react'
import Toast from '../../components/Toast'
import { useMarketingSettings } from '../../features/marketing/hooks/useMarketingSettings'
import { useAutoReplyRules, type AutoReplyRule, type RuleInput } from '../../features/marketing/hooks/useAutoReplyRules'

const PLATFORM_LABEL: Record<'instagram' | 'facebook', string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
}

const QUEUE_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: '送信待ち', className: 'bg-blue-100 text-blue-700' },
  dry_run: { label: 'ドライラン（未送信）', className: 'bg-gray-100 text-gray-600' },
  sent: { label: '送信済み', className: 'bg-emerald-100 text-emerald-700' },
  skipped: { label: 'スキップ', className: 'bg-amber-100 text-amber-700' },
  failed: { label: '失敗', className: 'bg-red-100 text-red-700' },
}

// social-outbound-drain の last_error は内部の英語識別子（'window: automated_outside_24h' 等）
// なので、送信ウィンドウ切れによるスキップだけは日本語に読み替える。
// それ以外（Graph API のエラー文言など）はそのまま表示する。
const WINDOW_SKIP_REASON_LABEL: Record<string, string> = {
  'window: no_inbound': '受信メッセージがないため送信不可',
  'window: automated_outside_24h': '受信から24時間を超えたためスキップ（自動送信は24時間以内のみ）',
  'window: window_expired': '受信から7日を超えたためスキップ',
}

function queueErrorLabel(status: string, lastError: string | null): string | null {
  if (!lastError) return null
  if (status === 'skipped') return WINDOW_SKIP_REASON_LABEL[lastError] ?? lastError
  return lastError
}

function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type FormState = {
  platform: 'instagram' | 'facebook'
  accountRef: string
  keyword: string
  subKeywords: string
  responseText: string
  isActive: boolean
}

function emptyForm(defaultPlatform: 'instagram' | 'facebook', defaultAccountRef: string): FormState {
  return {
    platform: defaultPlatform,
    accountRef: defaultAccountRef,
    keyword: '',
    subKeywords: '',
    responseText: '',
    isActive: true,
  }
}

function toRuleInput(form: FormState): RuleInput {
  return {
    platform: form.platform,
    accountRef: form.accountRef,
    keyword: form.keyword,
    subKeywords: form.subKeywords.split(',').map((s) => s.trim()).filter(Boolean),
    responseText: form.responseText,
    isActive: form.isActive,
  }
}

/**
 * 自動応答（キーワードルール）の管理画面。
 *
 * 送信のON/OFF・ドライランの切り替えは接続状態タブ（SettingsPage）が
 * 既に持っている（marketing_settings.auto_reply_enabled / dry_run）ため、
 * ここではルールの作成・編集と、発動履歴・配信キューの可視化に専念する。
 * オフ／ドライラン中でも記録は必ず残る（social-dm-poll 側の設計）ので、
 * 「オンにする前にルールの効き方を確認する」導線として使える。
 */
export default function AutoRepliesPage() {
  const settings = useMarketingSettings()
  const rules = useAutoReplyRules()
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false, message: '', type: 'success',
  })
  const [editing, setEditing] = useState<AutoReplyRule | null>(null)
  const [form, setForm] = useState<FormState | null>(null)

  const notify = (r: { success: boolean; message?: string }) => {
    if (r.message) setToast({ isVisible: true, message: r.message, type: r.success ? 'success' : 'error' })
  }

  const credentials = settings.credentials
  // Facebook DM は App Review 通過まで送受信できない（計画の制約2）。
  // pages_messaging スコープが無い間は選択肢自体に「審査中」を明示し、
  // 新規ルールの既定はここでは絶対に選ばれないよう Instagram を優先する。
  const isFacebookReady = (c: (typeof credentials)[number]) => c.scopes?.includes('pages_messaging') ?? false
  const defaultCred =
    credentials.find((c) => c.platform === 'instagram') ??
    credentials.find(isFacebookReady) ??
    credentials[0]

  const startCreate = () => {
    if (!defaultCred) return
    setForm(emptyForm(defaultCred.platform, defaultCred.account_ref))
    setEditing(null)
  }

  const startEdit = (rule: AutoReplyRule) => {
    setForm({
      platform: rule.platform,
      accountRef: rule.account_ref,
      keyword: rule.keyword,
      subKeywords: rule.sub_keywords.join(', '),
      responseText: rule.response_text,
      isActive: rule.is_active,
    })
    setEditing(rule)
  }

  const closeForm = () => {
    setForm(null)
    setEditing(null)
  }

  const submitForm = async () => {
    if (!form) return
    const input = toRuleInput(form)
    if (!input.keyword.trim() || !input.responseText.trim()) {
      notify({ success: false, message: 'キーワードと返信文は必須です' })
      return
    }
    const result = editing ? await rules.updateRule(editing.id, input) : await rules.createRule(input)
    notify(result)
    if (result.success) closeForm()
  }

  if (rules.loading || settings.loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="mr-2 animate-spin" size={20} /> 読み込み中...
      </div>
    )
  }

  if (rules.loadError || settings.loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="mb-2 flex items-center gap-2 font-medium">
          <AlertTriangle size={18} /> 読み込めませんでした
        </div>
        {rules.loadError && <p className="text-sm">{rules.loadError}</p>}
        {settings.loadError && <p className="text-sm">{settings.loadError}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((p) => ({ ...p, isVisible: false }))}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">自動応答（キーワードルール）</h2>
          <p className="text-sm text-gray-500">
            DMの本文にキーワードが含まれていたら定型文を返します。実際に送信するかどうかは
            「接続状態」タブの「自動応答」「ドライラン」設定に従います。
            {settings.settings && !settings.settings.auto_reply_enabled && (
              <span className="ml-1 text-amber-700">現在オフのため、記録のみ行われ送信はされません。</span>
            )}
            {settings.settings?.auto_reply_enabled && settings.settings.auto_reply_dry_run && (
              <span className="ml-1 text-amber-700">現在ドライランのため、実際の送信は行われません。</span>
            )}
          </p>
        </div>
        <button
          type="button"
          disabled={!defaultCred}
          onClick={startCreate}
          className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
        >
          <Plus size={14} /> ルールを追加
        </button>
      </div>

      {form && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">{editing ? 'ルールを編集' : '新しいルール'}</h3>
            <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">対象アカウント</label>
              <select
                value={`${form.platform}:${form.accountRef}`}
                onChange={(e) => {
                  const [platform, accountRef] = e.target.value.split(':') as ['instagram' | 'facebook', string]
                  setForm({ ...form, platform, accountRef })
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                {credentials.map((c) => (
                  <option key={c.id} value={`${c.platform}:${c.account_ref}`} disabled={c.platform === 'facebook' && !isFacebookReady(c)}>
                    {PLATFORM_LABEL[c.platform]}
                    {c.platform === 'facebook' && !isFacebookReady(c) ? '（審査中のため利用不可）' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">キーワード</label>
              <input
                type="text"
                value={form.keyword}
                onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                placeholder="例: 営業時間"
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">サブキーワード（カンマ区切り・任意）</label>
              <input
                type="text"
                value={form.subKeywords}
                onChange={(e) => setForm({ ...form, subKeywords: e.target.value })}
                placeholder="例: 何時, いつまで"
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">返信文</label>
              <textarea
                value={form.responseText}
                onChange={(e) => setForm({ ...form, responseText: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              有効にする
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeForm} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                キャンセル
              </button>
              <button
                type="button"
                disabled={rules.busy === 'create' || (editing !== null && rules.busy === editing.id)}
                onClick={submitForm}
                className="rounded-lg bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
              >
                {editing ? '更新する' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white">
        <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-bold text-gray-900">ルール一覧</h3>
        {rules.rules.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">まだルールがありません。</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {rules.rules.map((rule) => (
              <div key={rule.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                      {PLATFORM_LABEL[rule.platform]}
                    </span>
                    {rule.keyword}
                    {!rule.is_active && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-400">無効</span>
                    )}
                  </div>
                  {rule.sub_keywords.length > 0 && (
                    <p className="mt-0.5 text-xs text-gray-400">サブ: {rule.sub_keywords.join(', ')}</p>
                  )}
                  <p className="mt-1 truncate text-xs text-gray-600">{rule.response_text}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={rule.is_active}
                      disabled={rules.busy === rule.id}
                      onChange={(e) => rules.setActive(rule.id, e.target.checked).then(notify)}
                    />
                    有効
                  </label>
                  <button type="button" onClick={() => startEdit(rule)} className="text-xs text-primary-600 hover:underline">
                    編集
                  </button>
                  <button
                    type="button"
                    disabled={rules.busy === rule.id}
                    onClick={async () => {
                      if (!confirm('このルールを削除しますか？')) return
                      notify(await rules.deleteRule(rule.id))
                    }}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-bold text-gray-900">配信キュー（直近50件）</h3>
        {rules.queue.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">まだ発動履歴がありません。</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {rules.queue.map((q) => {
              const status = QUEUE_STATUS_LABEL[q.status] ?? { label: q.status, className: 'bg-gray-100 text-gray-600' }
              return (
                <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-gray-700">{q.text ?? '(本文なし)'}</p>
                    {(() => {
                      const label = queueErrorLabel(q.status, q.last_error)
                      return label ? (
                        <p
                          className={`mt-0.5 truncate text-xs ${q.status === 'skipped' ? 'text-amber-700' : 'text-red-600'}`}
                        >
                          {label}
                        </p>
                      ) : null
                    })()}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${status.className}`}>{status.label}</span>
                    <span className="text-[11px] text-gray-400">{formatDateTime(q.sent_at ?? q.created_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
