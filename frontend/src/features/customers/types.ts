export type Customer = {
  id: string
  line_user_id: string
  display_name: string | null
  profile_picture_url: string | null
  real_name: string | null
  furigana: string | null
  notes: string | null
}

export type CustomerData = Customer & {
  points: number
  lastVisit: string | null
  status: 'Member' | 'VIP'
}

export type CustomerDetail = CustomerData

export type ReservationHistory = {
  id: string
  start_time: string
  menu_name: string | null
  staff_name: string | null
  status: string
}

export type TreatmentNote = {
  id: string
  reservation_id: string | null
  content: string
  visited_at: string | null
  created_at: string
  updated_at: string
}
