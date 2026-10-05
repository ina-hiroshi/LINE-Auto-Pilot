import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, BookOpen, Bot, ChevronRight, Edit2, FileText, History, Inbox, Loader2,
  MessageSquare, Plus, RefreshCw, Save, Search, Send, Sparkles, Tag, Trash2, UserRound, X,
} from 'lucide-react'
import Modal from '../../components/Modal'
import Toast from '../../components/Toast'
import { UnderlineTabs } from '../../components/UnderlineTabs'
import {
  useMarketingSettings, type KnowledgeSummary, type MarketingSettingsView,
} from '../../features/marketing/hooks/useMarketingSettings'
import {
  useAutoReplyRules, type AutoReplyRule, type OutboundQueueRow, type RuleInput,
} from '../../features/marketing/hooks/useAutoReplyRules'

type Platform = 'instagram' | 'facebook'
type SubTab = 'keyword' | 'ai' | 'history'
type Mode = 'live' | 'dry' | 'off'
type Notify = (r: { success: boolean; message?: string }) => void
type SettingsPatch = Parameters<ReturnType<typeof useMarketingSettings>['updateSetting']>[0]

const PLATFORM_LABEL: Record<Platform, string> = { instagram: 'Instagram', facebook: 'Facebook' }

/** social-auto-reply-rules の MAX_RESPONSE_LENGTH と揃える。 */
const MAX_RESPONSE_LENGTH = 1000

const QUEUE_STATUS: Record<OutboundQueueRow['status'], { label: string; className: string }> = {
  pending: { label: '送信待ち', className: 'bg-blue-50 text-blue-700' },
  dry_run: { label: 'ドライラン', className: 'bg-gray-100 text-gray-600' },
  sent: { label: '送信済み', className: 'bg-emerald-50 text-emerald-700' },
  skipped: { label: '送信せず', className: 'bg-amber-50 text-amber-700' },
  failed: { label: '失敗', className: 'bg-red-50 text-red-700' },
}

// social-outbound-drain / social-dm-poll の last_error は内部の英語識別子なので、
// 既知のものだけ日本語に読み替える。それ以外（Graph API のエラー文言など）はそのまま出す。
const SKIP_REASON_LABEL: Record<string, string> = {
  'window: no_inbound': '受信メッセージがないため送信できませんでした',
  'window: automated_outside_24h': '受信から24時間を過ぎたため送信しませんでした（自動送信は24時間以内のみ）',
  'window: window_expired': '受信から7日を過ぎたため送信しませんでした',
  'ai: needs_human': 'AIでは答えられない内容のため、担当者対応に回しました',
}

function queueErrorLabel(row: OutboundQueueRow): string | null {
  if (!row.last_error) return null
  if (row.status === 'skipped') return SKIP_REASON_LABEL[row.last_error] ?? row.last_error
  return row.last_error
}

function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function keywordMode(s: MarketingSettingsView): Mode {
  if (!s.auto_reply_enabled) return 'off'
  return s.auto_reply_dry_run ? 'dry' : 'live'
}

/** AI 応答が実際に送られるのは、全体の自動応答が本番送信中かつ AI 側のドライランもオフのときだけ。 */
function aiMode(s: MarketingSettingsView): Mode {
  if (!s.ai_reply_enabled) return 'off'
  return keywordMode(s) === 'live' && !s.ai_reply_dry_run ? 'live' : 'dry'
}

