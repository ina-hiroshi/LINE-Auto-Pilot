/** get-line-quota Edge Function のレスポンス形 */
export type LineQuotaInfo = {
  type: string
  limit?: number
  totalUsage: number
  basicId?: string
}

function planLabel(limit: number | undefined): string {
  if (limit === 200) return 'フリープラン'
  if (limit === 5000) return 'ライトプラン'
  if (limit === 30000) return 'スタンダードプラン'
  return 'カスタムプラン'
}

/** ダッシュボード「メッセージ対応」モーダルと同じゲージ表示 */
export function LineMessagingQuotaPanel({ quotaInfo }: { quotaInfo: LineQuotaInfo | null }) {
  if (!quotaInfo) return null
  return (
    <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-xs text-emerald-800">
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold">{planLabel(quotaInfo.limit)}</span>
        <span className="font-bold">
          {quotaInfo.totalUsage.toLocaleString()} /{' '}
          {quotaInfo.type === 'none' ? '無制限' : quotaInfo.limit?.toLocaleString()}
        </span>
      </div>
      {quotaInfo.type !== 'none' && quotaInfo.limit && (
        <div className="w-full bg-emerald-200 rounded-full h-1.5">
          <div
            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((quotaInfo.totalUsage / quotaInfo.limit) * 100, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

/** フッター文言・LINE マネージャーへのリンク */
export function LineMessagingQuotaFooterLinks({ align = 'right' }: { align?: 'left' | 'right' }) {
  return (
    <div
      className={`text-[10px] text-gray-500 space-y-0.5 ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <p>プランごとの無料メッセージ上限: フリー(200) / ライト(5,000) / スタンダード(30,000)</p>
      <a
        href="https://manager.line.biz/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-600 underline hover:text-emerald-700 inline-flex items-center gap-1"
      >
        プランの変更・確認はこちら
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    </div>
  )
}
