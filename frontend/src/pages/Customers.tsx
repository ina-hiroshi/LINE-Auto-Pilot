import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, User } from 'lucide-react'

type Customer = {
  id: string
  line_user_id: string
  display_name: string | null
  profile_picture_url: string | null
  real_name: string | null
  furigana: string | null
}

type CustomerData = Customer & {
  points: number
  lastVisit: string | null
  status: 'Member' | 'VIP'
}

export default function Customers() {
  const [customers, setCustomers] = useState<CustomerData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCustomers()
  }, [])

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
      // Note: Assuming 'completed' status exists, or just taking the last past reservation
      const { data: reservationsData, error: resError } = await supabase
        .from('reservations')
        .select('line_user_id, start_time')
        .eq('store_id', storeId)
        .lt('start_time', new Date().toISOString()) // Past reservations
        .order('start_time', { ascending: false })

      if (resError) throw resError

      // Merge Data
      const mergedData: CustomerData[] = customersData.map(customer => {
        const pointRecord = pointsData?.find(p => p.line_user_id === customer.line_user_id)
        const lastReservation = reservationsData?.find(r => r.line_user_id === customer.line_user_id)
        
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

      setCustomers(mergedData)
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
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
      <h1 className="text-2xl font-bold mb-8 text-gray-900">顧客一覧</h1>
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
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    顧客データがありません
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {customer.profile_picture_url ? (
                          <img src={customer.profile_picture_url} alt="" className="h-8 w-8 rounded-full mr-3" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                            <User className="h-4 w-4 text-gray-500" />
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-900">{customer.display_name || 'ゲスト'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.real_name || '-'}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