const MODE_BADGE: Record<Mode, { label: string; className: string; dot: string }> = {
  live: { label: '送信中', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  dry: { label: 'ドライラン', className: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  off: { label: 'オフ', className: 'bg-gray-100 text-gray-500 ring-gray-200', dot: 'bg-gray-400' },
}

function ModeBadge({ mode }: { mode: Mode }) {
  const b = MODE_BADGE[mode]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${b.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${b.dot}`} />
      {b.label}
    </span>
  )
}

/** 製品側（LINE の自動応答画面）と同じ見た目のスイッチ。 */
function Switch({
  checked, onChange, disabled, size = 'md', label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  label: string
}) {
  const track = { sm: 'h-5 w-9', md: 'h-6 w-11', lg: 'h-7 w-14' }[size]
  const knob = { sm: 'after:h-4 after:w-4', md: 'after:h-5 after:w-5', lg: 'after:h-6 after:w-6' }[size]
  return (
    <label className={`relative inline-flex shrink-0 items-center ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        className="peer sr-only"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div
        className={`${track} ${knob} peer rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus-visible:ring-4 peer-focus-visible:ring-primary-300`}
      />
    </label>
  )
}

/**
 * DM 自動応答の管理画面。
 *
 * 処理の順番（キーワード → AI → 担当者）を画面の最上部にそのまま図示し、
 * 各段のオン/オフと状態をそこから読めるようにする。キーワード応答・AI 応答の
 * 詳細はサブタブで LINE の自動応答画面と同じ並び・操作感にそろえている。
 *
 * オフ／ドライラン中でも記録は必ず残る（social-dm-poll 側の設計）ので、
 * 「応答履歴」タブで本番送信前に効き方を確かめられる。
 */
export default function AutoRepliesPage() {
  const settings = useMarketingSettings()
  const rules = useAutoReplyRules()
  const [tab, setTab] = useState<SubTab>('keyword')
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false, message: '', type: 'success',
  })

  const notify: Notify = (r) => {
    if (r.message) setToast({ isVisible: true, message: r.message, type: r.success ? 'success' : 'error' })
  }

  if (rules.loading || settings.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (rules.loadError || settings.loadError || !settings.settings) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="mb-2 flex items-center gap-2 font-bold">
          <AlertTriangle size={18} /> 読み込めませんでした
        </div>
        {rules.loadError && <p className="text-sm">{rules.loadError}</p>}
        {settings.loadError && <p className="text-sm">{settings.loadError}</p>}
      </div>
    )
  }

  const s = settings.settings
  const activeRuleCount = rules.rules.filter((r) => r.is_active).length
  const aiNeedsHumanCount = rules.queue.filter((q) => q.last_error === 'ai: needs_human').length

  return (
    <div className="space-y-6">
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((p) => ({ ...p, isVisible: false }))}
      />

      <FlowOverview
        settings={s}
        activeRuleCount={activeRuleCount}
        knowledge={settings.knowledge}
        busy={settings.busy}
        onToggle={async (patch) => notify(await settings.updateSetting(patch))}
        onOpen={setTab}
      />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <UnderlineTabs
          embedded
          stretchOnMobile
          activeId={tab}
          onChange={setTab}
          items={[
            { id: 'keyword', label: 'キーワード応答', icon: MessageSquare, title: 'キーワード応答' },
            { id: 'ai', label: 'AI応答', icon: Sparkles, title: 'AI応答' },
            {
              id: 'history',
              label: '応答履歴',
              icon: History,
              title: '応答履歴',
              badge: aiNeedsHumanCount > 0 ? (
                <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">{aiNeedsHumanCount}</span>
              ) : undefined,
            },
          ]}
        />

        {tab === 'keyword' && <KeywordTab rules={rules} credentials={settings.credentials} notify={notify} />}
        {tab === 'ai' && (
          <AiTab
            settings={s}
            knowledge={settings.knowledge}
            busy={settings.busy}
            onToggle={async (patch) => notify(await settings.updateSetting(patch))}
            onPreview={rules.previewAiReply}
          />
        )}
        {tab === 'history' && <HistoryTab queue={rules.queue} onRefresh={() => void rules.refresh()} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 処理の流れ（最上部）
// ---------------------------------------------------------------------------

function FlowOverview({
  settings: s, activeRuleCount, knowledge, busy, onToggle, onOpen,
}: {
  settings: MarketingSettingsView
  activeRuleCount: number
  knowledge: KnowledgeSummary | null
  busy: string | null
  onToggle: (patch: SettingsPatch) => void
  onOpen: (tab: SubTab) => void
}) {
  const kMode = keywordMode(s)
  const aMode = aiMode(s)

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">DMの自動応答</h2>
            <ModeBadge mode={kMode} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Instagram の DM を毎分取り込み、上から順に当てはまったもので返信します。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-3 text-sm font-bold text-gray-700">
            自動応答
            <Switch
              label="自動応答"
              checked={s.auto_reply_enabled}
              disabled={busy !== null}
              onChange={(v) => onToggle({ auto_reply_enabled: v })}
            />
          </div>
          <div className="flex items-center gap-3 text-sm font-bold text-gray-700" title="オンの間は送信せず、送るはずだった内容だけを記録します">
            ドライラン
            <Switch
              label="ドライラン"
              checked={s.auto_reply_dry_run}
              disabled={busy !== null || !s.auto_reply_enabled}
              onChange={(v) => onToggle({ auto_reply_dry_run: v })}
            />
          </div>
        </div>
      </div>

      <ol className="grid gap-3 p-4 sm:p-6 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
        <FlowStep
          step={1}
          icon={MessageSquare}
          title="キーワード応答"
          mode={kMode}
          detail={`${activeRuleCount}件のルールが有効`}
          onClick={() => onOpen('keyword')}
        />
        <FlowArrow />
        <FlowStep
          step={2}
          icon={Sparkles}
          title="AI応答"
          mode={aMode}
          detail={
            knowledge
              ? `LINEの学習データ ${knowledge.activeChars.toLocaleString()}文字を参照`
              : '学習データが未登録です'
          }
          onClick={() => onOpen('ai')}
        />
        <FlowArrow />
        <li>
          <Link
            to="/marketing/inbox"
            className="group flex h-full items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-primary-300 hover:bg-primary-50/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-gray-500 ring-1 ring-gray-200">
              <UserRound size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-xs font-bold text-gray-400">STEP 3</span>
              <span className="block font-bold text-gray-900">担当者が返信</span>
              <span className="mt-0.5 block text-xs text-gray-500">どちらにも当てはまらないDMは受信箱に残ります</span>
            </span>
            <ChevronRight size={16} className="mt-1 shrink-0 text-gray-300 group-hover:text-primary-500" />
          </Link>
        </li>
      </ol>
    </div>
  )
}

