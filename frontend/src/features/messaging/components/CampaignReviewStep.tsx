import { AlertTriangle, Send, Users } from 'lucide-react'
import {
  LineMessagingQuotaFooterLinks,
  LineMessagingQuotaPanel,
  type LineQuotaInfo,
} from '../../../components/line/LineMessagingQuotaNotice'
import type { SegmentParams, SegmentType } from '../types'
import { describeSegment } from '../lib/segments'

type Props = {
  segmentType: SegmentType
  segmentParams: SegmentParams
  resourceName?: string | null
  recipientCount: number
  messageText: string
  quotaInfo: LineQuotaInfo | null
  sending: boolean
  onSend: () => void
}

export default function CampaignReviewStep({
  segmentType,
  segmentParams,
  resourceName,
  recipientCount,
  messageText,
  quotaInfo,
  sending,
  onSend,
}: Props) {
  const remaining =
    quotaInfo && quotaInfo.type !== 'none' && typeof quotaInfo.limit === 'number'
      ? quotaInfo.limit - quotaInfo.totalUsage
      : null

  const quotaShortfall = remaining !== null && remaining < recipientCount

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-bold text-gray-900 mb-3">配信内容の確認</h3>

        <dl className="space-y-3 text-sm">
          <div className="flex gap-3">
            <dt className="text-gray-500 w-24 shrink-0">配信対象</dt>
            <dd className="text-gray-900 font-medium">
              {describeSegment(segmentType, segmentParams, resourceName)}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="text-gray-500 w-24 shrink-0">送信数</dt>
            <dd className="text-gray-900 font-medium flex items-center gap-1">
              <Users className="w-4 h-4 text-gray-400" />
              {recipientCount.toLocaleString()}名
            </dd>
          </div>
        </dl>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-2">お客様に届く見え方</h3>
        <div className="bg-[#7494c0] rounded-lg p-4">
          <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 max-w-sm shadow-sm">
            <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{messageText}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-2">LINEの配信可能数</h3>
        <LineMessagingQuotaPanel quotaInfo={quotaInfo} />
        {remaining !== null && (
          <p className="text-xs text-gray-500 mt-2">
            今月の残り{remaining.toLocaleString()}通のうち、{recipientCount.toLocaleString()}通を使います。
          </p>
        )}
        <div className="mt-2">
          <LineMessagingQuotaFooterLinks align="left" />
        </div>
      </div>

      {quotaShortfall && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            今月の配信可能数が足りません。配信対象を絞り込むか、LINE公式アカウントのプランをご確認ください。
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          送信したメッセージは取り消せません。本文と配信対象をもう一度ご確認ください。
        </div>
      </div>

      <button
        type="button"
        onClick={onSend}
        disabled={sending || quotaShortfall || recipientCount === 0 || messageText.trim().length === 0}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-bold"
      >
        <Send className="w-4 h-4" />
        {recipientCount.toLocaleString()}名に配信する
      </button>
    </div>
  )
}
