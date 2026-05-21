import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2, User, Search, ChevronRight, QrCode } from 'lucide-react'
import Toast from '../components/Toast'
import QRScannerModal from '../components/QRScannerModal'
import { formatCustomerLabel } from '../features/customers/lib/customerDisplayName'
import type { CustomerData } from '../features/customers/types'

export type { CustomerData }

export default function Customers() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [customers, setCustomers] = useState<CustomerData[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [storeId, setStoreId] = useState<string | null>(null)
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false)

  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success',
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  useEffect(() => {
    if (!storeId) return

    const channel = supabase
      .channel('customers-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers', filter: `store_id=eq.${storeId}` },
        () => fetchCustomers(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'points', filter: `store_id=eq.${storeId}` },
        () => fetchCustomers(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations', filter: `store_id=eq.${storeId}` },
        () => fetchCustomers(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [storeId])

  useEffect(() => {
    const customerId = searchParams.get('customer_id')
    if (customerId && customers.length > 0) {
      const target = customers.find((c) => c.line_user_id === customerId || c.id === customerId)
      if (target) {
        setSearchParams({}, { replace: true })
        navigate(`/customers/${target.id}`)
      }
    }
  }, [customers, searchParams, navigate, setSearchParams])

  useEffect(() => {
    if (!searchQuery) {
      setFilteredCustomers(customers)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredCustomers(
        customers.filter(
          (c) =>
            c.display_name?.toLowerCase().includes(query) ||
            c.real_name?.toLowerCase().includes(query) ||
            c.furigana?.toLowerCase().includes(query),
        ),
      )
    }
  }, [searchQuery, customers])

  const fetchCustomers = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: stores } = await supabase
        .from('stores')
        .select('id, membership_card_settings')
        .eq('owner_id', user.id)
        .limit(1)

      const store = stores?.[0]
      if (!store) return
      setStoreId(store.id)

      const { data: customersData, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('store_id', store.id)

      if (custError) throw custError
      if (!customersData) return

      const { data: pointsData, error: pointsError } = await supabase
        .from('points')
        .select('line_user_id, balance')
        .eq('store_id', store.id)

      if (pointsError) throw pointsError

      const { data: reservationsData, error: resError } = await supabase
        .from('reservations')
        .select('line_user_id, start_time')
        .eq('store_id', store.id)
        .lt('start_time', new Date().toISOString())
        .neq('status', 'cancelled')
        .order('start_time', { ascending: false })

      if (resError) throw resError

      const mergedData: CustomerData[] = customersData.map((customer) => {
        const pointRecord = pointsData?.find((p) => p.line_user_id === customer.line_user_id)
        const userReservations = reservationsData?.filter((r) => r.line_user_id === customer.line_user_id)
        const lastReservation = userReservations?.[0]
        const points = pointRecord?.balance || 0

        return {
          ...customer,
          points,
          lastVisit: lastReservation ? lastReservation.start_time : null,
          status: points >= 1000 ? 'VIP' : 'Member',
        }
      })

      mergedData.sort((a, b) => {
        if (!a.lastVisit) return 1
        if (!b.lastVisit) return -1
        return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
      })

      setCustomers(mergedData)
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const openCustomer = (customer: CustomerData) => {
    navigate(`/customers/${customer.id}`)
  }

  const handleScan = (data: string) => {
    try {
      const url = new URL(data)
      const pathMatch = url.pathname.match(/\/customers\/([^/]+)/)
      const customerId = pathMatch?.[1] ?? url.searchParams.get('customer_id')

      if (customerId) {
        const target = customers.find((c) => c.line_user_id === customerId || c.id === customerId)
        if (target) {
          setIsQRScannerOpen(false)
          openCustomer(target)
          setToast({ isVisible: true, message: '会員証を読み取りました', type: 'success' })
        } else {
          setToast({ isVisible: true, message: '該当する顧客が見つかりません', type: 'error' })
          setIsQRScannerOpen(false)
        }
      } else {
        setToast({ isVisible: true, message: '無効なQRコードです', type: 'error' })
        setIsQRScannerOpen(false)
      }
    } catch (e) {
      console.error('QR Parse Error:', e)
      setToast({ isVisible: true, message: 'QRコードの読み取りに失敗しました', type: 'error' })
      setIsQRScannerOpen(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, isVisible: false }))}
      />

      <div className="shrink-0 z-20 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-200 w-full">
        <div className="px-4 sm:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">顧客一覧</h1>
              <p className="text-sm text-gray-500">
                顧客を選択すると詳細ページで施術メモ・LINEメッセージを管理できます。
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <div className="relative w-64 hidden sm:block">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="名前で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => setIsQRScannerOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-sm whitespace-nowrap"
              >
                <QrCode className="w-4 h-4" />
                <span className="text-sm font-bold">会員証読取</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="w-full">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      本名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      LINE名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ポイント残高
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      最終来店日
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ステータス
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        {searchQuery ? '該当する顧客が見つかりません' : '顧客データがありません'}
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="hover:bg-gray-50 cursor-pointer transition"
                        onClick={() => openCustomer(customer)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {customer.profile_picture_url ? (
                              <img
                                src={customer.profile_picture_url}
                                alt=""
                                className="h-8 w-8 rounded-full mr-3 object-cover"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                                <User className="h-4 w-4 text-gray-500" />
                              </div>
                            )}
                            <div>
                              <span className="text-sm font-medium text-gray-900">
                                {formatCustomerLabel(customer)}
                              </span>
                              {customer.real_name?.trim() && customer.furigana && (
                                <div className="text-xs text-gray-400">{customer.furigana}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.real_name?.trim() && customer.display_name ? (
                            <div>
                              <div className="text-gray-900">{customer.display_name}</div>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {customer.points.toLocaleString()} pt
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.lastVisit
                            ? new Date(customer.lastVisit).toLocaleDateString('ja-JP')
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              customer.status === 'VIP'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-primary-100 text-primary-800'
                            }`}
                          >
                            {customer.status === 'VIP' ? 'VIP' : '会員'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-400">
                          <ChevronRight className="w-5 h-5 inline-block" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onScan={handleScan}
      />
    </div>
  )
}