function FlowStep({
  step, icon: Icon, title, mode, detail, onClick,
}: {
  step: number
  icon: typeof MessageSquare
  title: string
  mode: Mode
  detail: string
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group flex h-full w-full items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/40"
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            mode === 'off' ? 'bg-gray-100 text-gray-400' : 'bg-primary-50 text-primary-600'
          }`}
        >
          <Icon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-gray-400">STEP {step}</span>
            <ModeBadge mode={mode} />
          </span>
          <span className="block font-bold text-gray-900">{title}</span>
          <span className="mt-0.5 block text-xs text-gray-500">{detail}</span>
        </span>
      </button>
    </li>
  )
}

function FlowArrow() {
  return (
    <li aria-hidden className="flex items-center justify-center text-gray-300">
      <ArrowRight size={18} className="rotate-90 md:rotate-0" />
    </li>
  )
}

// ---------------------------------------------------------------------------
// キーワード応答
// ---------------------------------------------------------------------------

type EditorState = {
  id: string | null
  platform: Platform
  accountRef: string
  keyword: string
  subKeywords: string[]
  responseText: string
  isActive: boolean
}

function KeywordTab({
  rules, credentials, notify,
}: {
  rules: ReturnType<typeof useAutoReplyRules>
  credentials: ReturnType<typeof useMarketingSettings>['credentials']
  notify: Notify
}) {
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [newSub, setNewSub] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AutoReplyRule | null>(null)

  // Facebook DM は App Review 通過まで送受信できない。pages_messaging が無い間は
  // 選べないようにし、新規ルールの既定は Instagram を優先する。
  const isFacebookReady = (c: (typeof credentials)[number]) => c.scopes?.includes('pages_messaging') ?? false
  const selectable = credentials.filter((c) => c.platform === 'instagram' || isFacebookReady(c))
  const defaultCred = selectable.find((c) => c.platform === 'instagram') ?? selectable[0]

  const filtered = rules.rules.filter((r) =>
    !search ||
    r.keyword.includes(search) ||
    r.sub_keywords.some((k) => k.includes(search)) ||
    r.response_text.includes(search),
  )

  const openCreate = () => {
    if (!defaultCred) return
    setNewSub('')
    setEditor({
      id: null, platform: defaultCred.platform, accountRef: defaultCred.account_ref,
      keyword: '', subKeywords: [], responseText: '', isActive: true,
    })
  }

  const openEdit = (rule: AutoReplyRule) => {
    setNewSub('')
    setEditor({
      id: rule.id, platform: rule.platform, accountRef: rule.account_ref,
      keyword: rule.keyword, subKeywords: rule.sub_keywords, responseText: rule.response_text, isActive: rule.is_active,
    })
  }

  const addSub = () => {
    const v = newSub.trim()
    if (!editor || !v) return
    if (!editor.subKeywords.includes(v)) setEditor({ ...editor, subKeywords: [...editor.subKeywords, v] })
    setNewSub('')
  }

  const save = async () => {
    if (!editor) return
    const input: RuleInput = {
      platform: editor.platform,
      accountRef: editor.accountRef,
      keyword: editor.keyword.trim(),
      // 入力欄に残ったままのサブキーワードも拾う（「追加」を押し忘れて保存しがちなため）。
      subKeywords: [...editor.subKeywords, ...(newSub.trim() && !editor.subKeywords.includes(newSub.trim()) ? [newSub.trim()] : [])],
      responseText: editor.responseText.trim(),
      isActive: editor.isActive,
    }
    const result = editor.id ? await rules.updateRule(editor.id, input) : await rules.createRule(input)
    notify(result)
    if (result.success) setEditor(null)
  }

  const saving = rules.busy === 'create' || (editor?.id != null && rules.busy === editor.id)

  return (
    <div>
      <div className="flex flex-col items-start justify-between gap-4 border-b border-gray-100 p-4 md:flex-row md:items-center">
        <div className="flex w-full flex-1 flex-col items-start gap-4 md:flex-row md:items-center">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="キーワードを検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <p className="text-sm text-gray-500">
            登録数: <span className="font-bold text-gray-900">{rules.rules.length}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={!defaultCred}
          title={defaultCred ? undefined : 'Instagram の接続が必要です'}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 md:w-auto"
        >
          <Plus size={18} /> 新規ルール作成
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center px-6 text-center text-gray-400">
          <MessageSquare className="mb-3 h-12 w-12 opacity-20" />
          {rules.rules.length === 0 ? (
            <>
              <p className="font-medium text-gray-500">まだルールがありません</p>
              <p className="mt-1 text-sm">「料金」「営業時間」など、よく聞かれる言葉に定型文で返せます。</p>
            </>
          ) : (
            <p>ルールが見つかりません</p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {filtered.map((rule) => (
            <div key={rule.id} className="group flex items-start gap-3 p-3 transition-colors hover:bg-gray-50 md:gap-4 md:p-4">
              <div className="flex min-w-[50px] flex-col items-center gap-1 pt-1 md:min-w-[60px]">
                <Switch
                  size="sm"
                  label={`${rule.keyword} を有効にする`}
                  checked={rule.is_active}
                  disabled={rules.busy === rule.id}
                  onChange={(v) => void rules.setActive(rule.id, v).then(notify)}
                />
                <span className={`text-[10px] font-medium ${rule.is_active ? 'text-primary-600' : 'text-gray-400'}`}>
                  {rule.is_active ? '有効' : '無効'}
                </span>
              </div>
              <button type="button" onClick={() => openEdit(rule)} className="min-w-0 flex-1 space-y-1 text-left md:space-y-2">
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <h3 className="truncate text-sm font-bold text-gray-900 md:text-base">{rule.keyword}</h3>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">{PLATFORM_LABEL[rule.platform]}</span>
                  {rule.sub_keywords.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Tag size={12} />
                      <span className="max-w-[200px] truncate">{rule.sub_keywords.join(', ')}</span>
                    </span>
                  )}
                </div>
                <p className="line-clamp-2 whitespace-pre-wrap break-words text-xs text-gray-600 md:text-sm">{rule.response_text}</p>
              </button>
              <div className="flex flex-col items-center gap-1 transition-opacity md:flex-row md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => openEdit(rule)}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-primary-50 hover:text-primary-600"
                  title="編集"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(rule)}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  title="削除"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={editor !== null}
        onClose={() => setEditor(null)}
        title={editor?.id ? 'キーワード応答を編集' : '新規ルール作成'}
        footerContent={
          <div className="flex w-full justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditor(null)}
              className="rounded-lg px-5 py-2.5 font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              閉じる
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !editor?.keyword.trim() || !editor?.responseText.trim()}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={18} />}
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        }
      >
        {editor && (
          <div className="space-y-6">
            {selectable.length > 1 && (
              <div>
                <label className="mb-1 block text-sm font-bold text-gray-700">対象アカウント</label>
                <select
                  value={`${editor.platform}:${editor.accountRef}`}
                  onChange={(e) => {
                    const [platform, accountRef] = e.target.value.split(':') as [Platform, string]
                    setEditor({ ...editor, platform, accountRef })
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary-500"
                >
                  {selectable.map((c) => (
                    <option key={c.id} value={`${c.platform}:${c.account_ref}`}>{PLATFORM_LABEL[c.platform]}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-bold text-gray-700">
                メインキーワード <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editor.keyword}
                onChange={(e) => setEditor({ ...editor, keyword: e.target.value })}
                placeholder="例: 料金"
                maxLength={100}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary-500"
              />
              <p className="mt-1 text-xs text-gray-500">このキーワードがDMに含まれる場合に反応します</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-gray-700">サブキーワード（関連語・表記ゆれ）</label>
              <div className="mb-2 flex gap-2">
                <input
                  type="text"
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      addSub()
                    }
                  }}
                  placeholder="例: 値段"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary-500"
                />
                <button type="button" onClick={addSub} className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 hover:bg-gray-200">
                  追加
                </button>
              </div>
              {editor.subKeywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editor.subKeywords.map((k) => (
                    <span key={k} className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-sm text-gray-700">
                      {k}
                      <button
                        type="button"
                        aria-label={`${k} を削除`}
                        onClick={() => setEditor({ ...editor, subKeywords: editor.subKeywords.filter((x) => x !== k) })}
                        className="ml-1 text-gray-400 hover:text-gray-600"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-gray-700">
                返信メッセージ <span className="text-red-500">*</span>
              </label>
              <textarea
                value={editor.responseText}
                onChange={(e) => setEditor({ ...editor, responseText: e.target.value })}
                placeholder="返信する内容を入力してください"
                maxLength={MAX_RESPONSE_LENGTH}
                className="h-32 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-primary-500"
              />
              <p className="mt-1 text-right text-xs text-gray-400">
                {editor.responseText.length} / {MAX_RESPONSE_LENGTH}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
              <span className="text-sm font-bold text-gray-700">このルールを有効にする</span>
              <Switch label="このルールを有効にする" checked={editor.isActive} onChange={(v) => setEditor({ ...editor, isActive: v })} />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="ルールを削除"
        footerContent={
          <div className="flex w-full justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg px-4 py-2 font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              閉じる
            </button>
            <button
              type="button"
              disabled={deleteTarget !== null && rules.busy === deleteTarget.id}
              onClick={async () => {
                if (!deleteTarget) return
                notify(await rules.deleteRule(deleteTarget.id))
                setDeleteTarget(null)
              }}
              className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              削除する
            </button>
          </div>
        }
      >
        <p className="text-gray-600">
          「{deleteTarget?.keyword}」のルールを削除してもよろしいですか？<br />
          この操作は取り消せません。
        </p>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AI 応答
// ---------------------------------------------------------------------------

function AiTab({
  settings: s, knowledge, busy, onToggle, onPreview,
}: {
  settings: MarketingSettingsView
  knowledge: KnowledgeSummary | null
  busy: string | null
  onToggle: (patch: SettingsPatch) => void
  onPreview: ReturnType<typeof useAutoReplyRules>['previewAiReply']
}) {
  const mode = aiMode(s)
  const hasKnowledge = !!knowledge && knowledge.activeChars > 0
  const usage = knowledge ? Math.min((knowledge.activeChars / knowledge.maxChars) * 100, 100) : 0
  const over = !!knowledge && knowledge.activeChars > knowledge.maxChars

  return (
    <div className="grid grid-cols-1 gap-8 p-4 sm:p-6 lg:grid-cols-2">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">AI応答を有効にする</h3>
              <ModeBadge mode={mode} />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              キーワードに当てはまらなかったDMに、LINEの自動応答と同じ学習データを使ってAIが返信します。
              学習データで答えられない質問は送らず、担当者に回します。
            </p>
          </div>
          <Switch
            size="lg"
            label="AI応答を有効にする"
            checked={s.ai_reply_enabled}
            disabled={busy !== null || (!hasKnowledge && !s.ai_reply_enabled)}
            onChange={(v) => onToggle({ ai_reply_enabled: v })}
          />
        </div>

        {s.ai_reply_enabled && (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 p-5">
            <div>
              <h4 className="font-bold text-gray-900">AI応答をドライランにする</h4>
              <p className="mt-1 text-sm text-gray-500">
                オンの間はAIの返信を送らず「応答履歴」に記録だけします。内容を確認してからオフにしてください。
              </p>
              {mode === 'dry' && !s.ai_reply_dry_run && (
                <p className="mt-2 text-xs text-amber-700">
                  全体の自動応答が{s.auto_reply_enabled ? 'ドライラン' : 'オフ'}のため、AI応答も送信されません。
                </p>
              )}
            </div>
            <Switch
              label="AI応答をドライランにする"
              checked={s.ai_reply_dry_run}
              disabled={busy !== null}
              onChange={(v) => onToggle({ ai_reply_dry_run: v })}
            />
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-gray-900">
                <BookOpen size={18} className="text-primary-600" /> 参照する学習データ
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                {knowledge?.storeName ? `「${knowledge.storeName}」の` : ''}LINE自動応答と共通です。口調も
                {knowledge?.tone === 'friendly' ? '「フレンドリー」' : '「丁寧・フォーマル」'}
                {knowledge?.hasPersona ? 'と追加の指示' : ''}を引き継ぎます。
              </p>
            </div>
            <Link
              to="/auto-responses?tab=knowledge"
              className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              編集 <ChevronRight size={14} />
            </Link>
          </div>

          {knowledge && knowledge.docs.length > 0 ? (
            <>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-gray-500">使用量</span>
                <span className={`font-bold ${over ? 'text-red-600' : usage >= 80 ? 'text-orange-600' : 'text-gray-900'}`}>
                  {knowledge.activeChars.toLocaleString()} / {knowledge.maxChars.toLocaleString()} 文字
                </span>
              </div>
              <div className="mb-4 h-2 w-full rounded-full bg-gray-200">
                <div
                  className={`h-2 rounded-full ${over ? 'bg-red-500' : usage >= 80 ? 'bg-orange-500' : 'bg-primary-500'}`}
                  style={{ width: `${usage}%` }}
                />
              </div>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                {knowledge.docs.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <FileText size={16} className={d.isActive ? 'text-primary-500' : 'text-gray-300'} />
                    <span className={`min-w-0 flex-1 truncate ${d.isActive ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                      {d.fileName}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">{d.chars.toLocaleString()}文字</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-gray-200 px-4 py-8 text-center">
              <BookOpen className="mb-2 h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">学習データがまだありません</p>
              <p className="mt-1 text-xs text-gray-500">LINEの自動応答画面で資料を追加すると、ここでも使えるようになります。</p>
            </div>
          )}
        </div>
      </div>

      <AiPreview disabled={!hasKnowledge} onPreview={onPreview} />
    </div>
  )
}

