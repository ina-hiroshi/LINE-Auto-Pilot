import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, Check, Shield } from 'lucide-react'
import Toast from '../components/Toast'

const PRO_PRICE_ID = import.meta.env.VITE_STRIPE_PRO_PRICE_ID || 'price_1SmKVC7JLpsQAtFkOSirIftK' 

export default function PlanSettings() {
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [subscription, setSubscription] = useState<{
    status: string
    current_period_end: string | null
    price_id: string | null
  } | null>(null)
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success'
  })

  useEffect(() => {
    fetchSubscription()
  }, [])

  const fetchSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_status, current_period_end, price_id')
        .eq('id', user.id)
        .single()

      if (error) throw error
      
      if (data) {
        setSubscription({
          status: data.subscription_status || 'inactive',
          current_period_end: data.current_period_end,
          price_id: data.price_id
        })
      }
    } catch (error) {
      console.error('Error fetching subscription:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async () => {
    setProcessing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price_id: PRO_PRICE_ID,
          return_url: window.location.href,
        }),
      })

      const { url, error } = await response.json()
      if (error) throw new Error(error)
      if (url) window.location.href = url
    } catch (error) {
      console.error('Error creating checkout session:', error)
      setToast({ isVisible: true, message: '決済セッションの作成に失敗しました。', type: 'error' })
    } finally {
      setProcessing(false)
    }
  }

  const handleManageSubscription = async () => {
    setProcessing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          return_url: window.location.href,
        }),
      })

      const { url, error } = await response.json()
      if (error) throw new Error(error)
      if (url) window.location.href = url
    } catch (error) {
      console.error('Error creating portal session:', error)
      setToast({ isVisible: true, message: 'ポータルセッションの作成に失敗しました。', type: 'error' })
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const isPro = subscription?.status === 'active' || subscription?.status === 'trialing'

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">プラン設定</h1>
        <p className="text-gray-500 mt-2">ご利用プランの確認と変更ができます。</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Free Plan */}
        <div className={`relative p-6 rounded-2xl border-2 ${!isPro ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
          {!isPro && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
              現在のプラン
            </div>
          )}
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">フリープラン</h3>
            <div className="mt-4 text-3xl font-bold text-gray-900">¥0<span className="text-base font-normal text-gray-500">/月</span></div>
          </div>
          <ul className="space-y-3 mb-8">
            <li className="flex items-center text-gray-600">
              <Check className="w-5 h-5 text-green-500 mr-2" />
              基本的な予約管理
            </li>
            <li className="flex items-center text-gray-600">
              <Check className="w-5 h-5 text-green-500 mr-2" />
              LINE連携 (基本機能)
            </li>
            <li className="flex items-center text-gray-600">
              <Check className="w-5 h-5 text-green-500 mr-2" />
              顧客管理 (100名まで)
            </li>
          </ul>
        </div>

        {/* Pro Plan */}
        <div className={`relative p-6 rounded-2xl border-2 ${isPro ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
          {isPro && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
              現在のプラン
            </div>
          )}
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">プロプラン</h3>
            <div className="mt-4 text-3xl font-bold text-gray-900">¥9,800<span className="text-base font-normal text-gray-500">/月</span></div>
          </div>
          <ul className="space-y-3 mb-8">
            <li className="flex items-center text-gray-600">
              <Check className="w-5 h-5 text-green-500 mr-2" />
              全ての予約機能
            </li>
            <li className="flex items-center text-gray-600">
              <Check className="w-5 h-5 text-green-500 mr-2" />
              AIチャットボット (無制限)
            </li>
            <li className="flex items-center text-gray-600">
              <Check className="w-5 h-5 text-green-500 mr-2" />
              顧客管理 (無制限)
            </li>
            <li className="flex items-center text-gray-600">
              <Check className="w-5 h-5 text-green-500 mr-2" />
              リッチメニューカスタマイズ
            </li>
          </ul>
          
          {isPro ? (
            <button
              onClick={handleManageSubscription}
              disabled={processing}
              className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center disabled:opacity-50"
            >
              {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : '契約内容の確認・変更'}
            </button>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={processing}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 shadow-lg shadow-blue-200"
            >
              {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'プロプランにアップグレード'}
            </button>
          )}
        </div>
      </div>

      {isPro && subscription?.current_period_end && (
        <div className="bg-gray-50 rounded-lg p-4 flex items-start space-x-3">
          <Shield className="w-5 h-5 text-gray-400 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-gray-900">サブスクリプション情報</h4>
            <p className="text-sm text-gray-500 mt-1">
              次回更新日: {new Date(subscription.current_period_end).toLocaleDateString('ja-JP')}
            </p>
          </div>
        </div>
      )}
      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  )
}
