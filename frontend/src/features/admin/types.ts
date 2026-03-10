export interface SetupOrder {
  id: string
  user_id: string
  store_id: string | null
  status: string
  amount: number
  contact_email: string | null
  has_line_account: boolean
  line_account_basic_id: string | null
  additional_notes: string | null
  admin_notes: string | null
  assigned_to: string | null
  paid_at: string | null
  completed_at: string | null
  created_at: string
  profiles?: {
    email: string
    full_name: string | null
  }
  stores?: {
    store_name: string
  }
}

export interface LineSettings {
  channel_id: string
  channel_secret: string
  channel_token: string
}

export type StoreDetail = {
  store_id: string
  store_name: string
  owner_id: string
  has_line_connection: boolean
  bot_id: string | null
  channel_id: string | null
  line_connected_at: string | null
  store_created_at: string
  user_email: string | null
  user_name: string | null
  user_created_at: string | null
  plan: string
  bot_picture_url: string | null
  store_message_count: number
  store_auto_reply_count: number
  store_ai_reply_count: number
  store_reservation_count: number
}

export interface AnalyticsData {
  summary: {
    totalUsers: number
    paidPlanRate: string
    lineConnectionRate: string
    autoResponseRate: string
  }
  registrations: {
    daily: Array<{ date: string; count: number }>
  }
  plans: {
    distribution: Array<{ name: string; value: number; color: string }>
    counts: Record<string, number>
  }
  messages: {
    total: number
    daily: Array<{ date: string; count: number }>
    statusCounts: Record<string, number>
    autoResponseRate: string
  }
  reservations: {
    total: number
    daily: Array<{ date: string; count: number }>
    statusCounts: Record<string, number>
    registrationTypeCounts: Record<string, number>
  }
  lineConnections: {
    totalStores: number
    connectedStoresCount: number
    connectionRate: string
    details: StoreDetail[]
  }
}