type PreviewMessage = { role: 'user' | 'assistant' | 'handoff'; content: string }

function AiPreview({
  disabled, onPreview,
}: {
  disabled: boolean
  onPreview: ReturnType<typeof useAutoReplyRules>['previewAiReply']
}) {
  const [messages, setMessages] = useState<PreviewMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)
    const history = next
      .filter((m) => m.role !== 'handoff')
      .map((m) => ({ direction: m.role === 'user' ? 'inbound' as const : 'outbound' as const, text: m.content }))
    const r = await onPreview(history)
    setLoading(false)
    if (!r.success) {
      setMessages((p) => [...p, { role: 'handoff', content: r.message }])
    } else if (r.needsHuman || !r.draft) {
      setMessages((p) => [...p, { role: 'handoff', content: 'AIは返信せず、担当者に回します' }])
    } else {
      setMessages((p) => [...p, { role: 'assistant', content: r.draft! }])
    }
  }

  return (
    <div className="h-fit lg:sticky lg:top-8">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-700">
          <Bot size={16} /> プレビュー
        </h3>
        <p className="ml-6 mt-1 text-xs text-gray-500">実際のDMには送られません。お客様になりきって送ってみてください。</p>
      </div>

      <div className="relative mx-auto max-w-[320px] rounded-[3rem] border-4 border-gray-900 bg-gray-800 p-4 shadow-2xl">
        <div className="absolute left-1/2 top-0 z-20 h-6 w-32 -translate-x-1/2 rounded-b-xl bg-gray-800" />
        <div className="flex h-[560px] w-full flex-col overflow-hidden rounded-[2rem] bg-white">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 px-4 pt-4">
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px]">
                <span className="block h-full w-full rounded-full bg-white" />
              </span>
              <span className="text-sm font-bold text-gray-900">DM</span>
            </div>
            <button
              type="button"
              onClick={() => setMessages([])}
              className="rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100"
              title="会話をリセット"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center text-xs text-gray-400">
                {disabled ? '学習データを登録するとプレビューできます' : <>例:「料金はいくらですか？」<br />と送ってみてください</>}
              </div>
            ) : (
              messages.map((m, i) =>
                m.role === 'handoff' ? (
                  <div key={i} className="flex justify-center">
                    <span className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-[11px] text-amber-700">
                      <Inbox size={12} /> {m.content}
                    </span>
                  </div>
                ) : (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                        m.role === 'user' ? 'bg-gray-100 text-gray-900' : 'bg-primary-500 text-white'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ),
              )
            )}
            {loading && (
              <div className="flex justify-end">
                <div className="rounded-2xl bg-primary-50 px-3 py-2">
                  <Loader2 className="h-3 w-3 animate-spin text-primary-500" />
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-gray-100 p-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) void send()
                }}
                placeholder="メッセージを入力"
                disabled={loading || disabled}
                className="flex-1 rounded-full border border-gray-200 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={loading || disabled || !input.trim()}
                aria-label="送信"
                className="flex items-center justify-center rounded-full bg-primary-600 p-2 text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 応答履歴
