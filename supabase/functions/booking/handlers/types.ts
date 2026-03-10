import type { SupabaseClientType } from '../../_shared/types.ts'

export type CorsHeaders = Record<string, string>

export type BookingParams = {
  store_id?: string
  line_user_id?: string
  date?: string
  time?: string
  reservation_id?: string
  staff_id?: string
  menu_id?: string
  memo?: string
  display_name?: string
  profile_picture_url?: string
  real_name?: string
  furigana?: string
  is_manual?: boolean
}

export type HandlerContext = {
  supabaseClient: SupabaseClientType
  params: BookingParams
  corsHeaders: CorsHeaders
  isManualRegistration: boolean
  line_user_id: string
}

export type HandlerFn = (ctx: HandlerContext) => Promise<Response>
