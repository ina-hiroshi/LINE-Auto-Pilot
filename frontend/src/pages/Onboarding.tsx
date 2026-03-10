import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { PRO_PRICE_ID } from '../constants/stripe'
import {
  User,
  LogOut,
  MessageSquare,
  CreditCard,
  Play,
  Settings
} from 'lucide-react'
import BasicInfoStep from '../features/onboarding/components/BasicInfoStep'
import PlanSelectStep from '../features/onboarding/components/PlanSelectStep'
import LineSetupStep from '../features/onboarding/components/LineSetupStep'
import TutorialStep from '../features/onboarding/components/TutorialStep'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import SetupServiceModal, { type SetupServiceFormData } from '../components/SetupServiceModal'

// プレリリースモード切り替えフラグ
// true: プレリリースモニター募集中（2ヶ月無料、サポートなし）
// false: 正式リリース（リリース記念キャンペーン）
// デバッグ用: 一時的にfalseに変更（初期設定代行サービスのバナーを表示）
const IS_PRE_RELEASE_MODE = false

// 初期設定代行バナーのバージョン切り替え
// 'production': 正式リリース版（¥9,980の初期設定代行バナー）
// 'prerelease': プレリリース版
const envBannerVersion = import.meta.env.VITE_SETUP_BANNER_VERSION
const SETUP_BANNER_VERSION = (envBannerVersion && envBannerVersion.trim() !== '') ? envBannerVersion.trim() : 'production'

// デバッグ用: バナーバージョンの値をコンソールに出力
console.log('[Onboarding] SETUP_BANNER_VERSION:', SETUP_BANNER_VERSION)
console.log('[Onboarding] VITE_SETUP_BANNER_VERSION (env):', envBannerVersion)

interface OnboardingProps {
  onComplete: () => void
}

