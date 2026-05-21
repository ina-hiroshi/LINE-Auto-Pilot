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
