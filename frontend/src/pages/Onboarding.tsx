import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import {
  User,
  Store,
  Search,
  Loader2,
  ArrowRight,
  ArrowLeft,
  LogOut,
  MessageSquare,
  CreditCard,
  ExternalLink,
  Copy,
  Check,
  HelpCircle,
  Play,
  Gift,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Calendar,
  Settings,
  LayoutDashboard,
  Users,
  AlertTriangle
} from 'lucide-react'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import SetupServiceModal, { type SetupServiceFormData } from '../components/SetupServiceModal'

// プレリリースモード切り替えフラグ
// true: プレリリースモニター募集中（2ヶ月無料、サポートなし）
// false: 正式リリース（リリース記念キャンペーン）
const IS_PRE_RELEASE_MODE = true

// 初期設定代行バナーのバージョン切り替え
// 'production': 正式リリース版（¥9,980の初期設定代行バナー）
// 'prerelease': プレリリース版
const SETUP_BANNER_VERSION = import.meta.env.VITE_SETUP_BANNER_VERSION || 'production'

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
                  setToast({ 
                    isVisible: true, 
                    message: '設定代行サービスのお申し込みが完了しました。2営業日以内に担当スタッフからご連絡いたします。', 
                    type: 'success' 
                  })
                  setCurrentStep('tutorial')
                } else if (retryCount < maxRetries) {
                  setTimeout(() => checkOrderStatus(retryCount + 1), 1000)
                } else {
                  // リトライ上限に達した場合でも続行（Webhookが後で処理する可能性がある）
                  console.warn('Order status check timeout, proceeding anyway')
                  setToast({ 
                    isVisible: true, 
                    message: '設定代行サービスのお申し込みが完了しました。2営業日以内に担当スタッフからご連絡いたします。', 
                    type: 'success' 
                  })
                  setCurrentStep('tutorial')
                }
              }
              
              setTimeout(() => checkOrderStatus(1), 1000)
            } else {
              // 既に'paid'ステータスの場合
              setToast({ 
                isVisible: true, 
                message: '設定代行サービスのお申し込みが完了しました。2営業日以内に担当スタッフからご連絡いたします。', 
                type: 'success' 
              })
              setCurrentStep('tutorial')
            }
          }
        } catch (error) {
          console.error('Error checking order status:', error)
          // エラーが発生しても続行
          setToast({ 
            isVisible: true, 
            message: '設定代行サービスのお申し込みが完了しました。2営業日以内に担当スタッフからご連絡いたします。', 
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

        // 店舗情報を取得
        const { data: storeData } = await supabase
          .from('stores')
          .select('id, name, postal_code, address, phone_number, industry')
          .eq('owner_id', user.id)
          .single()

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
          const { data: lineData } = await supabase
            .from('line_accounts')
            .select('channel_id, channel_secret, channel_access_token')
            .eq('store_id', storeData.id)
            .maybeSingle()

          if (lineData && lineData.channel_id && lineData.channel_secret && lineData.channel_access_token) {
            hasLineAccount = true
            setLineSettings({
              channel_id: lineData.channel_id || '',
              channel_secret: lineData.channel_secret || '',
              channel_token: lineData.channel_access_token || ''
            })
          }
        }

        // 店舗情報があるがLINE連携が未設定の場合、LINE設定ステップから開始
        if (storeData && !hasLineAccount) {
          console.log('Store exists but LINE not connected, starting from line_setup')
          setCurrentStep('line_setup')
        }
      } catch (error) {
        console.error('Error loading existing data:', error)
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
            price_id: import.meta.env.VITE_STRIPE_PRO_PRICE_ID || 'price_1SmKVC7JLpsQAtFkOSirIftK',
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

      const { error: lineError } = await supabase
        .from('line_accounts')
        .upsert({
          user_id: user.id,
          store_id: storeId,
          channel_id: lineSettings.channel_id,
          channel_secret: lineSettings.channel_secret,
          channel_access_token: lineSettings.channel_token,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      
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
      const { data, error } = await supabase.functions.invoke('create-setup-checkout', {
        body: {
          ...formData,
          store_id: storeId,
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

  // チュートリアルコンテンツ
  const tutorialItems = [
    {
      title: 'ダッシュボード',
      description: '予約状況、顧客数、メッセージ数などを一目で確認。店舗の状況をリアルタイムで把握できます。',
      icon: LayoutDashboard,
    },
    {
      title: '予約管理',
      description: '予約の一覧、編集、キャンセルなどを管理。Googleカレンダーとも連携し、スケジュールを一元管理。',
      icon: Calendar,
    },
    {
      title: '顧客一覧',
      description: '顧客情報、来店履歴、メッセージ履歴を確認。各顧客とのやり取りを詳しく把握できます。',
      icon: Users,
    },
    {
      title: '自動応答',
      description: 'キーワードに対する自動返信を設定。営業時間外でもお客様をお待たせしません。',
      icon: MessageSquare,
    },
    {
      title: 'デジタル会員証',
      description: 'ポイントカードのデザインと設定を管理。お財布いらずで、来店のたびにポイントが貯まります。',
      icon: CreditCard,
    },
  ]

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
            <motion.div
              key="basic_info"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8"
            >
              <div className="text-center mb-8">
                <div className="bg-primary-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="text-primary-600" size={32} />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-2">基本情報を入力</h1>
                <p className="text-slate-500">サービスを利用開始するために、あなたと店舗の情報を登録してください。</p>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleSaveBasicInfo(); }} className="space-y-8">
                {/* お客様情報 */}
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                    <User size={20} className="text-primary-600" />
                    お客様情報
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">氏名 <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white"
                        placeholder="山田 太郎"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">フリガナ <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={formData.full_name_kana}
                        onChange={handleKanaChange}
                        className={`w-full px-4 py-3 rounded-xl border focus:ring-2 outline-none transition ${
                          kanaError
                            ? 'border-red-500 focus:ring-red-200 bg-red-50'
                            : 'border-slate-200 focus:ring-primary-500 bg-slate-50 focus:bg-white'
                        }`}
                        placeholder="ヤマダ タロウ"
                      />
                      {kanaError && <p className="text-xs text-red-600 mt-1">全角カタカナで入力してください</p>}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-slate-700 mb-1">電話番号 <span className="text-red-500">*</span></label>
                      <input
                        type="tel"
                        required
                        value={formData.user_phone_number}
                        onChange={(e) => setFormData({ ...formData, user_phone_number: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white"
                        placeholder="09012345678"
                      />
                    </div>
                  </div>
                </div>

                {/* 店舗情報 */}
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                    <Store size={20} className="text-primary-600" />
                    店舗情報
                  </h2>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">店舗名 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={formData.store_name}
                      onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white"
                      placeholder="〇〇カフェ"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">郵便番号 <span className="text-red-500">*</span></label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={formData.postal_code}
                          onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white"
                          placeholder="1000001"
                          maxLength={7}
                        />
                        <button
                          type="button"
                          onClick={handlePostalCodeSearch}
                          disabled={searchingAddress}
                          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition flex items-center gap-1 whitespace-nowrap"
                        >
                          {searchingAddress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search size={18} />}
                          検索
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">業種 <span className="text-red-500">*</span></label>
                      <select
                        required
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white"
                      >
                        <option value="">選択してください</option>
                        <option value="restaurant">飲食</option>
                        <option value="retail">小売</option>
                        <option value="beauty">美容・サロン</option>
                        <option value="medical">医療・クリニック</option>
                        <option value="education">教育・スクール</option>
                        <option value="other">その他</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">住所 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white"
                      placeholder="東京都千代田区千代田1-1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">店舗電話番号 <span className="text-red-500">*</span></label>
                    <input
                      type="tel"
                      required
                      value={formData.store_phone_number}
                      onChange={(e) => setFormData({ ...formData, store_phone_number: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white"
                      placeholder="03-1234-5678"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 bg-primary-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-primary-700 transition shadow-lg shadow-primary-200 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {progressMsg || '保存中...'}
                      </>
                    ) : (
                      <>
                        次へ進む
                        <ArrowRight size={20} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Step 2: プラン選択 */}
          {currentStep === 'plan_select' && (
            <motion.div
              key="plan_select"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8">
                <div className="text-center mb-8">
                  <div className="bg-primary-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="text-primary-600" size={32} />
                  </div>
                  <h1 className="text-2xl font-bold text-slate-800 mb-2">プランを選択</h1>
                  <p className="text-slate-500">あなたのビジネスに合ったプランをお選びください。</p>
                </div>

                {/* プレリリース特典 or リリース特典（トライアル未使用の場合のみ表示） */}
                {!hasUsedTrial && IS_PRE_RELEASE_MODE && (
                  /* プレリリースモニター特典 */
                  <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl p-6 mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      <Gift className="w-6 h-6" />
                      <span className="font-bold text-lg">🎁 プレリリースモニター限定特典</span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 mb-4">
                      <div className="text-center mb-4">
                        <div className="text-4xl md:text-5xl font-bold text-yellow-300 mb-2">
                          2ヶ月無料
                        </div>
                        <p className="text-primary-100">
                          Proプラン（通常 ¥4,980/月）が無料で使えます
                        </p>
                      </div>
                      <ul className="space-y-3">
                        <li className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-yellow-300 shrink-0 mt-0.5" />
                          <span>Proプランの全機能を<span className="font-bold text-yellow-300">2ヶ月間無料</span>で利用可能</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-yellow-300 shrink-0 mt-0.5" />
                          <span>ご登録いただいた<span className="font-bold text-yellow-300">データはそのまま継続</span>利用可能</span>
                        </li>
                      </ul>
                    </div>
                    {/* 注意事項 */}
                    <div className="bg-primary-900/30 border border-primary-300/30 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-300 shrink-0 mt-0.5" />
                        <div className="text-sm text-primary-100">
                          <p className="font-bold text-yellow-300 mb-2">プレリリース版についてのご注意</p>
                          <ul className="space-y-1 list-disc list-inside">
                            <li>現在開発中のため、<span className="font-medium text-yellow-300">仕様が予告なく変更</span>される場合があります</li>
                            <li>一部機能に<span className="font-medium text-yellow-300">不具合</span>が発生する可能性があります</li>
                            <li>プレリリース期間中は<span className="font-medium text-yellow-300">サポート対応ができません</span></li>
                            <li>LINE初期設定代行（¥9,980）は<span className="font-medium text-yellow-300">ご利用いただけません</span></li>
                            <li>クレジットカード登録が必須です。<span className="font-medium text-yellow-300">2ヶ月後から自動更新</span>で課金されます</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 正式リリース時のリリース特典（トライアル未使用の場合のみ表示） */}
                {!hasUsedTrial && !IS_PRE_RELEASE_MODE && (
                  <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl p-6 mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      <Gift className="w-6 h-6" />
                      <span className="font-bold text-lg">🎉 リリース特典 - 2つのコースから選べます</span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Course 1 */}
                      <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                        <div className="bg-white text-primary-700 text-xs font-bold px-2 py-1 rounded-full inline-block mb-3">
                          すぐ使いたい方向け
                        </div>
                        <h4 className="text-lg font-bold mb-3 text-yellow-300">スピード導入コース</h4>
                        <ul className="space-y-2 text-sm">
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
                        <div className="bg-white text-primary-700 text-xs font-bold px-2 py-1 rounded-full inline-block mb-3">
                          安く使いたい方向け
                        </div>
                        <h4 className="text-lg font-bold mb-3 text-yellow-300">じっくりお得コース</h4>
                        <ul className="space-y-2 text-sm">
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

                {/* プランカード */}
                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                  {/* Free Plan */}
                  <div
                    onClick={() => setSelectedPlan('free')}
                    className={`relative p-8 rounded-3xl cursor-pointer transition-all flex flex-col ${
                      selectedPlan === 'free'
                        ? 'border-2 border-primary-500 bg-white shadow-xl'
                        : 'border border-slate-200 bg-white shadow-sm hover:shadow-md'
                    }`}
                  >
                    {selectedPlan === 'free' && (
                      <div className="absolute -top-3 -left-3 bg-primary-600 text-white p-2 rounded-full">
                        <Check size={20} />
                      </div>
                    )}
                    <div className="mb-4">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-wider">Starter</span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Free</h3>
                    <div className="flex items-baseline mb-8">
                      <span className="text-4xl font-bold text-slate-900">¥0</span>
                      <span className="text-slate-500 ml-2">/月</span>
                    </div>
                    <ul className="space-y-4 mb-8 flex-1">
                      {[
                        '予約管理（無制限）',
                        '固定応答 10件',
                        'ポイントカード基本機能',
                        '※一部機能制限あり'
                      ].map((item, i) => (
                        <li key={i} className="flex items-center text-slate-600">
                          <Check className="w-5 h-5 text-primary-500 mr-3 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Pro Plan */}
                  <div
                    onClick={() => setSelectedPlan('pro')}
                    className={`relative p-8 rounded-3xl cursor-pointer transition-all flex flex-col transform md:-translate-y-4 ${
                      selectedPlan === 'pro'
                        ? 'border-2 border-primary-500 bg-white shadow-2xl'
                        : 'border-2 border-primary-500 bg-white shadow-xl'
                    }`}
                  >
                    <div className="absolute top-0 right-0 bg-primary-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl rounded-tr-2xl">
                      おすすめ
                    </div>
                    {selectedPlan === 'pro' && (
                      <div className="absolute -top-3 -left-3 bg-primary-600 text-white p-2 rounded-full">
                        <Check size={20} />
                      </div>
                    )}
                    <div className="mb-4">
                      <span className="px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-xs font-bold uppercase tracking-wider">Standard</span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Pro</h3>
                    {!hasUsedTrial && (
                      <div className="mb-3">
                        <span className="inline-block bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded">
                          {IS_PRE_RELEASE_MODE ? '2ヶ月無料' : '初月無料'}
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline mb-8">
                      <span className="text-4xl font-bold text-slate-900">¥4,980</span>
                      <span className="text-slate-500 ml-2">/月</span>
                    </div>
                    <ul className="space-y-4 mb-8 flex-1">
                      {[
                        '全機能解放',
                        'Googleカレンダー連携',
                        'デジタル会員証（フル機能）',
                        '無制限応答 & AI応答',
                        '詳細分析レポート'
                      ].map((item, i) => (
                        <li key={i} className="flex items-center text-slate-700 font-medium">
                          <Check className="w-5 h-5 text-primary-600 mr-3 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Executive Plan */}
                  <div
                    className="relative p-8 rounded-3xl flex flex-col border border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
                  >
                    <div className="mb-4">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-wider">Coming Soon</span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Executive</h3>
                    <div className="flex items-baseline mb-8">
                      <span className="text-3xl font-bold text-slate-900">¥19,800〜</span>
                      <span className="text-slate-500 ml-2">/月</span>
                    </div>
                    <ul className="space-y-4 mb-8 flex-1">
                      {[
                        '複数店舗管理',
                        'ホワイトラベル',
                        '個別相談・コンサル',
                        '独自開発の依頼権'
                      ].map((item, i) => (
                        <li key={i} className="flex items-center text-slate-600">
                          <Check className="w-5 h-5 text-primary-500 mr-3 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep('basic_info')}
                  className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium"
                >
                  <ArrowLeft size={20} />
                  戻る
                </button>
                <button
                  onClick={handlePlanSelect}
                  disabled={loading}
                  className="flex items-center gap-2 bg-primary-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-primary-700 transition shadow-lg shadow-primary-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {progressMsg || '処理中...'}
                    </>
                  ) : (
                    <>
                      次へ進む
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: LINE接続設定 */}
          {currentStep === 'line_setup' && (
            <motion.div
              key="line_setup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8">
                <div className="text-center mb-8">
                  <div className="bg-[#06C755]/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="text-[#06C755]" size={32} />
                  </div>
                  <h1 className="text-2xl font-bold text-slate-800 mb-2">LINE公式アカウントと接続</h1>
                  <p className="text-slate-500">ステップごとに丁寧にご案内します。ゆっくり進めてください。</p>
                </div>

                {/* 初期設定代行バナー（プレリリースモードでは非表示） */}
                {!IS_PRE_RELEASE_MODE && (
                  <>
                    {/* 正式リリース版 */}
                    {SETUP_BANNER_VERSION === 'production' && (
                      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl p-6 mb-8">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <HelpCircle size={20} />
                              <span className="font-bold">設定が難しいですか？</span>
                            </div>
                            <p className="text-sm text-white/90">
                              専門スタッフがあなたの代わりにLINE接続設定を完了させます。
                            </p>
                          </div>
                          <button 
                            onClick={() => setIsSetupServiceModalOpen(true)}
                            className="bg-white text-amber-600 px-6 py-3 rounded-xl font-bold hover:bg-amber-50 transition whitespace-nowrap shadow-lg"
                          >
                            初期設定代行を依頼（¥9,980）
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* プレリリース版 */}
                    {SETUP_BANNER_VERSION === 'prerelease' && (
                      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl p-6 mb-8">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle size={20} />
                              <span className="font-bold">プレリリースモニターの方へ</span>
                            </div>
                            <p className="text-sm text-white/90">
                              プレリリース期間中は初期設定代行サービスをご利用いただけません。以下の手順に沿ってご自身で設定をお願いいたします。
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* プレリリースモード時の注意バナー */}
                {IS_PRE_RELEASE_MODE && (
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl p-6 mb-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle size={20} />
                          <span className="font-bold">プレリリースモニターの方へ</span>
                        </div>
                        <p className="text-sm text-white/90">
                          プレリリース期間中は初期設定代行サービスをご利用いただけません。以下の手順に沿ってご自身で設定をお願いいたします。
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* LINE設定のサブステップ */}
                <div className="space-y-4">
                  {/* Step 1: LINE公式アカウント作成 */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedGuide(expandedGuide === 'create_account' ? null : 'create_account')}
                      className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="bg-[#06C755] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                        <span className="font-bold text-slate-800">LINE公式アカウントの作成</span>
                      </div>
                      {expandedGuide === 'create_account' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    {expandedGuide === 'create_account' && (
                      <div className="p-4 bg-white border-t border-slate-200">
                        <p className="text-sm text-slate-600 mb-4">
                          まだLINE公式アカウントをお持ちでない場合は、以下のリンクから作成してください。
                          すでにお持ちの方はスキップしてください。
                        </p>
                        <a
                          href="https://www.linebiz.com/jp/entry/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-[#06C755] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#05b34c] transition"
                        >
                          LINE公式アカウント開設ページ <ExternalLink size={16} />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Step 2: LINE Developers登録 */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedGuide(expandedGuide === 'developers' ? null : 'developers')}
                      className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="bg-[#06C755] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                        <span className="font-bold text-slate-800">LINE Developersへの登録とチャネル作成</span>
                      </div>
                      {expandedGuide === 'developers' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    {expandedGuide === 'developers' && (
                      <div className="p-4 bg-white border-t border-slate-200">
                        <p className="text-sm text-slate-600 mb-4">
                          Messaging APIを利用するために、LINE Developersへの登録が必要です。
                        </p>
                        <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2 mb-4">
                          <li>
                            <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="text-[#06C755] hover:underline font-medium">
                              LINE Developers Console
                            </a>
                            にログインします。
                          </li>
                          <li>初めての場合は「プロバイダー作成」を行います（店舗名などでOK）。</li>
                          <li>「新規チャネル作成」をクリックし、「Messaging API」を選択します。</li>
                          <li>必要な情報を入力してチャネルを作成します。</li>
                        </ol>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                          <BookOpen size={16} className="inline mr-2" />
                          チャネル作成時の「アプリタイプ」は「BOT」を選択してください。
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 3: 設定情報の取得と入力 */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedGuide(expandedGuide === 'credentials' ? null : 'credentials')}
                      className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="bg-[#06C755] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                        <span className="font-bold text-slate-800">設定情報の取得と入力</span>
                      </div>
                      {expandedGuide === 'credentials' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    {expandedGuide === 'credentials' && (
                      <div className="p-4 bg-white border-t border-slate-200 space-y-4">
                        <p className="text-sm text-slate-600">
                          作成したチャネルの設定画面から以下の情報を取得し、下のフォームに入力してください。
                        </p>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">
                              Channel ID <span className="text-slate-400 font-normal">（チャネル基本設定タブ）</span>
                            </label>
                            <input
                              type="text"
                              value={lineSettings.channel_id}
                              onChange={(e) => setLineSettings({ ...lineSettings, channel_id: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#06C755]/20 focus:border-[#06C755] outline-none"
                              placeholder="1234567890"
                              autoComplete="off"
                              name="line-channel-id"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">
                              Channel Secret <span className="text-slate-400 font-normal">（チャネル基本設定タブ）</span>
                            </label>
                            <input
                              type="text"
                              value={lineSettings.channel_secret}
                              onChange={(e) => setLineSettings({ ...lineSettings, channel_secret: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#06C755]/20 focus:border-[#06C755] outline-none"
                              placeholder="abcdef1234567890..."
                              autoComplete="off"
                              name="line-channel-secret"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">
                              Channel Access Token <span className="text-slate-400 font-normal">（Messaging API設定タブ → 発行）</span>
                            </label>
                            <textarea
                              value={lineSettings.channel_token}
                              onChange={(e) => setLineSettings({ ...lineSettings, channel_token: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#06C755]/20 focus:border-[#06C755] outline-none h-20"
                              placeholder="Long lived access token..."
                              autoComplete="off"
                              name="line-channel-token"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 4: Webhook設定 */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedGuide(expandedGuide === 'webhook' ? null : 'webhook')}
                      className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="bg-[#06C755] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                        <span className="font-bold text-slate-800">Webhookの設定</span>
                      </div>
                      {expandedGuide === 'webhook' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    {expandedGuide === 'webhook' && (
                      <div className="p-4 bg-white border-t border-slate-200">
                        <p className="text-sm text-slate-600 mb-4">
                          LINEからのメッセージを受け取るための設定を行います。
                        </p>
                        
                        <div className="bg-slate-50 rounded-lg p-3 mb-4">
                          <p className="text-xs font-bold text-slate-700 mb-2">Webhook URL（これをコピーしてください）</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={WEBHOOK_URL}
                              className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-600"
                            />
                            <button
                              onClick={() => copyToClipboard(WEBHOOK_URL, 'webhook')}
                              className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                                copiedField === 'webhook'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              }`}
                            >
                              {copiedField === 'webhook' ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>

                        <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
                          <li>LINE Developers Consoleの「Messaging API設定」タブを開きます。</li>
                          <li>「Webhook設定」の「編集」をクリックし、上記URLを貼り付けて「更新」します。</li>
                          <li><strong>「Webhookの利用」をオン</strong>にします。</li>
                          <li>「検証」ボタンを押して、成功することを確認します。</li>
                        </ol>
                      </div>
                    )}
                  </div>

                  {/* Step 5: 応答設定 */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedGuide(expandedGuide === 'response' ? null : 'response')}
                      className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="bg-[#06C755] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">5</span>
                        <span className="font-bold text-slate-800">応答設定の変更</span>
                      </div>
                      {expandedGuide === 'response' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    {expandedGuide === 'response' && (
                      <div className="p-4 bg-white border-t border-slate-200">
                        <p className="text-sm text-slate-600 mb-4">
                          LINE公式アカウントの自動応答と競合しないように設定を変更します。
                        </p>
                        <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
                          <li>LINE Developers Consoleの「Messaging API設定」タブにある「LINE公式アカウント機能」の「応答メッセージ」をクリックします。</li>
                          <li>「応答設定」で以下のように設定します：
                            <ul className="list-disc list-inside ml-4 mt-1 text-slate-500">
                              <li><strong>応答メッセージ</strong>: オフ</li>
                              <li><strong>Webhook</strong>: オン</li>
                            </ul>
                          </li>
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep('plan_select')}
                  className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium"
                >
                  <ArrowLeft size={20} />
                  戻る
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={handleSkipLineSetup}
                    className="px-6 py-3 text-slate-600 hover:text-slate-800 font-medium"
                  >
                    あとで設定する
                  </button>
                  <button
                    onClick={handleSaveLineSettings}
                    disabled={loading || !lineSettings.channel_id || !lineSettings.channel_secret || !lineSettings.channel_token}
                    className="flex items-center gap-2 bg-[#06C755] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#05b34c] transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        設定を保存して次へ
                        <ArrowRight size={20} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: チュートリアル */}
          {currentStep === 'tutorial' && (
            <motion.div
              key="tutorial"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8">
                <div className="text-center mb-8">
                  <div className="bg-primary-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Play className="text-primary-600" size={32} />
                  </div>
                  <h1 className="text-2xl font-bold text-slate-800 mb-2">🎉 設定完了！</h1>
                  <p className="text-slate-500">IToguchiの主な機能をご紹介します。</p>
                </div>

                {/* チュートリアルカルーセル */}
                <div className="relative">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={tutorialIndex}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-gradient-to-br from-primary-50 to-primary-100/50 rounded-2xl p-8 text-center"
                    >
                      <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                        {(() => {
                          const Icon = tutorialItems[tutorialIndex].icon
                          return <Icon className="text-primary-600" size={40} />
                        })()}
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-3">{tutorialItems[tutorialIndex].title}</h3>
                      <p className="text-slate-600 max-w-md mx-auto">{tutorialItems[tutorialIndex].description}</p>
                    </motion.div>
                  </AnimatePresence>

                  {/* ドットインジケーター */}
                  <div className="flex justify-center gap-2 mt-6">
                    {tutorialItems.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setTutorialIndex(index)}
                        className={`w-2 h-2 rounded-full transition ${
                          index === tutorialIndex ? 'bg-primary-600 w-6' : 'bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* ナビゲーションボタン */}
                <div className="flex justify-between mt-8">
                  <button
                    onClick={() => setTutorialIndex(Math.max(0, tutorialIndex - 1))}
                    disabled={tutorialIndex === 0}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowLeft size={20} />
                    前へ
                  </button>
                  {tutorialIndex < tutorialItems.length - 1 ? (
                    <button
                      onClick={() => setTutorialIndex(tutorialIndex + 1)}
                      className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
                    >
                      次へ
                      <ArrowRight size={20} />
                    </button>
                  ) : (
                    <button
                      onClick={handleComplete}
                      className="flex items-center gap-2 bg-primary-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-primary-700 transition shadow-lg shadow-primary-200"
                    >
                      ダッシュボードを開く
                      <ArrowRight size={20} />
                    </button>
                  )}
                </div>
              </div>

              {/* スキップボタン */}
              {tutorialIndex < tutorialItems.length - 1 && (
                <div className="text-center">
                  <button
                    onClick={handleComplete}
                    className="text-slate-500 hover:text-slate-700 text-sm"
                  >
                    スキップしてダッシュボードへ
                  </button>
                </div>
              )}
            </motion.div>
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