type OnboardingStep = 'basic_info' | 'plan_select' | 'line_setup' | 'tutorial'

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-webhook`

export default function Onboarding({ onComplete }: OnboardingProps) {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('basic_info')
  const [loading, setLoading] = useState(false)
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success',
  })
  const [progressMsg, setProgressMsg] = useState<string>('')
  const [searchingAddress, setSearchingAddress] = useState(false)
  const [kanaError, setKanaError] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // 基本情報フォームデータ
  const [formData, setFormData] = useState({
    full_name: '',
    full_name_kana: '',
    user_phone_number: '',
    store_name: '',
    postal_code: '',
    address: '',
    store_phone_number: '',
    industry: ''
  })

  // プラン選択
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'pro' | 'executive'>('pro')

  // LINE設定
  const [lineSettings, setLineSettings] = useState({
    channel_id: '',
    channel_secret: '',
    channel_token: '',
  })
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null)

  // チュートリアル
  const [tutorialIndex, setTutorialIndex] = useState(0)

  // Store ID (作成後に保持)
  const [storeId, setStoreId] = useState<string | null>(null)
  
  // プラン情報
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)
  
  // トライアル利用済みフラグ
  const [hasUsedTrial, setHasUsedTrial] = useState<boolean>(false)

  // 設定代行モーダル
  const [isSetupServiceModalOpen, setIsSetupServiceModalOpen] = useState(false)
  const [setupServiceSubmitting, setSetupServiceSubmitting] = useState(false)
  const [userEmail, setUserEmail] = useState<string>('')
  const [hasSetupServiceOrder, setHasSetupServiceOrder] = useState<boolean>(false)

  // ユーザーメールアドレスを取得
  useEffect(() => {
    const fetchUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setUserEmail(user.email)
      }
    }
    fetchUserEmail()
  }, [])

  // Stripe決済完了チェック
  useEffect(() => {
    const handleStripeReturn = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const sessionId = urlParams.get('session_id')
      const setupOrderId = urlParams.get('setup_order_id')
      
      if (sessionId) {
        console.log('Stripe payment completed, updating plan to pro')
        
        // URLからsession_idを削除
        window.history.replaceState({}, '', '/onboarding')
        
        try {
          // ユーザー情報を取得
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) throw new Error('ユーザーが見つかりません')
          
          // データベースのplanをproに更新（Webhookを待たない）
          const { error } = await supabase
            .from('profiles')
            .update({ plan: 'pro' })
            .eq('id', user.id)
          
          if (error) {
            console.error('Failed to update plan:', error)
            // エラーでも続行（Webhookが後で更新する可能性がある）
          } else {
            console.log('Plan updated to pro in database')
          }
          
          // ローカルステートも更新
          setCurrentPlan('pro')
          
          // LINE設定ステップに直接進む
          setCurrentStep('line_setup')
          
          // 成功メッセージを表示
          setToast({ isVisible: true, message: 'Proプランの決済が完了しました', type: 'success' })
        } catch (error) {
          console.error('Error updating plan:', error)
          setToast({ isVisible: true, message: 'プラン更新中にエラーが発生しました', type: 'error' })
        }
      } else if (setupOrderId) {
        console.log('Setup service payment completed, order ID:', setupOrderId)
        
        // URLからsetup_order_idを削除
        window.history.replaceState({}, '', '/onboarding')
        
        // 注文ステータスを確認
        try {
          const { data: order, error: orderError } = await supabase
            .from('setup_service_orders')
            .select('id, status, paid_at')
            .eq('id', setupOrderId)
            .single()
          
          if (orderError) {
            console.error('Error fetching order:', orderError)
          } else {
            console.log('Order status:', order.status)
            
            // ステータスが'paid'でない場合、Webhookの処理を待つ（最大5回、1秒間隔）
            if (order.status !== 'paid') {
              const maxRetries = 5
              
              const checkOrderStatus = async (retryCount: number) => {
                const { data: updatedOrder } = await supabase
                  .from('setup_service_orders')
                  .select('id, status, paid_at')
                  .eq('id', setupOrderId)
                  .single()
                
                if (updatedOrder?.status === 'paid') {
                  console.log('Order status updated to paid')
                  setHasSetupServiceOrder(true)
                  setToast({ 
                    isVisible: true, 
                    message: '設定代行サービスのお申し込みが完了しました。メールでご案内いたします。', 
                    type: 'success' 
                  })
                  setCurrentStep('tutorial')
                } else if (retryCount < maxRetries) {
                  setTimeout(() => checkOrderStatus(retryCount + 1), 1000)
                } else {
                  // リトライ上限に達した場合でも続行（Webhookが後で処理する可能性がある）
                  console.warn('Order status check timeout, proceeding anyway')
                  setHasSetupServiceOrder(true)
                  setToast({ 
                    isVisible: true, 
                    message: '設定代行サービスのお申し込みが完了しました。メールでご案内いたします。', 
                    type: 'success' 
                  })
                  setCurrentStep('tutorial')
                }
              }
              
              setTimeout(() => checkOrderStatus(1), 1000)
            } else {
              // 既に'paid'ステータスの場合
              setHasSetupServiceOrder(true)
              setToast({ 
                isVisible: true, 
                message: '設定代行サービスのお申し込みが完了しました。メールでご案内いたします。', 
                type: 'success' 
              })
              setCurrentStep('tutorial')
            }
          }
        } catch (error) {
          console.error('Error checking order status:', error)
          // エラーが発生しても続行
          setHasSetupServiceOrder(true)
          setToast({ 
            isVisible: true, 
            message: '設定代行サービスのお申し込みが完了しました。メールでご案内いたします。', 
            type: 'success' 
          })
          setCurrentStep('tutorial')
        }
      }
    }
    
    handleStripeReturn()
  }, [])

  // 初回マウント時およびreloadTrigger変更時に既存データを読み込む
  useEffect(() => {
    const loadExistingData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // プロフィール情報を取得
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, full_name_kana, phone_number, plan, has_used_trial')
          .eq('id', user.id)
          .single()

        if (profileData) {
          console.log('Profile data loaded:', profileData)
          setFormData(prev => ({
            ...prev,
            full_name: profileData.full_name || '',
            full_name_kana: profileData.full_name_kana || '',
            user_phone_number: profileData.phone_number || ''
          }))
          
          // サブスクリプション情報を保持（planのみ）
          setCurrentPlan(profileData.plan || null)
          console.log('Current plan:', profileData.plan)
          
          // トライアル利用済みフラグを設定
          setHasUsedTrial(profileData.has_used_trial || false)
          console.log('Has used trial:', profileData.has_used_trial)
        }

        // 設定代行サービスの注文状況を確認
        const { data: setupOrders } = await supabase
          .from('setup_service_orders')
          .select('id, status')
          .eq('user_id', user.id)
          .in('status', ['paid', 'in_progress', 'completed'])
          .limit(1)
        
        setHasSetupServiceOrder((setupOrders && setupOrders.length > 0) || false)

        // 店舗情報を取得
        const { data: storeData, error: storeError } = await supabase
          .from('stores')
          .select('id, name, postal_code, address, phone_number, industry')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (storeError) {
          console.error('Store fetch error:', storeError)
          console.error('Error details:', {
            message: storeError.message,
            details: storeError.details,
            hint: storeError.hint,
            code: storeError.code
          })
        }

        let hasLineAccount = false

        if (storeData) {
          console.log('Store data loaded:', storeData)
          setStoreId(storeData.id)
          setFormData(prev => ({
            ...prev,
            store_name: storeData.name || '',
            postal_code: storeData.postal_code || '',
            address: storeData.address || '',
            store_phone_number: storeData.phone_number || '',
            industry: storeData.industry || ''
          }))

          // LINE設定を取得
          const { data: lineData, error: lineError } = await supabase
            .from('line_accounts')
            .select('channel_id, channel_secret, channel_access_token')
            .eq('store_id', storeData.id)
            .maybeSingle()

          if (lineError) {
            console.error('LINE account fetch error:', lineError)
          }

          if (lineData && lineData.channel_id && lineData.channel_secret && lineData.channel_access_token) {
            hasLineAccount = true
            setLineSettings({
              channel_id: lineData.channel_id || '',
              channel_secret: lineData.channel_secret || '',
              channel_token: lineData.channel_access_token || ''
            })
          }
        } else {
          console.log('No store data found for user:', user.id)
        }

        // 店舗情報があるがLINE連携が未設定の場合、LINE設定ステップから開始
        if (storeData && !hasLineAccount) {
          console.log('Store exists but LINE not connected, starting from line_setup')
          setCurrentStep('line_setup')
        }
      } catch (error) {
        console.error('Error loading existing data:', error)
        // エラーの詳細をログに出力
        if (error instanceof Error) {
          console.error('Error message:', error.message)
          console.error('Error stack:', error.stack)
        }
      }
    }

    loadExistingData()
  }, []) // 初回マウント時のみ実行

  const handleLogout = async () => {
    localStorage.clear()
    sessionStorage.clear()
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Logout error (ignored):', error)
    }
    window.location.href = '/'
  }

  const handleKanaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData({ ...formData, full_name_kana: value })
    const isInvalid = value !== '' && !/^[\u30A1-\u30F6\u30FC\u3000\s]+$/.test(value)
    setKanaError(isInvalid)
  }

  const handlePostalCodeSearch = async () => {
    if (!formData.postal_code || formData.postal_code.length < 7) return
    setSearchingAddress(true)
    try {
      const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${formData.postal_code}`)
      const data = await response.json()
      if (data.results) {
        const result = data.results[0]
        const fullAddress = `${result.address1}${result.address2}${result.address3}`
        setFormData(prev => ({ ...prev, address: fullAddress }))
        setToast({ isVisible: true, message: '住所を入力しました', type: 'success' })
      } else {
        setToast({ isVisible: true, message: '住所が見つかりませんでした', type: 'error' })
      }
    } catch (error) {
      console.error('Address search error:', error)
      setToast({ isVisible: true, message: '住所検索中にエラーが発生しました', type: 'error' })
    } finally {
      setSearchingAddress(false)
    }
  }

  // 基本情報の保存（Step 1完了時）
  const handleSaveBasicInfo = async () => {
    if (kanaError) {
      setToast({ isVisible: true, message: 'フリガナを全角カタカナで入力してください', type: 'error' })
      return
    }
    
    setLoading(true)
    setProgressMsg('情報を保存中...')

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) throw new Error(`認証エラー: ${authError.message}`)
      if (!user) throw new Error('ユーザーが見つかりません。再度ログインしてください。')

      // Profile更新
      setProgressMsg('プロフィールを更新中...')
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: formData.full_name,
          full_name_kana: formData.full_name_kana,
          phone_number: formData.user_phone_number
        })
      if (profileError) throw new Error(`プロフィールの更新に失敗しました: ${profileError.message}`)

      // Store作成または更新
      setProgressMsg('店舗情報を保存中...')
      
      if (storeId) {
        // 既存店舗を更新
        const { error: storeError } = await supabase
          .from('stores')
          .update({
            name: formData.store_name,
            postal_code: formData.postal_code,
            address: formData.address,
            phone_number: formData.store_phone_number,
            industry: formData.industry
          })
          .eq('id', storeId)
        
        if (storeError) throw new Error(`店舗情報の更新に失敗しました: ${storeError.message}`)
      } else {
        // 新規店舗を作成
        const { data: newStore, error: storeError } = await supabase
          .from('stores')
          .insert([{
            owner_id: user.id,
            name: formData.store_name,
            postal_code: formData.postal_code,
            address: formData.address,
            phone_number: formData.store_phone_number,
            industry: formData.industry
          }])
          .select()
          .single()
        
        if (storeError) throw new Error(`店舗情報の保存に失敗しました: ${storeError.message}`)
        setStoreId(newStore.id)
      }
      
      setToast({ isVisible: true, message: '基本情報を保存しました', type: 'success' })
      setCurrentStep('plan_select')
    } catch (error: unknown) {
      console.error('Setup error:', error)
      const message = error instanceof Error ? error.message : '予期せぬエラーが発生しました'
      setToast({ isVisible: true, message, type: 'error' })
    } finally {
      setLoading(false)
      setProgressMsg('')
    }
  }

  // プラン選択完了
  const handlePlanSelect = async () => {
    if (selectedPlan === 'free') {
      // Freeプランは支払い不要
      setCurrentStep('line_setup')
      return
    }

    if (selectedPlan === 'pro') {
      // 既にProプランの場合はスキップ
      if (currentPlan === 'pro') {
        console.log('User already has Pro plan, skipping payment')
        setToast({ isVisible: true, message: '既にProプランをご利用中です', type: 'success' })
        setCurrentStep('line_setup')
        return
      }
      
      setLoading(true)
      setProgressMsg('Stripe決済ページへ移動中...')

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          throw new Error('認証セッションが見つかりません。再度ログインしてください。')
        }

        console.log('Creating Stripe checkout session...')
        
        // Stripe Checkout Sessionを作成
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            price_id: PRO_PRICE_ID,
            return_url: window.location.origin + '/onboarding'
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(errorData.error || `HTTP error: ${response.status}`)
        }

        const { url, error } = await response.json()
        console.log('Stripe response:', { url, error })
        
        if (error) {
          // エラーメッセージをユーザーフレンドリーに変換
          let userFriendlyMessage = '決済処理に失敗しました'
          if (error.includes('No such customer')) {
            userFriendlyMessage = '顧客情報の取得に失敗しました。再度お試しください。'
          } else if (error.includes('customer')) {
            userFriendlyMessage = '顧客情報の処理に失敗しました。再度お試しください。'
          }
          throw new Error(userFriendlyMessage)
        }
        if (!url) throw new Error('Checkoutセッションの作成に失敗しました')

        // Stripe Checkoutへリダイレクト
        console.log('Redirecting to Stripe:', url)
        window.location.href = url
      } catch (error: unknown) {
        console.error('Stripe error:', error)
        const message = error instanceof Error ? error.message : 'Stripe決済の処理に失敗しました'
        setToast({ isVisible: true, message, type: 'error' })
        setLoading(false)
        setProgressMsg('')
      }
      return
    }

    // Executive プランは未実装
    setToast({ isVisible: true, message: 'Executiveプランは現在準備中です', type: 'error' })
  }

  // LINE設定の保存
  const handleSaveLineSettings = async () => {
    if (!lineSettings.channel_id || !lineSettings.channel_secret || !lineSettings.channel_token) {
      setToast({ isVisible: true, message: 'すべての項目を入力してください', type: 'error' })
      return
    }

    setLoading(true)
    setProgressMsg('LINE設定を保存中...')

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('認証エラー')

      // 既存のレコードを確認
      const { data: existingLineAccount } = await supabase
        .from('line_accounts')
        .select('id')
        .eq('store_id', storeId)
        .maybeSingle()

      let lineError
      if (existingLineAccount) {
        // 既存のレコードを更新
        const { error } = await supabase
          .from('line_accounts')
          .update({
            channel_id: lineSettings.channel_id,
            channel_secret: lineSettings.channel_secret,
            channel_access_token: lineSettings.channel_token,
            updated_at: new Date().toISOString(),
          })
          .eq('store_id', storeId)
        lineError = error
      } else {
        // 新規レコードを挿入
        const { error } = await supabase
          .from('line_accounts')
          .insert({
            user_id: user.id,
            store_id: storeId,
            channel_id: lineSettings.channel_id,
            channel_secret: lineSettings.channel_secret,
            channel_access_token: lineSettings.channel_token,
            updated_at: new Date().toISOString(),
          })
        lineError = error
      }
      
      if (lineError) throw new Error(`LINE設定の保存に失敗しました: ${lineError.message}`)

      // Bot情報の取得を試みる
      try {
        await supabase.functions.invoke('get-line-bot-info', {
          body: { storeId }
        })
      } catch (e) {
        console.warn('Bot info fetch warning:', e)
      }

      setToast({ isVisible: true, message: 'LINE設定を保存しました', type: 'success' })
      setCurrentStep('tutorial')
    } catch (error: unknown) {
      console.error('LINE setup error:', error)
      const message = error instanceof Error ? error.message : '予期せぬエラーが発生しました'
      setToast({ isVisible: true, message, type: 'error' })
    } finally {
      setLoading(false)
      setProgressMsg('')
    }
  }

  // LINE設定をスキップ
  const handleSkipLineSetup = () => {
    setCurrentStep('tutorial')
  }

  // 設定代行サービスの申し込み
  const handleSetupServiceSubmit = async (formData: SetupServiceFormData) => {
    setSetupServiceSubmitting(true)
    try {
      // storeIdがnullの場合、店舗情報を取得
      let finalStoreId = storeId
      if (!finalStoreId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('ユーザー情報が見つかりません')
        
        const { data: storeData, error: storeError } = await supabase
          .from('stores')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle()
        
        if (storeError) {
          console.error('Store fetch error:', storeError)
        } else if (storeData) {
          finalStoreId = storeData.id
          setStoreId(storeData.id)
        }
      }

      const { data, error } = await supabase.functions.invoke('create-setup-checkout', {
        body: {
          ...formData,
          store_id: finalStoreId,
          return_url: `${window.location.origin}/onboarding`
        }
      })

      if (error) throw error

      if (data.url) {
        // Stripe Checkoutにリダイレクト
        window.location.href = data.url
      } else {
        throw new Error('決済URLの取得に失敗しました')
      }
    } catch (error: unknown) {
      console.error('Setup service error:', error)
      const message = error instanceof Error ? error.message : '申し込み処理に失敗しました'
      setToast({ isVisible: true, message, type: 'error' })
      setSetupServiceSubmitting(false)
      setIsSetupServiceModalOpen(false)
    }
  }

  // オンボーディング完了
  const handleComplete = () => {
    onComplete()
    navigate('/')
  }

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // ステップインジケーター
  const steps = [
    { key: 'basic_info', label: '基本情報', icon: User },
    { key: 'plan_select', label: 'プラン選択', icon: CreditCard },
    { key: 'line_setup', label: 'LINE接続', icon: MessageSquare },
    { key: 'tutorial', label: 'チュートリアル', icon: Play },
  ]

  const currentStepIndex = steps.findIndex(s => s.key === currentStep)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary-50/30 font-sans">
      {/* ヘッダー */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 p-2 rounded-xl">
              <Settings className="w-6 h-6 text-primary-600" />
            </div>
            <span className="font-bold text-slate-800">初期設定</span>
          </div>
          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm"
          >
            <LogOut size={16} />
            ログアウト
          </button>
        </div>
      </header>

      {/* ステップインジケーター */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-2 md:gap-4">
          {steps.map((step, index) => (
            <div key={step.key} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all ${
                index < currentStepIndex
                  ? 'bg-primary-100 text-primary-600'
                  : index === currentStepIndex
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
                  : 'bg-slate-100 text-slate-400'
              }`}>
                <step.icon size={16} />
                <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 md:w-12 h-0.5 mx-1 ${
                  index < currentStepIndex ? 'bg-primary-400' : 'bg-slate-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-5xl mx-auto px-4 pb-12">
        <AnimatePresence mode="wait">
          {/* Step 1: 基本情報 */}
          {currentStep === 'basic_info' && (
            <BasicInfoStep
              formData={formData}
              onFormDataChange={setFormData}
              kanaError={kanaError}
              searchingAddress={searchingAddress}
              loading={loading}
              progressMsg={progressMsg}
              onKanaChange={handleKanaChange}
              onPostalCodeSearch={handlePostalCodeSearch}
              onSubmit={(e) => { e.preventDefault(); handleSaveBasicInfo(); }}
            />
          )}

          {/* Step 2: プラン選択 */}
          {currentStep === 'plan_select' && (
            <PlanSelectStep
              selectedPlan={selectedPlan}
              onSelectedPlanChange={setSelectedPlan}
              hasUsedTrial={hasUsedTrial}
              isPreReleaseMode={IS_PRE_RELEASE_MODE}
              loading={loading}
              progressMsg={progressMsg}
              onPlanSelect={handlePlanSelect}
              onBack={() => setCurrentStep('basic_info')}
            />
          )}

          {/* Step 3: LINE接続設定 */}
          {currentStep === 'line_setup' && (
            <LineSetupStep
              lineSettings={lineSettings}
              onLineSettingsChange={setLineSettings}
              expandedGuide={expandedGuide}
              onExpandedGuideChange={setExpandedGuide}
              setupBannerVersion={SETUP_BANNER_VERSION}
              hasSetupServiceOrder={hasSetupServiceOrder}
              webhookUrl={WEBHOOK_URL}
              copiedField={copiedField}
              loading={loading}
              onSetupServiceClick={() => setIsSetupServiceModalOpen(true)}
              onSave={handleSaveLineSettings}
              onSkip={handleSkipLineSetup}
              onBack={() => setCurrentStep('plan_select')}
              onCopyToClipboard={copyToClipboard}
            />
          )}

          {/* Step 4: チュートリアル */}
          {currentStep === 'tutorial' && (
            <TutorialStep
              tutorialIndex={tutorialIndex}
              onTutorialIndexChange={setTutorialIndex}
              onComplete={handleComplete}
            />
          )}
        </AnimatePresence>
      </div>

      {/* モーダル */}
      <Modal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
        title="ログアウトの確認"
        message="ログアウトしてトップページに戻ります。よろしいですか？"
        confirmText="ログアウト"
        variant="danger"
      />

      <SetupServiceModal
        isOpen={isSetupServiceModalOpen}
        onClose={() => setIsSetupServiceModalOpen(false)}
        onSubmit={handleSetupServiceSubmit}
        submitting={setupServiceSubmitting}
        defaultEmail={userEmail}
      />

      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  )
}
