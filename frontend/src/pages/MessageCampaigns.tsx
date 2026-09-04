import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Toast from '../components/Toast'
import { UnderlineTabs } from '../components/UnderlineTabs'
import type { LineQuotaInfo } from '../components/line/LineMessagingQuotaNotice'
import { useStoreResources } from '../hooks/useStoreResources'
import SegmentSelector from '../features/messaging/components/SegmentSelector'
import CampaignMessageComposer from '../features/messaging/components/CampaignMessageComposer'
import CampaignReviewStep from '../features/messaging/components/CampaignReviewStep'
import CampaignHistoryList from '../features/messaging/components/CampaignHistoryList'
import { useCampaignSend, useSegmentPreview } from '../features/messaging/hooks/useCampaign'
import { findSegmentDefinition } from '../features/messaging/lib/segments'
import type { SegmentParams, SegmentType } from '../features/messaging/types'

type TabId = 'compose' | 'history'

/** 顧客一覧から「選択した方に配信」で渡ってくる state */
type CampaignNavigationState = {
  presetSegment?: SegmentType
  customerIds?: string[]
}

const STEP_LABELS = ['配信対象', 'メッセージ', '確認・配信']

export default function MessageCampaigns() {
  const navigate = useNavigate()
  const location = useLocation()
  const navigationState = location.state as CampaignNavigationState | null

  const [tab, setTab] = useState<TabId>('compose')
  const [step, setStep] = useState(0)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [quotaInfo, setQuotaInfo] = useState<LineQuotaInfo | null>(null)

  // 顧客一覧から渡された選択は state にしか無く、リロードすると消える。
  // 消えた状態で manual のまま進むと、意図しない相手に送ることになるので、
  // 初期化時に一度だけ取り込み、以降は自分で保持する。
  const [manualCustomerIds] = useState<string[]>(() => navigationState?.customerIds ?? [])

  const [segmentType, setSegmentType] = useState<SegmentType>(() =>
    navigationState?.presetSegment === 'manual' && (navigationState.customerIds?.length ?? 0) > 0
      ? 'manual'
      : 'all',
  )
  const [segmentParams, setSegmentParams] = useState<SegmentParams>(() =>
    navigationState?.presetSegment === 'manual' && (navigationState.customerIds?.length ?? 0) > 0
      ? { customer_ids: navigationState.customerIds }
      : {},
  )

  const [messageText, setMessageText] = useState('')
  const [aiGenerated, setAiGenerated] = useState(false)

  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success',
  })

  const { staffList, menuList } = useStoreResources(storeId)
  const { preview, loading: previewLoading, error: previewError, fetchPreview } = useSegmentPreview()
  const { send, sending } = useCampaignSend()

  useEffect(() => {
    const loadStore = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data: stores } = await supabase
          .from('stores')
          .select('id')
          .eq('owner_id', user.id)
          .limit(1)

        const store = stores?.[0]
        if (!store) {
          setLoadError('店舗が見つかりません。先に店舗情報を登録してください。')
          return
        }
        setStoreId(store.id)
      } catch (e) {
        console.error('Failed to load store:', e)
        setLoadError('店舗情報の取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    loadStore()
  }, [])

  useEffect(() => {
    if (!storeId) return

    const loadQuota = async () => {
      const { data, error } = await supabase.functions.invoke('get-line-quota', {
        body: { storeId },
      })
      if (error) {
        console.error('Failed to fetch LINE quota:', error)
        return
      }
      setQuotaInfo(data as LineQuotaInfo)
    }

    loadQuota()
  }, [storeId])

  const paramsKey = JSON.stringify(segmentParams)

  // 条件を変えるたびに人数を引き直す。連続操作で毎回叩かないよう少し待つ。
  useEffect(() => {
    if (!storeId) return

    const definition = findSegmentDefinition(segmentType)
    if (definition?.resource === 'menu' && !segmentParams.menu_id) return
    if (definition?.resource === 'staff' && !segmentParams.staff_id) return

    const timer = setTimeout(() => {
      fetchPreview(storeId, segmentType, segmentParams)
    }, 300)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, segmentType, paramsKey, fetchPreview])

  const resourceName = useMemo(() => {
    if (segmentType === 'menu') {
      return menuList.find((menu) => menu.id === segmentParams.menu_id)?.name ?? null
    }
    if (segmentType === 'staff') {
      return staffList.find((staff) => staff.id === segmentParams.staff_id)?.name ?? null
    }
    return null
  }, [segmentType, segmentParams.menu_id, segmentParams.staff_id, menuList, staffList])

  const handleSegmentChange = useCallback((type: SegmentType, params: SegmentParams) => {
    setSegmentType(type)
    setSegmentParams(type === 'manual' ? { customer_ids: params.customer_ids ?? [] } : params)
  }, [])

  const canProceedFromSegment = useMemo(() => {
    if (!preview || preview.count === 0) return false
    const definition = findSegmentDefinition(segmentType)
    if (definition?.resource === 'menu' && !segmentParams.menu_id) return false
    if (definition?.resource === 'staff' && !segmentParams.staff_id) return false
    if (segmentType === 'manual' && (segmentParams.customer_ids?.length ?? 0) === 0) return false
    return true
  }, [preview, segmentType, segmentParams])

  const handleSend = async () => {
    if (!storeId) return

    const result = await send({
      storeId,
      segmentType,
      segmentParams,
      messageText,
      aiGenerated,
    })

    if (!result.success) {
      setToast({ isVisible: true, message: result.message, type: 'error' })
      return
    }

    navigate(`/message-campaigns/${result.campaignId}`)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (loadError || !storeId) {
    return <div className="p-8 text-center text-red-600">{loadError ?? '店舗が見つかりません'}</div>
  }

  return (
    <div className="flex flex-col h-full">
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, isVisible: false }))}
      />

      <div className="shrink-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200 w-full">
        <div className="px-4 sm:px-8 py-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">メッセージ配信</h1>
          <p className="text-sm text-gray-500">
            来店状況や利用メニューでお客様を絞り込んで、LINEで一斉にお知らせできます。
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">
          <UnderlineTabs<TabId>
            activeId={tab}
            onChange={(id) => setTab(id)}
            items={[
              { id: 'compose', label: '新規配信' },
              { id: 'history', label: '配信履歴' },
            ]}
          />

          {tab === 'history' ? (
            <CampaignHistoryList
              storeId={storeId}
              onSelect={(campaignId) => navigate(`/message-campaigns/${campaignId}`)}
            />
          ) : (
            <div>
              <ol className="flex items-center gap-2 mb-6 text-xs">
                {STEP_LABELS.map((label, index) => (
                  <li key={label} className="flex items-center gap-2">
                    <span
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${
                        index === step
                          ? 'bg-primary-600 text-white font-bold'
                          : index < step
                          ? 'bg-primary-100 text-primary-800'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <span>{index + 1}</span>
                      {label}
                    </span>
                    {index < STEP_LABELS.length - 1 && <span className="text-gray-300">›</span>}
                  </li>
                ))}
              </ol>

              {step === 0 && (
                <SegmentSelector
                  segmentType={segmentType}
                  segmentParams={segmentParams}
                  onChange={handleSegmentChange}
                  menuList={menuList}
                  staffList={staffList}
                  preview={preview}
                  previewLoading={previewLoading}
                  previewError={previewError}
                  manualSelectionCount={manualCustomerIds.length}
                />
              )}

              {step === 1 && (
                <CampaignMessageComposer
                  storeId={storeId}
                  segmentType={segmentType}
                  targetDetail={resourceName}
                  messageText={messageText}
                  onChangeMessage={(text, fromAi) => {
                    setMessageText(text)
                    if (fromAi) setAiGenerated(true)
                  }}
                />
              )}

              {step === 2 && (
                <CampaignReviewStep
                  segmentType={segmentType}
                  segmentParams={segmentParams}
                  resourceName={resourceName}
                  recipientCount={preview?.count ?? 0}
                  messageText={messageText}
                  quotaInfo={quotaInfo}
                  sending={sending}
                  onSend={handleSend}
                />
              )}

              <div className="flex justify-between mt-8">
                <button
                  type="button"
                  onClick={() => setStep((current) => Math.max(0, current - 1))}
                  disabled={step === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition disabled:opacity-0 disabled:cursor-default"
                >
                  <ArrowLeft className="w-4 h-4" />
                  戻る
                </button>

                {step < 2 && (
                  <button
                    type="button"
                    onClick={() => setStep((current) => current + 1)}
                    disabled={step === 0 ? !canProceedFromSegment : messageText.trim().length === 0}
                    className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold"
                  >
                    <Send className="w-4 h-4" />
                    次へ
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
