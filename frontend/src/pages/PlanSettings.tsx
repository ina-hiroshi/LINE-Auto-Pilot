import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, Check, Shield, AlertTriangle } from 'lucide-react'
import Toast from '../components/Toast'
import Modal from '../components/Modal'
import { PRO_PRICE_ID } from '../constants/stripe' 

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
  const [email, setEmail] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchSubscription()
  }, [])

  const fetchSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email ?? '')

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

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('セッションが切れています。再度ログインしてください。')

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmation: deleteConfirmation.trim() }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || 'アカウントの削除に失敗しました。')

      // 削除済みのセッションを残さないよう、ローカルを消してからトップへ戻す
      localStorage.clear()
      sessionStorage.clear()
      try {
        await supabase.auth.signOut()
      } catch (signOutError) {
        console.error('Sign out error (ignored):', signOutError)
      }
      window.location.href = '/'
    } catch (error) {
      console.error('Error deleting account:', error)
      setToast({
        isVisible: true,
        message: error instanceof Error ? error.message : 'アカウントの削除に失敗しました。',
        type: 'error'
      })
      setDeleting(false)
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
              基本的な予約・売上管理
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
              全ての予約・売上機能（期間分析・CSV）
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
      {/* アカウント削除 */}
      <div className="border-2 border-red-200 bg-red-50 rounded-2xl p-6">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-red-900">アカウントの削除</h2>
            <p className="text-sm text-red-800 mt-2">
              アカウントと店舗のデータをすべて削除します。<strong className="font-bold">この操作は取り消せません。</strong>
            </p>
            <ul className="mt-3 space-y-1 text-sm text-red-800 list-disc list-inside">
              <li>予約・顧客・ポイント・自動応答・AIの学習データ</li>
              <li>LINE公式アカウントおよびGoogleカレンダーとの連携</li>
              <li>ご契約中のプラン（無料お試し期間中のものを含め、その場で解約されます）</li>
            </ul>
            <p className="text-xs text-red-700 mt-3">
              解約にともなう日割りでの返金は行っておりません。法令にもとづき、お支払いいただいた請求・領収の記録のみ保持します。
            </p>
            <button
              onClick={() => {
                setDeleteConfirmation('')
                setShowDeleteModal(true)
              }}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              アカウントを削除する
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        title="本当にアカウントを削除しますか？"
        variant="danger"
        confirmText="完全に削除する"
        cancelText="キャンセル"
        isLoading={deleting}
        confirmDisabled={!email || deleteConfirmation.trim().toLowerCase() !== email.toLowerCase()}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            削除するとすべてのデータが失われ、元に戻すことはできません。
            ご契約中のプランは無料お試し期間中のものも含めてその場で解約されます。
          </p>
          <div>
            <label htmlFor="delete-confirmation" className="block text-sm font-medium text-gray-700 mb-1">
              確認のため、ご登録のメールアドレス（<span className="font-mono">{email}</span>）を入力してください
            </label>
            <input
              id="delete-confirmation"
              type="email"
              autoComplete="off"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              disabled={deleting}
              placeholder={email}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
            />
          </div>
        </div>
      </Modal>

      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  )
}
