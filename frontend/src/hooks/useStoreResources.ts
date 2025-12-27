import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { StoreMenu, StoreStaff } from '../types/storeResources'

export function useStoreResources(storeId: string | null) {
  const [staffList, setStaffList] = useState<StoreStaff[]>([])
  const [menuList, setMenuList] = useState<StoreMenu[]>([])
  const [loading, setLoading] = useState(false)

  const refreshResources = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    try {
      const [{ data: staff }, { data: menus }] = await Promise.all([
        supabase
          .from('staff_members')
          .select('id, name, role, image_url, is_active')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('created_at', { ascending: true }),
        supabase
          .from('booking_menus')
          .select('id, name, description, price, duration_minutes, capacity_per_slot, is_active')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
      ])

      if (staff) setStaffList(staff)
      if (menus) setMenuList(menus)
    } catch (error) {
      console.error('Failed to fetch store resources', error)
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    refreshResources()
  }, [refreshResources])

  return { staffList, menuList, loading, refreshResources, setStaffList, setMenuList }
}
