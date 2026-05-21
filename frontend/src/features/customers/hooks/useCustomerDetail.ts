import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { pickEmbeddedName } from '../../../lib/supabaseRelation'
import type { CustomerDetail, ReservationHistory } from '../types'
import type { MembershipCardSettings } from '../../../hooks/usePointOperation'

export function useCustomerDetail(customerId: string | undefined) {
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeSettings, setStoreSettings] = useState<MembershipCardSettings | null>(null)
  const [hasLineAccount, setHasLineAccount] = useState(false)
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [reservationHistory, setReservationHistory] = useState<ReservationHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReservations = useCallback(
    async (sid: string, lineUserId: string, limit = 100) => {
      setHistoryLoading(true)
      try {
        const { data, error: resError } = await supabase
          .from('reservations')
          .select('id, start_time, status, menu_id, menu:booking_menus(name), staff:staff_members(name)')
          .eq('store_id', sid)
          .eq('line_user_id', lineUserId)
          .order('start_time', { ascending: false })
          .limit(limit)

        if (resError) throw resError

        const rows = data ?? []
        const missingMenuIds = [
          ...new Set(
            rows.filter((r) => !pickEmbeddedName(r.menu) && r.menu_id).map((r) => r.menu_id as string),
          ),
        ]
        let menuNameById: Record<string, string> = {}
        if (missingMenuIds.length > 0) {
          const { data: menus } = await supabase
            .from('booking_menus')
            .select('id, name')
            .in('id', missingMenuIds)
          menuNameById = Object.fromEntries((menus ?? []).map((m) => [m.id, m.name]))
        }

        setReservationHistory(
          rows.map((r) => ({
            id: r.id,
            start_time: r.start_time,
            status: r.status,
            menu_name: pickEmbeddedName(r.menu) ?? (r.menu_id ? menuNameById[r.menu_id] ?? null : null),
            staff_name: pickEmbeddedName(r.staff),
          })),
        )
      } catch (e) {
        console.error('fetchReservations:', e)
        setReservationHistory([])
      } finally {
        setHistoryLoading(false)
      }
    },
    [],
  )

  const fetchCustomer = useCallback(async () => {
    if (!customerId) return
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('認証が必要です')
        return
      }

      const { data: stores } = await supabase
        .from('stores')
        .select('id, membership_card_settings')
        .eq('owner_id', user.id)
        .limit(1)

      const store = stores?.[0]
      if (!store) {
        setError('店舗が見つかりません')
        return
      }

      setStoreId(store.id)
      setStoreSettings(store.membership_card_settings as MembershipCardSettings)

      const { data: lineAcc } = await supabase
        .from('line_accounts')
        .select('id')
        .eq('store_id', store.id)
        .maybeSingle()
      setHasLineAccount(!!lineAcc)

      const { data: row, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('store_id', store.id)
        .eq('id', customerId)
        .maybeSingle()

      if (custError) throw custError
      if (!row) {
        setError('顧客が見つかりません')
        setCustomer(null)
        return
      }

      const { data: pointRow } = await supabase
        .from('points')
        .select('balance')
        .eq('store_id', store.id)
        .eq('line_user_id', row.line_user_id)
        .maybeSingle()

      const points = pointRow?.balance ?? 0

      const { data: lastRes } = await supabase
        .from('reservations')
        .select('start_time')
        .eq('store_id', store.id)
        .eq('line_user_id', row.line_user_id)
        .lt('start_time', new Date().toISOString())
        .neq('status', 'cancelled')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle()

      const detail: CustomerDetail = {
        ...row,
        points,
        lastVisit: lastRes?.start_time ?? null,
        status: points >= 1000 ? 'VIP' : 'Member',
      }

      setCustomer(detail)
      await fetchReservations(store.id, row.line_user_id)
    } catch (e) {
      console.error('fetchCustomer:', e)
      setError('顧客情報の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [customerId, fetchReservations])

  useEffect(() => {
    fetchCustomer()
  }, [fetchCustomer])

  const refreshPoints = useCallback((newBalance: number) => {
    setCustomer((prev) =>
      prev
        ? {
            ...prev,
            points: newBalance,
            status: newBalance >= 1000 ? 'VIP' : 'Member',
          }
        : null,
    )
  }, [])

  const updateCustomerLocal = useCallback((patch: Partial<CustomerDetail>) => {
    setCustomer((prev) => (prev ? { ...prev, ...patch } : null))
  }, [])

  return {
    storeId,
    storeSettings,
    hasLineAccount,
    customer,
    reservationHistory,
    historyLoading,
    loading,
    error,
    fetchCustomer,
    fetchReservations,
    refreshPoints,
    updateCustomerLocal,
  }
}
