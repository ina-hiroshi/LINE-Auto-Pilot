import { useEffect, useState } from 'react'
import Modal from '../../../components/Modal'
import { supabase } from '../../../lib/supabase'
import { toErrorMessageAsync } from '../../../lib/errorUtils'
import { formatYen } from '../../../lib/reservationStatus'
import type { Reservation } from '../types'
import type { StoreMenu, StoreStaff } from '../../../types/storeResources'

type PaymentModalProps = {
  isOpen: boolean
  onClose: () => void
  reservation: Reservation
  storeId: string
  staffList: StoreStaff[]
  menuList: StoreMenu[]
  onSuccess: (paidAmount: number) => void
}

export function PaymentModal({
  isOpen,
  onClose,
  reservation,
  storeId,
  staffList,
  menuList,
  onSuccess,
}: PaymentModalProps) {
  const [paidAmount, setPaidAmount] = useState('')
  const [staffId, setStaffId] = useState(reservation.staff_id || '')
  const [menuId, setMenuId] = useState(reservation.menu_id || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const initial = reservation.quoted_amount ?? reservation.menu?.price ?? 0
    setPaidAmount(String(initial))
    setStaffId(reservation.staff_id || '')
    setMenuId(reservation.menu_id || '')
    setError(null)
  }, [isOpen, reservation])

  const handleConfirm = async () => {
    const amount = parseInt(paidAmount, 10)
    if (isNaN(amount) || amount < 0) {
      setError('決済金額（税込）を入力してください')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data, error: invokeError, response } = await supabase.functions.invoke('booking', {
        body: {
          action: 'complete_payment',
          store_id: storeId,
          reservation_id: reservation.id,
          paid_amount: amount,
          staff_id: staffId || null,
          menu_id: menuId || null,
          is_manual: true,
        },
      })

      if (invokeError) {
        setError(await toErrorMessageAsync(invokeError, response))
        return
      }
      if (data && typeof data === 'object' && data !== null && 'error' in data) {
        const msg = (data as { error: unknown }).error
        if (typeof msg === 'string') {
          setError(msg)
          return
        }
      }

      onSuccess(amount)
    } catch (e) {
      setError(await toErrorMessageAsync(e))
    } finally {
      setLoading(false)
    }
  }

  const start = new Date(reservation.start_time)
  const customerName =
    reservation.customer?.real_name || reservation.customer?.display_name || 'ゲスト'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="決済"
      showDefaultButtons={false}
      footerContent={
        <div className="flex items-center justify-between gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            戻る
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            決済を確定
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {start.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}{' '}
          {start.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}〜 · {customerName} 様
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            決済金額（税込） <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              min={0}
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            />
            <span className="absolute right-3 top-2.5 text-sm text-gray-400">円</span>
          </div>
          {reservation.quoted_amount != null && (
            <p className="mt-1 text-xs text-gray-500">見込み: {formatYen(reservation.quoted_amount)}</p>
          )}
        </div>

        {staffList.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">担当スタッフ</label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">指定なし</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {menuList.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メニュー</label>
            <select
              value={menuId}
              onChange={(e) => setMenuId(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">指定なし</option>
              {menuList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.price != null ? `(¥${m.price.toLocaleString()})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