// ---------------------------------------------------------------------------

type HistoryFilter = 'all' | 'keyword_rule' | 'ai_auto' | 'handoff'

const HISTORY_FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'keyword_rule', label: 'キーワード' },
  { id: 'ai_auto', label: 'AI' },
  { id: 'handoff', label: '担当者に回した' },
]

function HistoryTab({ queue, onRefresh }: { queue: OutboundQueueRow[]; onRefresh: () => void }) {
  const [filter, setFilter] = useState<HistoryFilter>('all')

  const rows = queue.filter((q) => {
    if (filter === 'all') return true
    if (filter === 'handoff') return q.last_error === 'ai: needs_human'
    return q.sentBy === filter
  })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="絞り込み">
          {HISTORY_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                filter === f.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={14} /> 更新
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center text-gray-400">
          <History className="mb-3 h-12 w-12 opacity-20" />
          <p>まだ履歴がありません</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((q) => {
            const status = QUEUE_STATUS[q.status] ?? { label: q.status, className: 'bg-gray-100 text-gray-600' }
            const reason = queueErrorLabel(q)
            const isAi = q.sentBy === 'ai_auto'
            return (
              <li key={q.id} className="flex gap-3 p-4">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isAi ? 'bg-primary-50 text-primary-600' : 'bg-gray-100 text-gray-500'
                  }`}
                  title={isAi ? 'AI応答' : 'キーワード応答'}
                >
                  {isAi ? <Sparkles size={16} /> : <MessageSquare size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{q.displayName ?? '（表示名不明）'}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${status.className}`}>{status.label}</span>
                    <span className="ml-auto text-xs text-gray-400">{formatDateTime(q.sent_at ?? q.created_at)}</span>
                  </div>
                  {q.text && <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-gray-600">{q.text}</p>}
                  {reason && (
                    <p className={`mt-1 text-xs ${q.status === 'skipped' ? 'text-amber-700' : 'text-red-600'}`}>{reason}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
