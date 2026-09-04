export type MessageLogStatus =
  | 'auto_replied'
  | 'ai_replied'
  | 'manual_reply_needed'
  | 'manual_replied'
  | 'resolved'

export type LogEntry = {
  id: string
  created_at: string
  line_user_id: string
  message_content: string
  reply_content: string | null
  status: MessageLogStatus
  display_name?: string
  profile_picture_url?: string
}

export const STATUS_LABELS: Record<MessageLogStatus, string> = {
  auto_replied: '自動応答',
  ai_replied: 'AI応答',
  manual_reply_needed: '要対応',
  manual_replied: '手動返信',
  resolved: '対応済',
}

/** 一斉配信の対象セグメント。値は message_campaigns.segment_type と一致させること */
export type SegmentType =
  | 'all'
  | 'visited'
  | 'prospective'
  | 'dormant'
  | 'recent'
  | 'repeat'
  | 'menu'
  | 'staff'
  | 'high_spender'
  | 'manual'

export type SegmentParams = {
  /** dormant: 最終来店からの経過日数がこれを超える顧客 */
  dormant_days?: number
  /** recent: 最終来店がこの日数以内の顧客 */
  recent_days?: number
  /** repeat: 来店回数の下限・上限 */
  min_visit_count?: number
  max_visit_count?: number
  menu_id?: string
  staff_id?: string
  /** high_spender: 累計利用金額の上位何名か */
  top_n?: number
  /** manual: 顧客一覧で選んだ customers.id */
  customer_ids?: string[]
}

export type CampaignStatus = 'draft' | 'sending' | 'completed' | 'partial' | 'failed'

export type MessageCampaign = {
  id: string
  segment_type: SegmentType
  segment_params: SegmentParams
  message_text: string
  ai_generated: boolean
  status: CampaignStatus
  total_recipients: number
  sent_count: number
  failed_count: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  error: string | null
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: '準備中',
  sending: '配信中',
  completed: '配信完了',
  partial: '一部失敗',
  failed: '配信失敗',
}
