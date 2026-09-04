import { useEffect, useState } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { CAMPAIGN_STATUS_LABELS, type MessageCampaign } from '../types'
import { describeSegment } from '../lib/segments'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sending: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  partial: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
}

type Props = {
  storeId: string
  onSelect: (campaignId: string) => void
}

export default function CampaignHistoryList({ storeId, onSelect }: Props) {
  const [campaigns, setCampaigns] = useState<MessageCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchCampaigns = async () => {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('message_campaigns')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (cancelled) return

      if (fetchError) {
        console.error('Failed to fetch campaigns:', fetchError)
        setError('配信履歴の取得に失敗しました')
      } else {
        setCampaigns((data ?? []) as MessageCampaign[])
      }
      setLoading(false)
    }

    fetchCampaigns()
    return () => {
      cancelled = true
    }
  }, [storeId])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-600 py-6 text-center">{error}</p>
  }

  if (campaigns.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-12 text-center">
        まだ配信履歴はありません。「新規配信」から最初のメッセージを送ってみましょう。
      </p>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
      {campaigns.map((campaign) => (
        <button
          key={campaign.id}
          type="button"
          onClick={() => onSelect(campaign.id)}
          className="w-full text-left p-4 hover:bg-gray-50 transition flex items-center gap-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  STATUS_STYLES[campaign.status] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
              </span>
              <span className="text-sm font-medium text-gray-900">
                {describeSegment(campaign.segment_type, campaign.segment_params)}
              </span>
              {campaign.ai_generated && (
                <span className="text-xs text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">
                  AI下書き
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate mt-1">{campaign.message_text}</p>
            <p className="text-xs text-gray-400 mt-1">
              {new Date(campaign.created_at).toLocaleString('ja-JP')} ・ 送信
              {campaign.sent_count.toLocaleString()}件
              {campaign.failed_count > 0 && ` ・ 失敗${campaign.failed_count.toLocaleString()}件`}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
        </button>
      ))}
    </div>
  )
}
