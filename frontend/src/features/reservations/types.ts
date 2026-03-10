export type Customer = {
  id: string
  line_user_id: string
  display_name: string
  profile_picture_url: string | null
  real_name: string | null
  furigana: string | null
}

export type Reservation = {
  id: string
  start_time: string
  end_time: string
  status: string
  memo: string
  line_user_id: string
  registration_type?: 'line' | 'manual'
  google_event_id?: string | null
  customer?: {
    display_name: string
    profile_picture_url: string | null
    real_name: string | null
    furigana: string | null
  }
  staff?: {
    name: string
  }
  menu?: {
    name: string
    price?: number | null
  }
  staff_id?: string
  menu_id?: string
}

export type GoogleCalendar = {
  id: string
  summary: string
  primary?: boolean
  backgroundColor?: string
}

export type GoogleEvent = {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  htmlLink: string
  location?: string
  description?: string
}
