import { useState, type FormEvent } from 'react'
import { MessageSquare, Save, Loader2, AlertTriangle } from 'lucide-react'
import type { LineSettingsState } from '../types'

interface ConnectionTabProps {
  lineSettings: LineSettingsState
  saving: boolean
  webhookUrl: string
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onChange: (next: LineSettingsState) => void
}

export function ConnectionTab({ lineSettings, saving, webhookUrl, onSubmit, onChange }: ConnectionTabProps) {
  const [copied, setCopied] = useState(false)
  // 認証情報は入っているのに Bot User ID が無い状態では、LINEのメッセージを受信できない
  const notConnected = Boolean(lineSettings.channel_token) && !lineSettings.line_user_id

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Webhook URL をコピーしてください', webhookUrl)
    }
  }

  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-6 pb-2 border-b">
        <MessageSquare className="text-[#06C755]" size={24} />
        <h2 className="text-xl font-bold text-gray-800">接続設定</h2>
      </div>
      <form className="space-y-4" onSubmit={onSubmit} autoComplete="off">
        {notConnected && (
          <div role="alert" className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>LINE と接続できていません。Channel Access Token を確認して、もう一度「設定を保存」を押してください。接続できるまで、LINEのメッセージは受信されません。</p>
          </div>
        )}
        {(lineSettings.bot_id || lineSettings.line_user_id) && (
          <div className="space-y-2 mb-4">
            {lineSettings.bot_id && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-3">
                <div className="bg-[#06C755] p-2 rounded-full text-white">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">連携中のアカウント (Basic ID)</p>
                  <p className="text-lg font-bold text-gray-800">{lineSettings.bot_id}</p>
                </div>
              </div>
            )}
            {lineSettings.line_user_id && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-full text-white">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">LINE ID (Bot User ID)</p>
                  <p className="text-lg font-bold text-gray-800 font-mono">{lineSettings.line_user_id}</p>
                </div>
              </div>
            )}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Channel ID</label>
          <input
            type="text"
            value={lineSettings.channel_id}
            onChange={(e) => onChange({ ...lineSettings, channel_id: e.target.value })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#06C755]/20 outline-none"
            placeholder="1234567890"
            autoComplete="off"
            name="line_channel_id_field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Channel Secret</label>
          <input
            type="password"
            value={lineSettings.channel_secret}
            onChange={(e) => onChange({ ...lineSettings, channel_secret: e.target.value })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#06C755]/20 outline-none"
            placeholder="••••••••"
            autoComplete="new-password"
            name="line_channel_secret_field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Channel Access Token</label>
          <textarea
            value={lineSettings.channel_token}
            onChange={(e) => onChange({ ...lineSettings, channel_token: e.target.value })}
            className="w-full p-2 border rounded-lg h-24 focus:ring-2 focus:ring-[#06C755]/20 outline-none"
            placeholder="長期のチャネルアクセストークンを貼り付け"
            autoComplete="off"
            name="line_channel_token_field"
          />
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-[#06C755] text-white px-6 py-2.5 rounded-lg hover:bg-[#05b34c] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
            設定を保存
          </button>
        </div>
      </form>

      <div className="mt-6 text-xs text-gray-500">
        <p className="font-bold mb-1">Webhook URL</p>
        <div className="flex gap-2 mt-2 mb-2">
          <input
            type="text"
            readOnly
            value={webhookUrl}
            className="w-full p-2 border rounded-lg bg-white text-gray-600 outline-none text-xs"
          />
          <button
            type="button"
            onClick={copyWebhookUrl}
            className="px-3 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-xs whitespace-nowrap"
          >
            {copied ? 'コピーしました' : 'コピー'}
          </button>
        </div>
      </div>
    </section>
  )
}
