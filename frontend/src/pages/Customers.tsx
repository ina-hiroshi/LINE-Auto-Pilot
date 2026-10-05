import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2, User, Search, ChevronRight, QrCode, Send } from 'lucide-react'
import Toast from '../components/Toast'
import QRScannerModal from '../components/QRScannerModal'
import { formatCustomerLabel } from '../features/customers/lib/customerDisplayName'
import type { CustomerData } from '../features/customers/types'
import TutorialButton from '../features/tutorial/TutorialButton'
import { usePageTutorial } from '../features/tutorial/usePageTutorial'

export type { CustomerData }

export default function Customers() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [customers, setCustomers] = useState<CustomerData[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [storeId, setStoreId] = useState<string | null>(null)
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const tutorial = usePageTutorial('customers', { ready: !loading })

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

  // 一覧に出ていない顧客を選択したまま配信すると、画面で確認できない相手に
  // メッセージが飛ぶ。絞り込みや再取得で消えた行の選択は落とす。
  useEffect(() => {
    setSelectedIds((current) => {
      if (current.size === 0) return current
      const visibleIds = new Set(filteredCustomers.map((c) => c.id))
      const next = new Set([...current].filter((id) => visibleIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [filteredCustomers])

  const toggleSelection = (customerId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(customerId)) {
        next.delete(customerId)
      } else {
        next.add(customerId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds((current) =>
      current.size === filteredCustomers.length
        ? new Set()
        : new Set(filteredCustomers.map((c) => c.id)),
    )
  }

  const sendToSelected = () => {
    navigate('/message-campaigns', {
      state: { presetSegment: 'manual', customerIds: [...selectedIds] },
    })
  }

  const fetchCustomers = async () => {
    setLoadError(null)
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
      if (!store) {
        setLoadError('店舗が見つかりません。先に店舗情報を登録してください。')
        return
      }
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
      // 握り潰すと「顧客が0件」と見分けがつかなくなるので、必ず画面に出す
      console.error('Error fetching customers:', error)
      setLoadError('顧客情報の取得に失敗しました。時間をおいて再度お試しください。')
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
          {/* スマホでは検索と読取ボタンを見出しの下の行に回す（横に並べると見出しが1文字ずつ折り返す） */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1 basis-40">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 whitespace-nowrap">顧客一覧</h1>
              <p className="text-sm text-gray-500">
                顧客を選択すると詳細ページで施術メモ・LINEメッセージを管理できます。
              </p>
            </div>
            <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
              <TutorialButton tutorial={tutorial} />
              <div data-tour="customers.search" className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
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
                data-tour="customers.qr"
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-sm whitespace-nowrap"
              >
                <QrCode className="w-4 h-4" />
                <span className="text-sm font-bold"><span className="hidden sm:inline">会員証</span>読取</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="w-full">
          {/* スマホ: 表は横に収まらないので、1人1枚のカードで並べる */}
          {/* エラーと空の表示は、スマホ・PCで共通の1か所にする */}
          {loadError || filteredCustomers.length === 0 ? (
            <div data-tour="customers.table" className="bg-white rounded-lg shadow px-4 py-6 text-center text-sm">
              {loadError ? (
                <p className="text-red-600">{loadError}</p>
              ) : (
                <p className="text-gray-500">
                  {searchQuery ? '該当する顧客が見つかりません' : '顧客データがありません'}
                  {!searchQuery && (
                    <span className="block mt-1 text-xs text-gray-400">
                      LINEの予約ページから予約したお客様が、ここに表示されます。
                    </span>
                  )}
                </p>
              )}
            </div>
          ) : (
          <>
          <div className="md:hidden bg-white rounded-lg shadow overflow-hidden">
              <>
                <label
                  data-tour="customers.select-all"
                  className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500"
                >
                  <input
                    type="checkbox"
                    checked={filteredCustomers.length > 0 && selectedIds.size === filteredCustomers.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  すべて選択（{filteredCustomers.length}名）
                </label>
                <ul className="divide-y divide-gray-100">
                  {filteredCustomers.map((customer, index) => (
                    <li
                      key={customer.id}
                      data-tour={index === 0 ? 'customers.table' : undefined}
                      className="flex items-center gap-3 px-4 py-3 active:bg-gray-50"
                      onClick={() => openCustomer(customer)}
                    >
                      <input
                        type="checkbox"
                        aria-label={`${formatCustomerLabel(customer)}を選択`}
                        checked={selectedIds.has(customer.id)}
                        onChange={() => toggleSelection(customer.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      {customer.profile_picture_url ? (
                        <img src={customer.profile_picture_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200">
                          <User className="h-5 w-5 text-gray-500" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold text-gray-900">{formatCustomerLabel(customer)}</span>
                          <span
                            className={`shrink-0 rounded-full px-2 text-[11px] font-semibold leading-5 ${
                              customer.status === 'VIP' ? 'bg-yellow-100 text-yellow-800' : 'bg-primary-100 text-primary-800'
                            }`}
                          >
                            {customer.status === 'VIP' ? 'VIP' : '会員'}
                          </span>
                        </div>
                        {customer.real_name?.trim() && (customer.furigana || customer.display_name) && (
                          <div className="truncate text-xs text-gray-400">
                            {[customer.furigana, customer.display_name && `LINE: ${customer.display_name}`].filter(Boolean).join('　')}
                          </div>
                        )}
                        <div className="mt-0.5 flex gap-3 text-xs text-gray-500">
                          <span>{customer.points.toLocaleString()} pt</span>
                          <span>
                            最終来店 {customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString('ja-JP') : '-'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
                    </li>
                  ))}
                </ul>
              </>
          </div>

          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th data-tour="customers.select-all" className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="すべて選択"
                        checked={
                          filteredCustomers.length > 0 &&
                          selectedIds.size === filteredCustomers.length
                        }
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </th>
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
                  {filteredCustomers.map((customer, index) => (
                      <tr
                        key={customer.id}
                        // 画面ツアーで光らせるのは先頭の1行だけ
                        data-tour={index === 0 ? 'customers.table' : undefined}
                        className="hover:bg-gray-50 cursor-pointer transition"
                        onClick={() => openCustomer(customer)}
                      >
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`${formatCustomerLabel(customer)}を選択`}
                            checked={selectedIds.has(customer.id)}
                            onChange={() => toggleSelection(customer.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                        </td>
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
                    ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
          )}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="shrink-0 border-t border-gray-200 bg-white px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="text-sm text-gray-700">
            <span className="font-bold">{selectedIds.size}名</span>を選択中
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition"
            >
              選択を解除
            </button>
            <button
              type="button"
              onClick={sendToSelected}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-bold"
            >
              <Send className="w-4 h-4" />
              選択した方に配信
            </button>
          </div>
        </div>
      )}

      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onScan={handleScan}
      />
    </div>
  )
}
