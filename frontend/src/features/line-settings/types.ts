export type BookingSystemType = 'generic' | 'salon' | 'restaurant'

export type BusinessHourSlot = { start: string; end: string }
export type BusinessHours = Partial<Record<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat', BusinessHourSlot[]>>

export interface Staff {
  id: string
  name: string
  role?: string | null
  image_url?: string | null
  is_active?: boolean | null
}

export interface Menu {
  id: string
  name: string
  description?: string | null
  price?: number | null
  duration_minutes?: number | null
  capacity_per_slot?: number | null
  is_active?: boolean | null
}

export interface LineSettingsState {
  channel_id: string
  channel_secret: string
  channel_token: string
  bot_id: string
}

export interface BookingSettings {
  liff_template_id: string
  liff_theme_color: string
  liff_logo_url: string
  booking_system_type: BookingSystemType
  slot_interval_minutes: number
  capacity_per_slot: number
  max_booking_days?: number
  business_hours?: BusinessHours | null
  // 予約機能フラグ
  booking_enable_party_size: boolean
  booking_enable_staff: boolean
  booking_enable_menu: boolean
}

export interface RichMenuAction {
  label: string
  url: string
  icon: string
  is_enabled?: boolean
  show_icon?: boolean
  show_label?: boolean
  background_image_url?: string
  icon_color?: string
  label_color?: string
}

export interface RichMenuSlotConfig {
  slot_type: 'booking' | 'message' | 'member_card' | 'custom'
  action: RichMenuAction
  background_image_url?: string
  show_icon?: boolean
}

export interface RichMenuSettings {
  template_id: string
  layout_id: string
  custom_image_url: string
  actions: Record<number, RichMenuAction>
  // Pro features
  slot_configs?: Record<number, RichMenuSlotConfig>
  slot_background_images?: Record<number, string>
}

export interface ProfileData {
  full_name: string
  full_name_kana: string
  user_phone_number: string
  store_name: string
  postal_code: string
  address: string
  store_phone_number: string
  industry: string
}

export interface GoogleCalendarSettings {
  connected: boolean
  calendar_id?: string
  updated_at?: string
}

export interface DeletingItem {
  type: 'staff' | 'menu'
  id: string
  name: string
}
