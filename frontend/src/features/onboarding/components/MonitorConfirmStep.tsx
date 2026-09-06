import { useState } from 'react'
import { motion } from 'framer-motion'
import { Gift, Loader2, ArrowLeft, Check } from 'lucide-react'

interface MonitorConfirmStepProps {
  /** LINE公式アカウントを既に持っているか。初期設定手順メールの内容が変わる。 */
  hasLineAccount: boolean
  onHasLineAccountChange: (has: boolean) => void
  loading: boolean
  progressMsg: string
  /** 「応募する」の最終確定。申込の記録まで行ってからプラン選択へ進む。 */
  onApply: () => void
  /** 「スキップ」。何も記録せずプラン選択へ進む。 */
  onSkip: () => void
  onBack: () => void
}

/**
 * モニター確認画面。基本情報の直後、プラン選択の前に単一の画面として表示する。
 *
 * 以前はプラン選択画面の中（Proプランを選んだ場合のみ）にチェックボックスとして
 * 埋め込まれていたが、モニター応募が目的で登録した人にとっては「いきなり有料プラン
 * 選択画面に入れられた」ように見えてしまっていた。ここで先にモニター参加の意思を
 * 確認し、その上でプラン選択（Proプランが対象）へ進む。
 */
export default function MonitorConfirmStep({
  hasLineAccount,
  onHasLineAccountChange,
  loading,
  progressMsg,
  onApply,
  onSkip,
  onBack,
}: MonitorConfirmStepProps) {
  // 「応募する」を押した後、LINE公式アカウントの所有確認を挟んでから確定する。
  const [wantsToApply, setWantsToApply] = useState(false)

  return (
    <motion.div
      key="monitor_confirm"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8">
        <div className="text-center mb-8">
          <div className="bg-primary-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gift className="text-primary-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">モニター特典（任意）</h1>
          <p className="text-slate-500">この後のプラン選択の前に、モニターへの参加をご確認します。</p>
        </div>

        <div className="bg-primary-50 border border-primary-100 rounded-xl p-5 mb-6">
          <p className="text-2xl font-bold text-primary-700 mb-1">
            LINE初期設定代行が無料
          </p>
          <p className="text-sm text-slate-600">
            通常 ¥9,980 の初期設定代行を、こちらで無償で行います。
            LINE公式アカウントとIToguchiの接続設定（チャネル作成・認証情報の登録・Webhook設定）を
            メールのやり取りだけで代行します。
            ※ 公式アカウントの開設はお客様ご自身で行っていただきます（無料・手順はご案内します）。
          </p>
        </div>

        <p className="text-sm text-slate-700 mb-6">
          特典の適用条件は、
          <span className="font-bold">設定のしやすさなどについて簡単なインタビューフォームへ回答すること</span>
          だけです。特典の対象にはProプラン（30日間無料）が必要です。
          ご協力いただかない場合も、Proプランには通常どおりご加入いただけます
          （初期設定代行は通常価格 ¥9,980 になります）。
        </p>

        {!wantsToApply ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setWantsToApply(true)}
              className="flex items-center justify-center gap-2 bg-primary-600 text-white px-6 py-4 rounded-xl font-bold hover:bg-primary-700 transition shadow-lg shadow-primary-200"
            >
              <Gift size={18} />
              モニターに応募する
            </button>
            <button
              type="button"
              onClick={onSkip}
              disabled={loading}
              className="px-6 py-4 rounded-xl font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
            >
              スキップして通常登録に進む
            </button>
          </div>
        ) : (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-sm font-bold text-slate-700 mb-3 mt-5">
              LINE公式アカウントはお持ちですか？
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                onClick={() => onHasLineAccountChange(true)}
                className={`text-left px-4 py-3 rounded-xl border transition ${
                  hasLineAccount
                    ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="block font-bold text-slate-800 text-sm">持っている</span>
                <span className="block text-xs text-slate-500 mt-0.5">連携の手順をお送りします</span>
              </button>
              <button
                type="button"
                onClick={() => onHasLineAccountChange(false)}
                className={`text-left px-4 py-3 rounded-xl border transition ${
                  !hasLineAccount
                    ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="block font-bold text-slate-800 text-sm">持っていない</span>
                <span className="block text-xs text-slate-500 mt-0.5">開設の手順からご案内します</span>
              </button>
            </div>
            <button
              type="button"
              onClick={onApply}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white px-6 py-4 rounded-xl font-bold hover:bg-primary-700 transition shadow-lg shadow-primary-200 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {progressMsg || '処理中...'}
                </>
              ) : (
                <>
                  <Check size={18} />
                  この内容で応募する
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium"
        >
          <ArrowLeft size={20} />
          戻る
        </button>
      </div>
    </motion.div>
  )
}
