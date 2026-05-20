import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Download, TrendingUp } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { formatYen, getJstDateString } from '../../../lib/reservationStatus'
import ProLockOverlay from '../../../components/ProLockOverlay'
import ProBadge from '../../../components/ProBadge'
import { usePlan } from '../../../hooks/usePlan'

type PaidReservation = {
  id: string
  paid_amount: number | null
  paid_at: string | null
  menu_id: string | null
  staff_id: string | null
  menu?: { name: string } | null
  staff?: { name: string } | null
}

type SalesSummaryTabProps = {
  storeId: string | null
}

function getMonthRangeJst(): { from: Date; to: Date } {
  const now = new Date()
  const jstYear = parseInt(
    now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }).slice(0, 4),
    10,
  )
  const jstMonth = parseInt(
    now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }).slice(5, 7),
    10,
  )
  const from = new Date(`${jstYear}-${String(jstMonth).padStart(2, '0')}-01T00:00:00+09:00`)
  const to = new Date(from)
  to.setMonth(to.getMonth() + 1)
  return { from, to }
}

export function SalesSummaryTab({ storeId }: SalesSummaryTabProps) {
  const { isPro } = usePlan()
  const [loading, setLoading] = useState(true)
  const [paidReservations, setPaidReservations] = useState<PaidReservation[]>([])
  const [unpaidCount, setUnpaidCount] = useState(0)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const loadData = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    try {
      const month = getMonthRangeJst()
      const fromIso = isPro && dateFrom ? `${dateFrom}T00:00:00+09:00` : month.from.toISOString()
      const toIso = isPro && dateTo ? `${dateTo}T23:59:59+09:00` : month.to.toISOString()

      const { data: paid, error: paidError } = await supabase
        .from('reservations')
        .select('id, paid_amount, paid_at, menu_id, staff_id, menu:booking_menus(name), staff:staff_members(name)')
        .eq('store_id', storeId)
        .eq('status', 'paid')
        .gte('paid_at', fromIso)
        .lt('paid_at', toIso)
        .order('paid_at', { ascending: false })

      if (paidError) throw paidError
      const rows = (paid ?? []).map((r) => {
        const menu = Array.isArray(r.menu) ? r.menu[0] : r.menu
        const staff = Array.isArray(r.staff) ? r.staff[0] : r.staff
        return {
          id: r.id,
          paid_amount: r.paid_amount,
          paid_at: r.paid_at,
          menu_id: r.menu_id,
          staff_id: r.staff_id,
          menu: menu ?? null,
          staff: staff ?? null,
        } as PaidReservation
      })
      setPaidReservations(rows)

      const { count, error: unpaidError } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq('status', 'confirmed')

      if (!unpaidError) setUnpaidCount(count ?? 0)
    } catch (e) {
      console.error('Sales load error:', e)
    } finally {
      setLoading(false)
    }
  }, [storeId, isPro, dateFrom, dateTo])

  useEffect(() => {
    loadData()
  }, [loadData])

  const stats = useMemo(() => {
    const total = paidReservations.reduce((sum, r) => sum + (r.paid_amount ?? 0), 0)
    const count = paidReservations.length

    const menuMap: Record<string, { name: string; amount: number; count: number }> = {}
    const staffMap: Record<string, { name: string; amount: number; count: number }> = {}
    const dayMap: Record<string, number> = {}

    paidReservations.forEach((r) => {
      const amount = r.paid_amount ?? 0
      const menuName = r.menu?.name || '未設定'
      const staffName = r.staff?.name || '未設定'
      if (!menuMap[menuName]) menuMap[menuName] = { name: menuName, amount: 0, count: 0 }
      menuMap[menuName].amount += amount
      menuMap[menuName].count += 1
      if (!staffMap[staffName]) staffMap[staffName] = { name: staffName, amount: 0, count: 0 }
      staffMap[staffName].amount += amount
      staffMap[staffName].count += 1
      if (r.paid_at) {
        const day = getJstDateString(new Date(r.paid_at))
        dayMap[day] = (dayMap[day] ?? 0) + amount
      }
    })

    const menuTop = Object.values(menuMap).sort((a, b) => b.amount - a.amount).slice(0, 5)
    const staffTop = Object.values(staffMap).sort((a, b) => b.amount - a.amount).slice(0, 5)
    const dailyChart = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date: date.slice(5), amount }))

    return { total, count, menuTop, staffTop, dailyChart }
  }, [paidReservations])

  const handleExportCsv = () => {
    const header = '決済日時,金額税込,メニュー,担当\n'
    const rows = paidReservations
      .map((r) => {
        const at = r.paid_at ? new Date(r.paid_at).toLocaleString('ja-JP') : ''
        return `${at},${r.paid_amount ?? 0},${r.menu?.name ?? ''},${r.staff?.name ?? ''}`
      })
      .join('\n')
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales_${dateFrom || 'month'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">読み込み中...</div>
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">決済完了した予約のみを売上（税込）に含みます。</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">今月の総売上</p>
          <p className="text-2xl font-bold text-gray-900">{formatYen(stats.total)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">決済完了件数</p>
          <p className="text-2xl font-bold text-gray-900">{stats.count}件</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 p-5 shadow-sm bg-amber-50/50">
          <p className="text-sm text-amber-800 mb-1">未決済（全期間）</p>
          <p className="text-2xl font-bold text-amber-900">{unpaidCount}件</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <TopList title="メニュー別 TOP" items={stats.menuTop} />
        <TopList title="スタッフ別 TOP" items={stats.staffTop} />
      </div>

      <div className="relative bg-white rounded-xl border border-gray-100 p-6 shadow-sm min-h-[280px]">
        {!isPro && <ProBadge className="absolute top-4 right-4 z-10" />}
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp size={18} />
          日別売上
        </h3>
        {isPro ? (
          <>
            <div className="flex flex-wrap gap-3 mb-4">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
              />
              <span className="text-gray-400 self-center">〜</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={loadData}
                className="text-sm text-primary-600 font-medium hover:underline"
              >
                適用
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="ml-auto flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                <Download size={16} />
                CSV
              </button>
            </div>
            {stats.dailyChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => formatYen(typeof v === 'number' ? v : Number(v))} />
                  <Line type="monotone" dataKey="amount" stroke="#00a3b8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500 text-center py-12">この期間の売上データはありません</p>
            )}
          </>
        ) : (
          <>
            <div className="h-48 flex items-center justify-center text-gray-300 text-sm blur-sm select-none">
              日別売上グラフのプレビュー
            </div>
            <ProLockOverlay description="Proプランで期間指定・日別グラフ・CSVエクスポートが利用できます。" />
          </>
        )}
      </div>
    </div>
  )
}

function TopList({
  title,
  items,
}: {
  title: string
  items: { name: string; amount: number; count: number }[]
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <h3 className="font-bold text-gray-800 mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">データがありません</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={item.name} className="flex justify-between text-sm">
              <span className="text-gray-700">
                {i + 1}. {item.name}
                <span className="text-gray-400 ml-1">({item.count}件)</span>
              </span>
              <span className="font-medium text-gray-900">{formatYen(item.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
