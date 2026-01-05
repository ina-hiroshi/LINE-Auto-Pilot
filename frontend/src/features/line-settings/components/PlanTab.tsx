import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Loader2, Check, Shield, Gift, AlertTriangle } from 'lucide-react'
import Toast from '../../../components/Toast'

// プレリリースモード切り替えフラグ
// true: プレリリースモニター募集中（2ヶ月無料、サポートなし）
// false: 正式リリース（リリース記念キャンペーン）
const IS_PRE_RELEASE_MODE = true

const PRO_PRICE_ID = import.meta.env.VITE_STRIPE_PRO_PRICE_ID || 'price_1SmKVC7JLpsQAtFkOSirIftK' 

export function PlanTab() {
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [subscription, setSubscription] = useState<{
    plan: string
    current_period_end: string | null
    price_id: string | null
    has_used_trial: boolean
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
        .select('plan, current_period_end, price_id, has_used_trial')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setSubscription({
        ...data,
        has_used_trial: data.has_used_trial || false
      })
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
  const hasUsedTrial = subscription?.has_used_trial || false

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium text-gray-900">料金プラン</h2>
        <p className="text-sm text-gray-500 mt-1">ビジネスの成長に合わせて最適なプランをお選びください。</p>
      </div>

      {/* プレリリース特典 or リリース特典バナー（トライアル未使用 & Proプラン未加入の場合のみ表示） */}
      {!isPro && !hasUsedTrial && IS_PRE_RELEASE_MODE && (
        /* プレリリースモニター特典 */
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Gift className="w-6 h-6" />
            <span className="font-bold text-lg">🎁 プレリリースモニター限定特典</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 mb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-3xl font-bold text-yellow-300 mb-1">
                  2ヶ月無料
                </div>
                <p className="text-primary-100 text-sm">
                  Proプラン（通常 ¥4,980/月）が無料で使えます
                </p>
              </div>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-yellow-300 shrink-0 mt-0.5" />
                  <span>Proプランの全機能を<span className="font-bold text-yellow-300">2ヶ月間無料</span>で利用可能</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-yellow-300 shrink-0 mt-0.5" />
                  <span>ご登録いただいた<span className="font-bold text-yellow-300">データはそのまま継続</span>利用可能</span>
                </li>
              </ul>
            </div>
          </div>
          {/* 注意事項 */}
          <div className="bg-primary-900/30 border border-primary-300/30 rounded-xl p-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-yellow-300 shrink-0 mt-0.5" />
              <div className="text-xs text-primary-100">
                <p className="font-bold text-yellow-300 mb-1">プレリリース版についてのご注意</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li>現在開発中のため、<span className="font-medium text-yellow-300">仕様が予告なく変更</span>される場合があります</li>
                  <li>一部機能に<span className="font-medium text-yellow-300">不具合</span>が発生する可能性があります</li>
                  <li>プレリリース期間中は<span className="font-medium text-yellow-300">サポート対応ができません</span></li>
                  <li>クレジットカード登録が必須です。<span className="font-medium text-yellow-300">2ヶ月後から自動更新</span>で課金されます</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 正式リリース時のリリース特典（トライアル未使用 & Proプラン未加入の場合のみ表示） */}
      {!isPro && !hasUsedTrial && !IS_PRE_RELEASE_MODE && (
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Gift className="w-6 h-6" />
            <span className="font-bold text-lg">🎉 リリース特典 - 2つのコースから選べます</span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Course 1 */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <div className="bg-white text-primary-700 text-xs font-bold px-2 py-1 rounded-full inline-block mb-2">
                すぐ使いたい方向け
              </div>
              <h4 className="text-base font-bold mb-2 text-yellow-300">スピード導入コース</h4>
              <ul className="space-y-1 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-yellow-300 shrink-0 mt-0.5" />
                  <span>初期設定代行費（¥9,980）が<span className="font-bold text-yellow-300">無料</span></span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-yellow-300 shrink-0 mt-0.5" />
                  <span>Proプラン<span className="font-bold text-yellow-300">初月無料</span></span>
                </li>
              </ul>
            </div>
            {/* Course 2 */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <div className="bg-white text-primary-700 text-xs font-bold px-2 py-1 rounded-full inline-block mb-2">
                安く使いたい方向け
              </div>
              <h4 className="text-base font-bold mb-2 text-yellow-300">じっくりお得コース</h4>
              <ul className="space-y-1 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-yellow-300 shrink-0 mt-0.5" />
                  <span>Proプランが<span className="font-bold text-yellow-300">3ヶ月間無料</span></span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-yellow-300 shrink-0 mt-0.5" />
                  <span>初期設定代行（¥9,980）を利用可能</span>
                </li>
              </ul>
            </div>
          </div>
          <p className="text-center text-primary-100 text-xs mt-4">
            ※ 特典の適用には、導入後のインタビューフォームへの回答が必要です。
          </p>
        </div>
      )}

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
          {!isPro && !hasUsedTrial && (
            <div className="mb-2">
              <span className="inline-block bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded">
                {IS_PRE_RELEASE_MODE ? '2ヶ月無料' : '初月無料'}
              </span>
            </div>
          )}
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
