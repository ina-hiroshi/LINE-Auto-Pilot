import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Loader2, Check, Shield } from 'lucide-react'
import Toast from '../../../components/Toast'

const PRO_PRICE_ID = import.meta.env.VITE_STRIPE_PRO_PRICE_ID || 'price_1SkA8F9gqo1AslYsV0rVvBzF' 

export function PlanTab() {
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [subscription, setSubscription] = useState<{
    plan: string
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
        .select('plan, current_period_end, price_id')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setSubscription(data)
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

  const isPro = subscription?.plan === 'pro'

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium text-gray-900">料金プラン</h2>
        <p className="text-sm text-gray-500 mt-1">ビジネスの成長に合わせて最適なプランをお選びください。</p>
      </div>

      {isPro && subscription?.current_period_end && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start space-x-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-blue-900">Proプランをご利用中</h4>
            <p className="text-sm text-blue-700 mt-1">
              次回更新日: {new Date(subscription.current_period_end).toLocaleDateString('ja-JP')}
            </p>
            <button
              onClick={handleManageSubscription}
              disabled={processing}
              className="mt-3 text-sm font-medium text-blue-700 hover:text-blue-800 underline disabled:opacity-50"
            >
              {processing ? '読み込み中...' : '契約内容の確認・変更'}
            </button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Free Plan */}
        <div className={`bg-white p-6 rounded-2xl shadow-sm border ${!isPro ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200'} flex flex-col`}>
          <div className="mb-4">
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-wider">Starter</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Free</h3>
          <div className="flex items-baseline mb-6">
            <span className="text-3xl font-bold text-slate-900">¥0</span>
            <span className="text-slate-500 ml-2">/月</span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            {[
              '予約管理（無制限）',
              '固定応答 10件',
              'ポイントカード基本機能',
              '※一部機能制限あり'
            ].map((item, i) => (
              <li key={i} className="flex items-center text-sm text-slate-600">
                <Check className="w-4 h-4 text-primary-500 mr-3 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          {!isPro ? (
            <div className="w-full py-2 px-4 text-center bg-slate-100 text-slate-500 rounded-lg font-bold text-sm cursor-default">
              現在のプラン
            </div>
          ) : (
            <button
              onClick={handleManageSubscription}
              disabled={processing}
              className="w-full py-2 px-4 text-center bg-white border border-slate-300 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition text-sm flex items-center justify-center"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Freeプランにダウングレード'}
            </button>
          )}
        </div>

        {/* Pro Plan */}
        <div className={`bg-white p-6 rounded-2xl shadow-xl border-2 ${isPro ? 'border-blue-500' : 'border-primary-500'} relative flex flex-col transform md:-translate-y-2`}>
          <div className="absolute top-0 right-0 bg-primary-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl rounded-tr-xl">
            おすすめ
          </div>
          <div className="mb-4">
            <span className="px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-xs font-bold uppercase tracking-wider">Standard</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Pro</h3>
          <div className="flex items-baseline mb-6">
            <span className="text-3xl font-bold text-slate-900">¥4,980</span>
            <span className="text-slate-500 ml-2">/月</span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            {[
              '全機能解放',
              'Googleカレンダー連携',
              'デジタル会員証（フル機能）',
              '無制限応答 & AI応答',
              '詳細分析レポート'
            ].map((item, i) => (
              <li key={i} className="flex items-center text-sm text-slate-700 font-medium">
                <Check className="w-4 h-4 text-primary-600 mr-3 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          
          {isPro ? (
            <div className="w-full py-2 px-4 text-center bg-blue-50 text-blue-600 rounded-lg font-bold text-sm">
              利用中
            </div>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={processing}
              className="w-full py-2 px-4 text-center bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition shadow-lg shadow-primary-200 text-sm flex items-center justify-center"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Proプランを選択'}
            </button>
          )}
        </div>

        {/* Executive Plan */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col opacity-75">
          <div className="mb-4">
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-wider">Coming Soon</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Executive</h3>
          <div className="flex items-baseline mb-6">
            <span className="text-2xl font-bold text-slate-900">¥19,800〜</span>
            <span className="text-slate-500 ml-2">/月</span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            {[
              '複数店舗管理',
              'ホワイトラベル',
              '個別相談・コンサル',
              '独自開発の依頼権'
            ].map((item, i) => (
              <li key={i} className="flex items-center text-sm text-slate-600">
                <Check className="w-4 h-4 text-primary-500 mr-3 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <button disabled className="w-full py-2 px-4 text-center bg-slate-100 text-slate-400 rounded-lg font-bold text-sm cursor-not-allowed">
            準備中
          </button>
        </div>
      </div>
      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  )
}
