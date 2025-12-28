import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, User, Search, Edit2, Save, History, MessageSquare, ChevronRight, Gift, CreditCard } from 'lucide-react'
import Modal from '../components/Modal'
import Toast from '../components/Toast'

type Customer = {
  id: string
  line_user_id: string
  display_name: string | null
  profile_picture_url: string | null
  real_name: string | null
  furigana: string | null
  notes: string | null
}

type CustomerData = Customer & {
  points: number
  lastVisit: string | null
  status: 'Member' | 'VIP'
}

type ReservationHistory = {
  id: string
  start_time: string
  menu_name: string | null
  staff_name: string | null
  status: string
}

export default function Customers() {
  const [customers, setCustomers] = useState<CustomerData[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [storeId, setStoreId] = useState<string | null>(null)

  // Modal State
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    real_name: '',
    furigana: '',
    notes: ''
  })
  const [pointOperation, setPointOperation] = useState<{ amount: string, type: 'add' | 'use' }>({ amount: '', type: 'add' })
  const [reservationHistory, setReservationHistory] = useState<ReservationHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Toast State
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success'
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  // Realtime Subscription (depends on storeId)
  useEffect(() => {
    if (!storeId) return

    const channel = supabase
      .channel('customers-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers', filter: `store_id=eq.${storeId}` },
        () => fetchCustomers()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'points', filter: `store_id=eq.${storeId}` },
        () => fetchCustomers()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations', filter: `store_id=eq.${storeId}` },
        () => fetchCustomers()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [storeId])

  useEffect(() => {
    if (!searchQuery) {
      setFilteredCustomers(customers)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = customers.filter(c => 
        (c.display_name?.toLowerCase().includes(query)) ||
        (c.real_name?.toLowerCase().includes(query)) ||
        (c.furigana?.toLowerCase().includes(query))
      )
      setFilteredCustomers(filtered)
    }
  }, [searchQuery, customers])

  const fetchCustomers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get Store ID
      const { data: stores } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
      
      const storeId = stores?.[0]?.id
      if (!storeId) return
      setStoreId(storeId)

      // 1. Fetch Customers
      const { data: customersData, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('store_id', storeId)

      if (custError) throw custError
      if (!customersData) return

      // 2. Fetch Points
      const { data: pointsData, error: pointsError } = await supabase
        .from('points')
        .select('line_user_id, balance')
        .eq('store_id', storeId)

      if (pointsError) throw pointsError

      // 3. Fetch Last Visit (Last completed reservation)
      const { data: reservationsData, error: resError } = await supabase
        .from('reservations')
        .select('line_user_id, start_time')
        .eq('store_id', storeId)
        .lt('start_time', new Date().toISOString()) // Past reservations
        .neq('status', 'cancelled')
        .order('start_time', { ascending: false })

      if (resError) throw resError

      // Merge Data
      const mergedData: CustomerData[] = customersData.map(customer => {
        const pointRecord = pointsData?.find(p => p.line_user_id === customer.line_user_id)
        // Find the latest reservation for this user
        const userReservations = reservationsData?.filter(r => r.line_user_id === customer.line_user_id)
        const lastReservation = userReservations?.[0]
        
        const points = pointRecord?.balance || 0
        
        // Determine status based on points (Example logic)
        const status = points >= 1000 ? 'VIP' : 'Member'

        return {
          ...customer,
          points,
          lastVisit: lastReservation ? lastReservation.start_time : null,
          status
        }
      })

      // Sort by last visit desc
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

  const fetchHistory = async (lineUserId: string) => {
    if (!storeId) return
    setHistoryLoading(true)
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, start_time, status, menu:booking_menus(name), staff:staff_members(name)')
        .eq('store_id', storeId)
        .eq('line_user_id', lineUserId)
        .order('start_time', { ascending: false })
        .limit(5)

      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const history: ReservationHistory[] = data.map((r: any) => ({
        id: r.id,
        start_time: r.start_time,
        status: r.status,
        menu_name: r.menu?.name || null,
        staff_name: r.staff?.name || null
      }))
      setReservationHistory(history)
    } catch (error) {
      console.error('Error fetching history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleCustomerClick = (customer: CustomerData) => {
    setSelectedCustomer(customer)
    setEditForm({
      real_name: customer.real_name || '',
      furigana: customer.furigana || '',
      notes: customer.notes || ''
    })
    setPointOperation({ amount: '', type: 'add' })
    setIsModalOpen(true)
    fetchHistory(customer.line_user_id)
  }

  const handleSaveCustomer = async () => {
    if (!selectedCustomer || !storeId) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          real_name: editForm.real_name || null,
          furigana: editForm.furigana || null,
          notes: editForm.notes || null
        })
        .eq('id', selectedCustomer.id)

      if (error) throw error

      setToast({ isVisible: true, message: '顧客情報を保存しました', type: 'success' })
      fetchCustomers() // Refresh list
      // Update selected customer local state to reflect changes immediately in modal if needed
      setSelectedCustomer(prev => prev ? ({ ...prev, ...editForm }) : null)
    } catch (error) {
      console.error('Save Error:', error)
      setToast({ isVisible: true, message: '保存に失敗しました', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePoints = async () => {
    if (!selectedCustomer || !storeId || !pointOperation.amount) return
    const amount = parseInt(pointOperation.amount, 10)
    if (isNaN(amount) || amount <= 0) return

    setSaving(true)
    try {
      const currentPoints = selectedCustomer.points
      const newBalance = pointOperation.type === 'add' 
        ? currentPoints + amount 
        : Math.max(0, currentPoints - amount)

      // Upsert points table
      const { error } = await supabase
        .from('points')
        .upsert({
          store_id: storeId,
          line_user_id: selectedCustomer.line_user_id,
          balance: newBalance,
          updated_at: new Date().toISOString()
        }, { onConflict: 'store_id, line_user_id' })

      if (error) throw error

      setToast({ isVisible: true, message: 'ポイントを更新しました', type: 'success' })
      fetchCustomers()
      setSelectedCustomer(prev => prev ? ({ ...prev, points: newBalance }) : null)
      setPointOperation({ amount: '', type: 'add' })
    } catch (error) {
      console.error('Point Update Error:', error)
      setToast({ isVisible: true, message: 'ポイント更新に失敗しました', type: 'error' })
    } finally {
      setSaving(false)
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
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">顧客一覧</h1>
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            placeholder="名前で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LINE名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">本名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ポイント残高</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最終来店日</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    {searchQuery ? '該当する顧客が見つかりません' : '顧客データがありません'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr 
                    key={customer.id} 
                    className="hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => handleCustomerClick(customer)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {customer.profile_picture_url ? (
                          <img src={customer.profile_picture_url} alt="" className="h-8 w-8 rounded-full mr-3 object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                            <User className="h-4 w-4 text-gray-500" />
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-900">{customer.display_name || 'ゲスト'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.real_name ? (
                        <div>
                          <div className="text-gray-900">{customer.real_name}</div>
                          <div className="text-xs text-gray-400">{customer.furigana}</div>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {customer.points.toLocaleString()} pt
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString('ja-JP') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        customer.status === 'VIP' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-primary-100 text-primary-800'
                      }`}>
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

      {/* Customer Detail Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="顧客詳細"
        footerContent={
          <div className="flex justify-end gap-3 w-full">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              閉じる
            </button>
            <button
              onClick={handleSaveCustomer}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              保存
            </button>
          </div>
        }
      >
        {selectedCustomer && (
          <div className="space-y-8">
            {/* Header Info */}
            <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
              <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden shrink-0">
                {selectedCustomer.profile_picture_url ? (
                  <img src={selectedCustomer.profile_picture_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200">
                    <User className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedCustomer.display_name || 'ゲスト'}</h3>
                <p className="text-sm text-gray-500">LINE ID: {selectedCustomer.line_user_id}</p>
                <div className="mt-1 flex gap-2">
                   <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        selectedCustomer.status === 'VIP' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-primary-100 text-primary-800'
                      }`}>
                        {selectedCustomer.status === 'VIP' ? 'VIP' : '会員'}
                   </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-8">
              {/* Basic Info & Notes */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-primary-500" />
                    基本情報
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">本名</label>
                      <input
                        type="text"
                        value={editForm.real_name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, real_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                        placeholder="山田 太郎"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">フリガナ</label>
                      <input
                        type="text"
                        value={editForm.furigana}
                        onChange={(e) => setEditForm(prev => ({ ...prev, furigana: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                        placeholder="ヤマダ タロウ"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary-500" />
                    店舗用メモ
                  </h4>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                    placeholder="特記事項や好みなどを入力..."
                  />
                </div>
              </div>

              {/* Points & History */}
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <h4 className="text-sm font-bold text-gray-900 mb-3">ポイント管理</h4>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-3xl font-bold text-primary-600">{selectedCustomer.points.toLocaleString()}</span>
                    <span className="text-sm text-gray-500">pt</span>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Operation Type Tabs */}
                    <div className="flex p-1 bg-gray-200 rounded-lg">
                      <button
                        onClick={() => setPointOperation(prev => ({ ...prev, type: 'add' }))}
                        className={`flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${
                          pointOperation.type === 'add' 
                            ? 'bg-white text-primary-700 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Gift className="w-4 h-4" />
                        付与する
                      </button>
                      <button
                        onClick={() => setPointOperation(prev => ({ ...prev, type: 'use' }))}
                        className={`flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${
                          pointOperation.type === 'use' 
                            ? 'bg-white text-red-600 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <CreditCard className="w-4 h-4" />
                        利用する
                      </button>
                    </div>

                    {/* Input Area */}
                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                      <label className="block text-xs font-medium text-gray-500 mb-2">
                        {pointOperation.type === 'add' ? '付与するポイント数' : '利用するポイント数'}
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            value={pointOperation.amount}
                            onChange={(e) => setPointOperation(prev => ({ ...prev, amount: e.target.value }))}
                            className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                            placeholder="0"
                            min="1"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-gray-400">pt</span>
                        </div>
                        <button
                          onClick={handleUpdatePoints}
                          disabled={!pointOperation.amount || saving}
                          className={`px-4 py-2 rounded-md text-white text-sm font-bold shadow-sm transition-colors ${
                            pointOperation.type === 'add' 
                              ? 'bg-primary-600 hover:bg-primary-700' 
                              : 'bg-red-500 hover:bg-red-600'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          実行
                        </button>
                      </div>
                      <p className="mt-2 text-[10px] text-gray-400">
                        {pointOperation.type === 'add' 
                          ? '※ 来店時やキャンペーン等でポイントを付与します' 
                          : '※ 特典交換などでポイントを消費します'}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <History className="w-4 h-4 text-gray-400" />
                    最近の来店履歴
                  </h4>
                  <div className="space-y-2">
                    {historyLoading ? (
                      <div className="text-center py-4 text-gray-400 text-xs">読み込み中...</div>
                    ) : reservationHistory.length === 0 ? (
                      <div className="text-center py-4 text-gray-400 text-xs bg-gray-50 rounded-lg">履歴はありません</div>
                    ) : (
                      reservationHistory.map(h => (
                        <div key={h.id} className="text-xs p-2 bg-white border border-gray-100 rounded hover:bg-gray-50">
                          <div className="flex justify-between mb-1">
                            <span className="font-bold text-gray-700">
                              {new Date(h.start_time).toLocaleDateString('ja-JP')}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              h.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {h.status === 'cancelled' ? 'キャンセル' : '来店'}
                            </span>
                          </div>
                          <div className="text-gray-500 truncate">
                            {h.menu_name || 'メニュー未定'} {h.staff_name && `(${h.staff_name})`}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
