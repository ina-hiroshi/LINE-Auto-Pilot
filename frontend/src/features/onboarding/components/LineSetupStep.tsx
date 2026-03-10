import { motion } from 'framer-motion'
import {
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  HelpCircle,
  BookOpen,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

export interface LineSettingsData {
  channel_id: string
  channel_secret: string
  channel_token: string
}

interface LineSetupStepProps {
  lineSettings: LineSettingsData
  onLineSettingsChange: (settings: LineSettingsData) => void
  expandedGuide: string | null
  onExpandedGuideChange: (guide: string | null) => void
  setupBannerVersion: string
  hasSetupServiceOrder: boolean
  webhookUrl: string
  copiedField: string | null
  loading: boolean
  onSetupServiceClick: () => void
  onSave: () => void
  onSkip: () => void
  onBack: () => void
  onCopyToClipboard: (text: string, field: string) => void
}

export default function LineSetupStep({
  lineSettings,
  onLineSettingsChange,
  expandedGuide,
  onExpandedGuideChange,
  setupBannerVersion,
  hasSetupServiceOrder,
  webhookUrl,
  copiedField,
  loading,
  onSetupServiceClick,
  onSave,
  onSkip,
  onBack,
  onCopyToClipboard,
}: LineSetupStepProps) {
  return (
    <motion.div
      key="line_setup"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8">
        <div className="text-center mb-8">
          <div className="bg-[#06C755]/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="text-[#06C755]" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">LINE公式アカウントと接続</h1>
          <p className="text-slate-500">ステップごとに丁寧にご案内します。ゆっくり進めてください。</p>
        </div>

        {/* 初期設定代行バナー（環境変数VITE_SETUP_BANNER_VERSIONで制御） */}
        {/* 正式リリース版 - 決済済みの場合は別のメッセージを表示 */}
        {setupBannerVersion === 'production' && !hasSetupServiceOrder && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl p-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle size={20} />
                  <span className="font-bold">設定が難しいですか？</span>
                </div>
                <p className="text-sm text-white/90">
                  専門スタッフがあなたの代わりにLINE接続設定を完了させます。
                </p>
              </div>
              <button
                onClick={onSetupServiceClick}
                className="bg-white text-amber-600 px-6 py-3 rounded-xl font-bold hover:bg-amber-50 transition whitespace-nowrap shadow-lg"
              >
                初期設定代行を依頼（¥9,980）
              </button>
            </div>
          </div>
        )}
        {setupBannerVersion === 'production' && hasSetupServiceOrder && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl p-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Check size={20} />
                  <span className="font-bold">初期設定代行サービスにお申し込みいただきありがとうございます</span>
                </div>
                <p className="text-sm text-white/90">
                  決済が完了しました。メールでご案内いたしますので、しばらくお待ちください。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* プレリリース版 */}
        {setupBannerVersion === 'prerelease' && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl p-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={20} />
                  <span className="font-bold">プレリリースモニターの方へ</span>
                </div>
                <p className="text-sm text-white/90">
                  プレリリース期間中は初期設定代行サービスをご利用いただけません。以下の手順に沿ってご自身で設定をお願いいたします。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* LINE設定のサブステップ */}
        <div className="space-y-4">
          {/* Step 1: LINE公式アカウント作成 */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => onExpandedGuideChange(expandedGuide === 'create_account' ? null : 'create_account')}
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition"
            >
              <div className="flex items-center gap-3">
                <span className="bg-[#06C755] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                <span className="font-bold text-slate-800">LINE公式アカウントの作成</span>
              </div>
              {expandedGuide === 'create_account' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            {expandedGuide === 'create_account' && (
              <div className="p-4 bg-white border-t border-slate-200">
                <p className="text-sm text-slate-600 mb-4">
                  まだLINE公式アカウントをお持ちでない場合は、以下のリンクから作成してください。
                  すでにお持ちの方はスキップしてください。
                </p>
                <a
                  href="https://www.linebiz.com/jp/entry/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#06C755] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#05b34c] transition"
                >
                  LINE公式アカウント開設ページ <ExternalLink size={16} />
                </a>
              </div>
            )}
          </div>

          {/* Step 2: LINE Developers登録 */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => onExpandedGuideChange(expandedGuide === 'developers' ? null : 'developers')}
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition"
            >
              <div className="flex items-center gap-3">
                <span className="bg-[#06C755] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <span className="font-bold text-slate-800">LINE Developersへの登録とチャネル作成</span>
              </div>
              {expandedGuide === 'developers' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            {expandedGuide === 'developers' && (
              <div className="p-4 bg-white border-t border-slate-200">
                <p className="text-sm text-slate-600 mb-4">
                  Messaging APIを利用するために、LINE Developersへの登録が必要です。
                </p>
                <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2 mb-4">
                  <li>
                    <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="text-[#06C755] hover:underline font-medium">
                      LINE Developers Console
                    </a>
                    にログインします。
                  </li>
                  <li>初めての場合は「プロバイダー作成」を行います（店舗名などでOK）。</li>
                  <li>「新規チャネル作成」をクリックし、「Messaging API」を選択します。</li>
                  <li>必要な情報を入力してチャネルを作成します。</li>
                </ol>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  <BookOpen size={16} className="inline mr-2" />
                  チャネル作成時の「アプリタイプ」は「BOT」を選択してください。
                </div>
              </div>
            )}
          </div>

          {/* Step 3: 設定情報の取得と入力 */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => onExpandedGuideChange(expandedGuide === 'credentials' ? null : 'credentials')}
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition"
            >
              <div className="flex items-center gap-3">
                <span className="bg-[#06C755] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                <span className="font-bold text-slate-800">設定情報の取得と入力</span>
              </div>
              {expandedGuide === 'credentials' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            {expandedGuide === 'credentials' && (
              <div className="p-4 bg-white border-t border-slate-200 space-y-4">
                <p className="text-sm text-slate-600">
                  作成したチャネルの設定画面から以下の情報を取得し、下のフォームに入力してください。
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      Channel ID <span className="text-slate-400 font-normal">（チャネル基本設定タブ）</span>
                    </label>
                    <input
                      type="text"
                      value={lineSettings.channel_id}
                      onChange={(e) => onLineSettingsChange({ ...lineSettings, channel_id: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#06C755]/20 focus:border-[#06C755] outline-none"
                      placeholder="1234567890"
                      autoComplete="off"
                      name="line-channel-id"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      Channel Secret <span className="text-slate-400 font-normal">（チャネル基本設定タブ）</span>
                    </label>
                    <input
                      type="text"
                      value={lineSettings.channel_secret}
                      onChange={(e) => onLineSettingsChange({ ...lineSettings, channel_secret: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#06C755]/20 focus:border-[#06C755] outline-none"
                      placeholder="abcdef1234567890..."
                      autoComplete="off"
                      name="line-channel-secret"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      Channel Access Token <span className="text-slate-400 font-normal">（Messaging API設定タブ → 発行）</span>
                    </label>
                    <textarea
                      value={lineSettings.channel_token}
                      onChange={(e) => onLineSettingsChange({ ...lineSettings, channel_token: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#06C755]/20 focus:border-[#06C755] outline-none h-20"
                      placeholder="Long lived access token..."
                      autoComplete="off"
                      name="line-channel-token"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step 4: Webhook設定 */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => onExpandedGuideChange(expandedGuide === 'webhook' ? null : 'webhook')}
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition"
            >
              <div className="flex items-center gap-3">
                <span className="bg-[#06C755] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                <span className="font-bold text-slate-800">Webhookの設定</span>
              </div>
              {expandedGuide === 'webhook' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            {expandedGuide === 'webhook' && (
              <div className="p-4 bg-white border-t border-slate-200">
                <p className="text-sm text-slate-600 mb-4">
                  LINEからのメッセージを受け取るための設定を行います。
                </p>

                <div className="bg-slate-50 rounded-lg p-3 mb-4">
                  <p className="text-xs font-bold text-slate-700 mb-2">Webhook URL（これをコピーしてください）</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={webhookUrl}
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-600"
                    />
                    <button
                      onClick={() => onCopyToClipboard(webhookUrl, 'webhook')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                        copiedField === 'webhook'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                      }`}
                    >
                      {copiedField === 'webhook' ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
                  <li>LINE Developers Consoleの「Messaging API設定」タブを開きます。</li>
                  <li>「Webhook設定」の「編集」をクリックし、上記URLを貼り付けて「更新」します。</li>
                  <li><strong>「Webhookの利用」をオン</strong>にします。</li>
                  <li>「検証」ボタンを押して、成功することを確認します。</li>
                </ol>
              </div>
            )}
          </div>

          {/* Step 5: 応答設定 */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => onExpandedGuideChange(expandedGuide === 'response' ? null : 'response')}
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition"
            >
              <div className="flex items-center gap-3">
                <span className="bg-[#06C755] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">5</span>
                <span className="font-bold text-slate-800">応答設定の変更</span>
              </div>
              {expandedGuide === 'response' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            {expandedGuide === 'response' && (
              <div className="p-4 bg-white border-t border-slate-200">
                <p className="text-sm text-slate-600 mb-4">
                  LINE公式アカウントの自動応答と競合しないように設定を変更します。
                </p>
                <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
                  <li>LINE Developers Consoleの「Messaging API設定」タブにある「LINE公式アカウント機能」の「応答メッセージ」をクリックします。</li>
                  <li>「応答設定」で以下のように設定します：
                    <ul className="list-disc list-inside ml-4 mt-1 text-slate-500">
                      <li><strong>応答メッセージ</strong>: オフ</li>
                      <li><strong>Webhook</strong>: オン</li>
                    </ul>
                  </li>
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium"
        >
          <ArrowLeft size={20} />
          戻る
        </button>
        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="px-6 py-3 text-slate-600 hover:text-slate-800 font-medium"
          >
            あとで設定する
          </button>
          <button
            onClick={onSave}
            disabled={loading || !lineSettings.channel_id || !lineSettings.channel_secret || !lineSettings.channel_token}
            className="flex items-center gap-2 bg-[#06C755] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#05b34c] transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                設定を保存して次へ
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
