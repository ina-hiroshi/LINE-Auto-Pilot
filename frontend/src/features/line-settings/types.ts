export type BookingSystemType = 'generic' | 'salon' | 'restaurant'

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
}

export interface RichMenuAction {
  label: string
  url: string
  icon: string
}

export interface RichMenuSettings {
  template_id: string
  layout_id: string
  custom_image_url: string
  actions: Record<number, RichMenuAction>
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
