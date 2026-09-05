import { useState } from 'react'
import {
  AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert, ShieldCheck,
} from 'lucide-react'
import Toast from '../../components/Toast'
import { useMarketingSettings, type CredentialView } from '../../features/marketing/hooks/useMarketingSettings'

const PLATFORM_LABEL: Record<CredentialView['platform'], string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
}

function formatJst(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

function StatusBadge({ status }: { status: CredentialView['status'] }) {
  if (status === 'needs_reauth') {
    return (
      <span className="flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <ShieldAlert size={12} /> 要対応
      </span>
    )
  }
  if (status === 'expired') {
    return (
      <span className="flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <ShieldAlert size={12} /> 失効
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <ShieldCheck size={12} /> 正常
    </span>
  )
}

function CredentialCard({ cred }: { cred: CredentialView }) {
  const expiryDays = daysUntil(cred.expires_at)
  const dataAccessDays = daysUntil(cred.data_access_expires_at)

  return (
    <div className={`rounded-lg border bg-white p-4 ${cred.status !== 'active' ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-200'}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-bold text-gray-900">{PLATFORM_LABEL[cred.platform]}</span>
        <StatusBadge status={cred.status} />
        <span className="ml-auto text-xs text-gray-400">確認: {formatJst(cred.last_checked_at)}</span>
      </div>

      <div className="space-y-1.5 text-sm text-gray-700">
        {cred.platform === 'instagram' ? (
          <div className="flex justify-between">
            <span className="text-gray-500">トークン失効</span>
            <span className={expiryDays !== null && expiryDays <= 14 ? 'font-medium text-red-600' : ''}>
              {formatJst(cred.expires_at)}
              {expiryDays !== null && <span className="ml-1 text-xs text-gray-400">（あと{expiryDays}日）</span>}
            </span>
          </div>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-gray-500">トークン有効期限</span>
              <span>{cred.expires_at ? formatJst(cred.expires_at) : '無期限'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">データアクセス期限</span>
              <span className={dataAccessDays !== null && dataAccessDays <= 14 ? 'font-medium text-red-600' : ''}>
                {formatJst(cred.data_access_expires_at)}
                {dataAccessDays !== null && <span className="ml-1 text-xs text-gray-400">（あと{dataAccessDays}日）</span>}
              </span>
            </div>
          </>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">前回の自動更新</span>
          <span>{formatJst(cred.last_refreshed_at)}</span>
        </div>
      </div>

      {cred.last_error && (
        <p className="mt-3 break-all rounded border border-red-100 bg-red-50 px-2 py-1.5 text-xs text-red-600">
          {cred.last_error}
        </p>
      )}

      {cred.platform === 'facebook' && cred.missingExtendedScopes.length > 0 && (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-medium">再認可待ちの権限があります（広告・DM機能に必要）</p>
          <p className="mt-1 text-amber-700">{cred.missingExtendedScopes.join(' / ')}</p>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const s = useMarketingSettings()
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false, message: '', type: 'success',
  })

  const notify = (r: { success: boolean; message?: string }) =>
    setToast({ isVisible: true, message: r.message ?? '', type: r.success ? 'success' : 'error' })

  if (s.loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="mr-2 animate-spin" size={20} /> 読み込み中...
      </div>
    )
  }

  if (s.loadError || !s.settings) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="mb-2 flex items-center gap-2 font-medium">
          <AlertTriangle size={18} /> 読み込めませんでした
        </div>
        <p className="text-sm">{s.loadError}</p>
      </div>
    )
  }

  const anyNeedsReauth = s.credentials.some((c) => c.status !== 'active')

  return (
    <div className="max-w-3xl space-y-6">
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((p) => ({ ...p, isVisible: false }))}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">接続状態</h2>
          <p className="text-sm text-gray-500">
            投稿・DM・広告が使う Meta のトークンです。IG は毎日自動で更新されます。
          </p>
        </div>
        <button
          type="button"
          disabled={s.busy !== null}
          onClick={async () => notify(await s.refreshTokensNow())}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {s.busy === 'refresh_now' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          今すぐ確認
        </button>
      </div>

      {anyNeedsReauth && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <p>対応が必要な項目があります。下のカードを確認してください。</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {s.credentials.map((c) => <CredentialCard key={c.id} cred={c} />)}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-gray-900">運用設定</h3>
        <div className="space-y-4">
          <ToggleRow
            label="自動投稿"
            note="毎日21:00のIG/FBカルーセル自動投稿。オフにすると投稿は行われず、次のcronでスキップされます。"
            checked={s.settings.social_autopost_enabled}
            busy={s.busy === 'social_autopost_enabled'}
            onChange={async (v) => notify(await s.updateSetting({ social_autopost_enabled: v }))}
          />
          <ToggleRow
            label="自動応答"
            note="DMのキーワード自動返信・AI下書きの自動送信。オフの間は下書きの作成のみ行い送信しません。"
            checked={s.settings.auto_reply_enabled}
            busy={s.busy === 'auto_reply_enabled'}
            onChange={async (v) => notify(await s.updateSetting({ auto_reply_enabled: v }))}
          />
          <ToggleRow
            label="自動応答をドライランにする"
            note="オンの間は実際には送信せず「送るはずだった内容」だけを記録します。動作を確認してからオフにしてください。"
            checked={s.settings.auto_reply_dry_run}
            busy={s.busy === 'auto_reply_dry_run'}
            onChange={async (v) => notify(await s.updateSetting({ auto_reply_dry_run: v }))}
            tone={s.settings.auto_reply_dry_run ? 'safe' : 'warn'}
          />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
        <p>
          Facebook の再認可（同意ダイアログ）だけは自動化できません。実行後は「今すぐ確認」を押すと
          反映状況がここに出ます。
        </p>
      </div>
    </div>
  )
}

function ToggleRow({
  label, note, checked, busy, onChange, tone,
}: {
  label: string
  note: string
  checked: boolean
  busy: boolean
  onChange: (v: boolean) => void
  tone?: 'safe' | 'warn'
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className={`text-sm font-medium ${tone === 'warn' ? 'text-amber-700' : 'text-gray-900'}`}>{label}</p>
        <p className="mt-0.5 text-xs text-gray-500">{note}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={busy}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          checked ? (tone === 'warn' ? 'bg-amber-500' : 'bg-primary-600') : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
