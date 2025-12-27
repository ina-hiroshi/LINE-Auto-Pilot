export type StoreStaff = {
  id: string
  name: string
  role?: string | null
  image_url?: string | null
  is_active?: boolean | null
}

export type StoreMenu = {
  id: string
  name: string
  description?: string | null
  price?: number | null
  duration_minutes?: number | null
  capacity_per_slot?: number | null
  is_active?: boolean | null
}
