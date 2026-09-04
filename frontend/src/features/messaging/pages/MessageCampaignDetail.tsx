import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import Toast from '../../../components/Toast'
import { CAMPAIGN_STATUS_LABELS, type MessageCampaign } from '../types'
import { describeSegment } from '../lib/segments'
import { useCampaignSend } from '../hooks/useCampaign'

export default function MessageCampaignDetail() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const navigate = useNavigate()

  const [campaign, setCampaign] = useState<MessageCampaign | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success',
  })

  const { resume, sending } = useCampaignSend()

  const fetchCampaign = useCallback(async () => {
    if (!campaignId) return

    const { data, error: fetchError } = await supabase
      .from('message_campaigns')
      .select('*, store_id')
      .eq('id', campaignId)
      .maybeSingle()

    if (fetchError) {
      console.error('Failed to fetch campaign:', fetchError)
      setError('配信情報の取得に失敗しました')
    } else if (!data) {
      setError('配信が見つかりません')
    } else {
      setCampaign(data as MessageCampaign)
      setStoreId((data as { store_id: string }).store_id)
    }
    setLoading(false)
  }, [campaignId])

  useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  // 送信中は進捗が動くので、リロードなしで反映する
  useEffect(() => {
    if (!campaignId) return

    const channel = supabase
      .channel(`campaign-${campaignId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'message_campaigns', filter: `id=eq.${campaignId}` },
        (payload) => setCampaign(payload.new as MessageCampaign),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [campaignId])

  const handleResume = async () => {
    if (!storeId || !campaignId) return

    const result = await resume(storeId, campaignId)
    if (!result.success) {
      setToast({ isVisible: true, message: result.message, type: 'error' })
      return
    }
    setToast({ isVisible: true, message: '残りの配信を再開しました', type: 'success' })
    fetchCampaign()
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (error || !campaign) {
    return <div className="p-8 text-center text-red-600">{error ?? '配信が見つかりません'}</div>
  }

  const pending = campaign.total_recipients - campaign.sent_count - campaign.failed_count
  // 送信が途中で切れると sending のまま未処理が残る。常駐ジョブは無いので、
  // ここから店舗が明示的に再開できるようにする。
  const canResume = pending > 0 && campaign.status !== 'completed'

  return (
    <div className="flex flex-col h-full">
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, isVisible: false }))}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => navigate('/message-campaigns')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            メッセージ配信に戻る
          </button>

          <div className="bg-white rounded-lg shadow p-6 mb-4">
            <div className="flex items-center gap-3 mb-4">
              {campaign.status === 'completed' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : campaign.status === 'sending' ? (
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              )}
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  {CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
                </h1>
                <p className="text-sm text-gray-500">
                  {describeSegment(campaign.segment_type, campaign.segment_params)} ・{' '}
                  {new Date(campaign.created_at).toLocaleString('ja-JP')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">配信対象</div>
                <div className="text-lg font-bold text-gray-900">
                  {campaign.total_recipients.toLocaleString()}
                </div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3">
                <div className="text-xs text-emerald-700">送信</div>
                <div className="text-lg font-bold text-emerald-800">
                  {campaign.sent_count.toLocaleString()}
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-xs text-red-700">失敗</div>
                <div className="text-lg font-bold text-red-800">
                  {campaign.failed_count.toLocaleString()}
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-3">
              「送信」はLINEへの送信が成功した件数です。お客様が読んだかどうかはLINEの仕様上わかりません。
            </p>

            {canResume && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 mb-2">
                  {pending.toLocaleString()}件が未送信のまま残っています。通信が途中で切れた可能性があります。
                </p>
                <button
                  type="button"
                  onClick={handleResume}
                  disabled={sending}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50 text-sm font-bold"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  残りを配信する
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-3">配信した本文</h2>
            <div className="bg-[#7494c0] rounded-lg p-4">
              <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 max-w-sm shadow-sm">
                <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                  {campaign.message_text}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
