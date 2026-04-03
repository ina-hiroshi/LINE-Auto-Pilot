import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { motion } from 'framer-motion'
import { MessageCircle, Calendar, CreditCard, ArrowRight, Check, Eye, EyeOff, Loader2, AlertTriangle, Sparkles, Layout, Palette, Smartphone, MousePointerClick, Clock, Users, Crown, Code, Zap, HelpCircle, Star, MessageSquare, ChevronDown, Scissors, HeartPulse, Utensils, Dumbbell, Gem, Flower2 } from 'lucide-react'
import Toast from '../components/Toast'
import topHeroImage from '../assets/top_hero.jpg'
import smartAutoChatImage from '../assets/smartautochat.jpg'
import yoyakuImage from '../assets/yoyaku.png'
import membersImage from '../assets/members.png'
import iconImage from '../assets/icon.png'
import itoguchiaiImage from '../assets/itoguchiai.png'

// FAQ Item Component
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden hover:shadow-md transition-all"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5 text-primary-600" />
          </div>
          <span className="font-bold text-slate-900 text-sm sm:text-base">{question}</span>
        </div>
        <div className={`ml-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown className="w-5 h-5 text-slate-400" />
        </div>
      </button>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="px-6 pb-4 pl-16 text-slate-600 text-sm sm:text-base leading-relaxed">
            {answer}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

export default function TopPage() {
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  // 認証コード関連
  const [showVerificationStep, setShowVerificationStep] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  
  // 利用規約・プライバシーポリシーへの同意
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false)

  // トーストを自動的に消す
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Scroll to auth section if navigated from feature pages
  useEffect(() => {
    const state = location.state as { scrollTo?: string } | null
    if (state?.scrollTo === 'auth') {
      const authElement = document.getElementById('auth')
      if (authElement) {
        authElement.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [location])

  // 再送信のクールダウンタイマー
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      if (isLoginMode) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      } else {
        if (password !== confirmPassword) {
          setToast({ message: 'パスワードが一致しません。', type: 'error' })
          setLoading(false)
          return
        }
        
        // まず認証コードを送信（アカウント作成はコード検証後に行う）
        try {
          await sendVerificationCode()
          setShowVerificationStep(true)
        } catch (error) {
          // エラーはsendVerificationCode内で処理済み
        }
        setLoading(false)
        return
      }
    } catch (error: unknown) {
      console.error('Auth error:', error)
      let message = 'エラーが発生しました。'
      const err = error as { message?: string }
      if (err.message === 'Invalid login credentials') {
        message = 'メールアドレスまたはパスワードが正しくありません。'
      } else if (err.message) {
        message = err.message
      }
      setToast({ message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const sendVerificationCode = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('send-verification-code', {
        body: { email }
      })
      
      if (error) throw error
      
      // 既存ユーザーの場合
      if (data?.existingUser) {
        setToast({ message: data.error || 'このメールアドレスは既に登録されています。', type: 'error' })
        setIsLoginMode(true)
        throw new Error('existing_user')
      }
      
      if (data?.error) {
        throw new Error(data.error)
      }
      
      setToast({ message: `${email} に認証コードを送信しました`, type: 'success' })
      setResendCooldown(60) // 60秒のクールダウン
    } catch (error) {
      console.error('Send code error:', error)
      if (error instanceof Error && error.message !== 'existing_user') {
        setToast({ message: error.message || '認証コードの送信に失敗しました', type: 'error' })
      }
      throw error
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // 認証コードを検証
      const { data, error } = await supabase.functions.invoke('verify-code', {
        body: { email, code: verificationCode }
      })
      
      if (error || !data?.valid) {
        throw new Error(data?.error || '認証コードが正しくありません')
      }
      
      // 検証成功 → アカウント作成（メール確認スキップ設定が必要）
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // メール確認をスキップするためのメタデータ
          data: {
            email_verified: true
          }
        }
      })
      
      if (signUpError) {
        // 既にアカウントが存在する場合はログインを試みる
        if (signUpError.message?.includes('already registered')) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          })
          if (signInError) throw signInError
        } else {
          throw signUpError
        }
      } else if (signUpData.session) {
        // セッションが作成された（メール確認不要の設定の場合）
        setToast({ message: 'アカウントを作成しました', type: 'success' })
      } else {
        // セッションがない場合はログインを試みる
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
      }
      
      // App.tsxのonAuthStateChangeで自動的にオンボーディングへ遷移
    } catch (error: unknown) {
      console.error('Verification error:', error)
      const message = error instanceof Error ? error.message : '認証に失敗しました'
      setToast({ message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (resendCooldown > 0) return
    setLoading(true)
    try {
      await sendVerificationCode()
    } catch (error) {
      // エラーはsendVerificationCode内で処理済み
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-primary-100 selection:text-primary-900">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md fixed w-full z-50 border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <img src={iconImage} alt="IToguchi" className="h-10 md:h-16 w-auto" />
            </div>
            <nav className="hidden md:flex space-x-8 items-center">
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-primary-600 transition">機能</a>
              <a href="#customization" className="text-sm font-medium text-slate-600 hover:text-primary-600 transition">カスタマイズ</a>
              <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-primary-600 transition">料金</a>
              <a href="#auth" className="px-5 py-2.5 bg-primary-600 text-white rounded-full text-sm font-medium hover:bg-primary-700 transition shadow-md hover:shadow-lg">
                ログイン / 登録
              </a>
            </nav>
            {/* Mobile Menu Button (Simplified) */}
            <div className="md:hidden">
              <a href="#auth" className="px-4 py-2 bg-primary-600 text-white rounded-full text-xs font-bold hover:bg-primary-700 transition shadow-md">
                始める
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-40 pb-24 lg:pt-48 lg:pb-32 overflow-hidden relative">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-primary-50/50 blur-3xl"></div>
          <div className="absolute top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary-50/50 blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="lg:w-1/2 text-left"
            >
              <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-primary-50 border border-primary-100 text-primary-600 text-sm sm:text-base font-semibold tracking-wide whitespace-nowrap sm:whitespace-normal">
                誰でも簡単、気軽に始めるLINEマーケティング
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-8 leading-[1.15] tracking-tight">
                <span className="block lg:whitespace-nowrap">お店とお客様をつなぐ、</span>
                <span className="relative inline-block lg:whitespace-nowrap z-0">
                  <span className="relative z-10 text-white">たしかな糸ぐち。</span>
                  <motion.span 
                    initial={{ scaleX: 0, skewX: -12 }}
                    animate={{ scaleX: 1, skewX: -12 }}
                    transition={{ duration: 0.8, delay: 0.5, ease: "circOut" }}
                    className="absolute top-[-5%] bottom-[-5%] left-[-0.3em] w-[calc(100%+0.6em)] bg-primary-500 origin-left -z-10"
                  />
                </span>
              </h1>
              <p className="text-base sm:text-lg text-slate-600 mb-10 max-w-2xl leading-relaxed">
                LINE公式アカウントが、あなたの代わりにお客様対応。<br />
                質問への自動返信、予約の受付、ポイントカードの管理まで。<br />
                スマホひとつで、お店のファン作りをサポートします。
              </p>
              <div className="flex flex-col sm:flex-row justify-start gap-4">
                <a href="#auth" className="px-8 py-4 bg-primary-600 text-white rounded-full font-bold hover:bg-primary-700 transition shadow-lg hover:shadow-primary-200 flex items-center justify-center gap-2 group">
                  無料で始める
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
                <a href="#features" className="px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-full font-bold hover:bg-slate-50 transition flex items-center justify-center">
                  機能を見る
                </a>
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:w-1/2 relative"
            >
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
                <img 
                  src={topHeroImage}
                  alt="Shop Staff welcoming customers" 
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent"></div>
              </div>
              
              {/* Badge 1: Auto Response (Bottom Left) */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="absolute -bottom-4 -left-2 md:-bottom-6 md:-left-6 bg-white p-3 md:p-4 lg:p-6 rounded-2xl shadow-xl border border-slate-100 scale-90 md:scale-100 origin-bottom-left"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="bg-green-100 p-2 md:p-3 rounded-full">
                    <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-slate-500 font-medium">自動応答率</p>
                    <p className="text-lg md:text-2xl font-bold text-slate-900">98%</p>
                  </div>
                </div>
              </motion.div>

              {/* Badge 2: Reservation (Top Right) */}
              <motion.div 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="absolute -top-4 -right-2 md:-top-6 md:-right-6 bg-white p-3 md:p-4 lg:p-6 rounded-2xl shadow-xl border border-slate-100 scale-90 md:scale-100 origin-top-right"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="bg-primary-100 p-2 md:p-3 rounded-full">
                    <Calendar className="w-5 h-5 md:w-6 md:h-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-slate-500 font-medium">予約受付</p>
                    <p className="text-lg md:text-2xl font-bold text-slate-900">24h</p>
                  </div>
                </div>
              </motion.div>

              {/* Badge 3: Membership (Bottom Right - slightly offset) */}
              <motion.div 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="absolute -bottom-4 -right-2 md:-bottom-6 md:-right-6 bg-white p-3 md:p-4 lg:p-6 rounded-2xl shadow-xl border border-slate-100 scale-90 md:scale-100 origin-bottom-right"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="bg-orange-100 p-2 md:p-3 rounded-full">
                    <CreditCard className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-slate-500 font-medium">会員証</p>
                    <p className="text-lg md:text-xl font-bold text-slate-900">デジタル化</p>
                  </div>
                </div>
              </motion.div>

            </motion.div>
          </div>
        </div>
      </section>

      {/* Why IToguchi Section - 選ばれる理由 */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-primary-50/30 blur-3xl"></div>
          <div className="absolute bottom-[20%] left-[10%] w-[40%] h-[40%] rounded-full bg-emerald-50/30 blur-3xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-block"
            >
              <span className="inline-block px-4 py-1.5 mb-4 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-sm font-semibold">
                IToguchiが選ばれる理由
              </span>
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4"
            >
              他の予約システムとは、ここが違う
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-slate-600 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed"
            >
              専門知識不要で、LINEひとつで完結。<br className="hidden md:block" />
              個人の店主が本業に集中できる環境を作ります。
            </motion.p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Code,
                title: 'No-Code',
                description: '専門知識不要で誰でも設定可能。プログラミングの知識は一切不要です。'
              },
              {
                icon: Zap,
                title: 'オールインワン',
                description: '予約・会員証・自動応答が1つに統合。複数のツールを使い分ける必要がありません。'
              },
              {
                icon: Smartphone,
                title: 'LINE完結',
                description: 'お客様は新しいアプリをダウンロードする必要がありません。LINEだけで完結します。'
              },
              {
                icon: CreditCard,
                title: '低コスト',
                description: '無料プランから始められます。月額¥4,980のProプランで全機能が使えます。'
              }
            ].map((reason, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-50 rounded-2xl p-6 hover:bg-white hover:shadow-lg transition-all border border-slate-100"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mb-4">
                  <reason.icon className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{reason.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{reason.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Section - AI特設ページへの誘導 */}
      <section className="py-24 bg-slate-50 relative overflow-hidden">
        {/* 背景装飾 */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-blue-50/50 blur-3xl"></div>
          <div className="absolute bottom-[20%] left-[10%] w-[40%] h-[40%] rounded-full bg-primary-50/50 blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/2 h-1/2 rounded-full bg-purple-50/30 blur-3xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            {/* 左側: テキストコンテンツ */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="lg:w-1/2 text-left w-full"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="inline-block mb-6"
              >
              <span className="inline-block px-4 py-1.5 mb-4 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-sm font-semibold">
                AIで進化
              </span>
              </motion.div>
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4 sm:mb-6 leading-[1.15] tracking-tight"
              >
                AIがあなたの代わりに<br />
                <span className="text-primary-600">24時間接客</span>
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-sm sm:text-base lg:text-lg text-slate-600 mb-6 sm:mb-8 max-w-2xl leading-relaxed"
              >
                営業時間外でも24時間、お客様に寄り添う接客を実現します。
                キーワード応答で対応できない質問にもAIが即座に回答。
                店舗独自の情報を学習させれば、より正確な回答が可能です。
              </motion.p>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-3 sm:gap-4"
              >
                <Link 
                  to="/feature/ai" 
                  className="px-6 sm:px-8 py-3 sm:py-4 bg-primary-600 text-white rounded-full font-bold hover:bg-primary-700 transition shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group text-sm sm:text-base"
                >
                  AI機能をもっと詳しく見る
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            </motion.div>
            
            {/* 右側: 画像 */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:w-1/2 relative"
            >
              <Link to="/feature/ai" className="block group">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white transition-transform group-hover:scale-105">
                  <img 
                    src={itoguchiaiImage}
                    alt="AIがあなたの代わりに接客" 
                    className="w-full h-auto object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent group-hover:from-black/30 transition-all"></div>
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              繋がりを深める、3つの機能
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto px-4 text-sm sm:text-base leading-relaxed">
              IToguchiは、店舗運営に必要な機能をシンプルに統合。<br className="hidden md:block" />
              お客様とのコミュニケーションを円滑にします。
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { 
                image: smartAutoChatImage, 
                title: 'スマート自動応答', 
                desc: 'よくある質問にはAIが即座に対応。お客様をお待たせすることなく、機会損失を防ぎます。',
                link: '/feature/auto-response'
              },
              { 
                image: yoyakuImage, 
                title: 'かんたん予約管理', 
                desc: 'LINEのトーク画面からそのまま予約完了。電話対応の手間を減らし、予約のハードルを下げます。',
                link: '/feature/reservation'
              },
              { 
                image: membersImage, 
                title: 'デジタル会員証', 
                desc: 'お財布を圧迫しないLINE上の会員証。ポイント管理もスムーズで、リピート率向上に貢献します。',
                link: '/feature/membership'
              }
            ].map((feature, index) => (
              <Link to={feature.link} key={index}>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.2 }}
                  className="group bg-slate-50 rounded-3xl overflow-hidden hover:bg-white hover:shadow-xl transition-all duration-300 border border-slate-100 cursor-pointer h-full"
                >
                  <div className="h-56 overflow-hidden relative">
                    <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors z-10"></div>
                    <img src={feature.image} alt={feature.title} className="w-full h-full object-cover transform group-hover:scale-105 transition duration-700" />
                  </div>
                  <div className="p-8">
                    <h3 className="text-xl font-bold mb-3 text-slate-900 group-hover:text-primary-600 transition-colors">{feature.title}</h3>
                    <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
                    <div className="mt-4 flex items-center text-primary-600 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      詳しく見る
                      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Target Industries Section - 対象業種 */}
      <section className="py-24 bg-slate-50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-primary-50/50 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-gradient-to-tr from-emerald-50/50 to-transparent rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-block"
            >
              <span className="inline-block px-4 py-1.5 mb-4 rounded-full bg-primary-100 border border-primary-200 text-primary-700 text-sm font-semibold">
                こんなお店にぴったり
              </span>
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4"
            >
              個人経営のお店を応援します
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-slate-600 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed"
            >
              予約が必要なお店、リピート客を大切にしたいお店に最適です。
            </motion.p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: '美容室・ヘアサロン', icon: Scissors, color: 'text-pink-600', bgColor: 'bg-pink-100' },
              { name: 'ネイルサロン・まつエクサロン', icon: Gem, color: 'text-purple-600', bgColor: 'bg-purple-100' },
              { name: 'エステ・リラクゼーション', icon: Flower2, color: 'text-rose-600', bgColor: 'bg-rose-100' },
              { name: '整体・整骨院', icon: HeartPulse, color: 'text-red-600', bgColor: 'bg-red-100' },
              { name: '個人経営の飲食店', icon: Utensils, color: 'text-orange-600', bgColor: 'bg-orange-100' },
              { name: 'パーソナルジム・ヨガスタジオ', icon: Dumbbell, color: 'text-blue-600', bgColor: 'bg-blue-100' }
            ].map((industry, index) => {
              const IconComponent = industry.icon
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-xl p-6 hover:shadow-lg transition-all border border-slate-100 flex items-center gap-4 group"
                >
                  <div className={`w-14 h-14 rounded-xl ${industry.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform shrink-0`}>
                    <IconComponent className={`w-7 h-7 ${industry.color}`} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{industry.name}</h3>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Customization Features Section - リッチメニュー・予約ページ編集 */}
      <section id="customization" className="py-24 bg-slate-50 relative overflow-hidden">
        {/* 背景装飾 */}
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-primary-50/50 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-gradient-to-tr from-emerald-50/50 to-transparent rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-block"
            >
              <span className="inline-block px-4 py-1.5 mb-4 rounded-full bg-primary-100 border border-primary-200 text-primary-700 text-sm font-semibold">
                直感的なカスタマイズ
              </span>
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4"
            >
              あなたの店舗に合わせて、自由にデザイン
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-slate-600 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed"
            >
              専門知識不要。リッチメニューも予約ページも、<br className="hidden md:block" />
              シンプルな操作で簡単にカスタマイズできます。
            </motion.p>
          </div>
          
          {/* リッチメニュー登録機能 */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
              <div className="grid lg:grid-cols-2 gap-0">
                {/* 左側：機能説明 */}
                <div className="p-8 lg:p-12 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-3 rounded-2xl shadow-lg shadow-primary-200">
                      <Layout className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">リッチメニュー登録</h3>
                      <p className="text-sm text-slate-500">LINE画面下部のメニューをカスタマイズ</p>
                    </div>
                  </div>
                  
                  <p className="text-slate-600 mb-8 leading-relaxed">
                    お客様がLINEを開いたときに最初に目に入るリッチメニュー。<br />
                    あなたの店舗の個性を反映したデザインで、予約や問い合わせへの導線を作りましょう。
                  </p>
                  
                  {/* アピールポイント */}
                  <div className="grid sm:grid-cols-2 gap-4 mb-8">
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                      <div className="bg-primary-100 p-2 rounded-lg shrink-0">
                        <Palette className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                          6種類のテーマ
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-bold flex items-center gap-0.5">
                            <Crown className="w-3 h-3" />Pro
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">シンプルは無料、他5種はPro</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                      <div className="bg-primary-100 p-2 rounded-lg shrink-0">
                        <Layout className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                          柔軟なレイアウト
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-bold flex items-center gap-0.5">
                            <Crown className="w-3 h-3" />Pro
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">2×2、3×2、コンパクトなど</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                      <div className="bg-primary-100 p-2 rounded-lg shrink-0">
                        <MousePointerClick className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">ワンクリック反映</p>
                        <p className="text-xs text-slate-500 mt-0.5">設定後すぐにLINEに反映</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                      <div className="bg-primary-100 p-2 rounded-lg shrink-0">
                        <Smartphone className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">リアルタイムプレビュー</p>
                        <p className="text-xs text-slate-500 mt-0.5">編集しながら即確認</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'アイコン選択', pro: false },
                      { label: 'ラベル編集', pro: false },
                      { label: 'カスタム背景画像', pro: true },
                      { label: 'スロット背景画像', pro: true },
                    ].map((tag) => (
                      <span key={tag.label} className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${tag.pro ? 'bg-amber-50 text-amber-700' : 'bg-primary-50 text-primary-700'}`}>
                        {tag.label}
                        {tag.pro && <Crown className="w-3 h-3" />}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* 右側：UIプレビュー */}
                <div className="bg-gradient-to-br from-slate-100 to-slate-50 p-8 lg:p-12 flex items-center justify-center">
                  <div className="relative">
                    {/* スマホフレーム */}
                    <div className="bg-slate-900 rounded-[3rem] p-3 shadow-2xl">
                      <div className="bg-white rounded-[2.5rem] overflow-hidden w-[280px]">
                        {/* ステータスバー */}
                        <div className="bg-slate-100 px-6 py-3 flex items-center justify-between">
                          <div className="text-xs font-semibold text-slate-600">9:41</div>
                          <div className="flex gap-1">
                            <div className="w-4 h-2 bg-slate-400 rounded-sm" />
                            <div className="w-4 h-2 bg-slate-400 rounded-sm" />
                            <div className="w-6 h-3 bg-slate-400 rounded-sm" />
                          </div>
                        </div>
                        {/* LINEヘッダー */}
                        <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                          <div className="w-2 h-2" />
                          <div className="flex-1 text-center">
                            <p className="font-bold text-slate-900 text-sm">サンプル店舗</p>
                          </div>
                          <div className="w-6 h-6 bg-slate-200 rounded-full" />
                        </div>
                        {/* トーク画面 */}
                        <div className="bg-[#7494A5] p-4 min-h-[180px]">
                          <div className="flex gap-2">
                            <div className="w-8 h-8 rounded-full bg-white shrink-0 flex items-center justify-center">
                              <div className="w-5 h-5 rounded-full bg-primary-200" />
                            </div>
                            <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm max-w-[80%]">
                              <p className="text-xs text-slate-700">いらっしゃいませ！🎉</p>
                              <p className="text-xs text-slate-700 mt-1">下のメニューからご予約いただけます。</p>
                            </div>
                          </div>
                        </div>
                        {/* リッチメニュー */}
                        <div className="bg-white border-t-2 border-slate-200">
                          <div className="grid grid-cols-2 gap-[2px] p-[2px] bg-slate-200">
                            <div className="bg-gradient-to-br from-primary-50 to-white p-4 flex flex-col items-center justify-center gap-2 min-h-[90px] hover:bg-primary-50 transition-colors cursor-pointer">
                              <div className="bg-primary-100 p-2 rounded-full">
                                <Smartphone className="w-5 h-5 text-primary-600" />
                              </div>
                              <span className="text-xs font-bold text-primary-700">予約する</span>
                            </div>
                            <div className="bg-gradient-to-br from-primary-50 to-white p-4 flex flex-col items-center justify-center gap-2 min-h-[90px] hover:bg-primary-50 transition-colors cursor-pointer">
                              <div className="bg-primary-100 p-2 rounded-full">
                                <MessageCircle className="w-5 h-5 text-primary-600" />
                              </div>
                              <span className="text-xs font-bold text-primary-700">メッセージ入力</span>
                            </div>
                            <div className="bg-gradient-to-br from-primary-50 to-white p-4 flex flex-col items-center justify-center gap-2 min-h-[90px] hover:bg-primary-50 transition-colors cursor-pointer">
                              <div className="bg-primary-100 p-2 rounded-full">
                                <CreditCard className="w-5 h-5 text-primary-600" />
                              </div>
                              <span className="text-xs font-bold text-primary-700">会員証</span>
                            </div>
                            <div className="bg-gradient-to-br from-primary-50 to-white p-4 flex flex-col items-center justify-center gap-2 min-h-[90px] hover:bg-primary-50 transition-colors cursor-pointer">
                              <div className="bg-primary-100 p-2 rounded-full">
                                <Calendar className="w-5 h-5 text-primary-600" />
                              </div>
                              <span className="text-xs font-bold text-primary-700">営業時間</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* 装飾バッジ */}
                    <motion.div 
                      initial={{ scale: 0, rotate: -10 }}
                      whileInView={{ scale: 1, rotate: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3, type: "spring" }}
                      className="absolute -top-4 -right-4 bg-white px-4 py-2 rounded-full shadow-lg border border-slate-100"
                    >
                      <span className="text-sm font-bold text-primary-600">リアルタイム反映!</span>
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 予約ページ編集機能 */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
              <div className="grid lg:grid-cols-2 gap-0">
                {/* 左側：UIプレビュー（モバイルでは下に表示） */}
                <div className="bg-gradient-to-br from-primary-50 to-slate-50 p-8 lg:p-12 flex items-center justify-center order-2 lg:order-1">
                  <div className="relative w-full max-w-[340px]">
                    {/* 予約ページプレビュー */}
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                      {/* ヘッダー */}
                      <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-4 text-center">
                        <h4 className="text-white font-bold">予約フォーム</h4>
                      </div>
                      {/* コンテンツ */}
                      <div className="p-4 space-y-4">
                        {/* 日時選択テーブル */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Calendar className="w-4 h-4 text-primary-600" />
                            <span className="text-sm font-bold text-slate-700">日時を選択</span>
                          </div>
                          {/* 実際の日時選択テーブルUI */}
                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-slate-50">
                                  <th className="p-2 text-slate-500 font-medium border-r border-slate-200">時間</th>
                                  <th className="p-2 text-center border-r border-slate-200">
                                    <div className="text-[10px] text-slate-400">1/7</div>
                                    <div className="font-bold text-slate-700">火</div>
                                  </th>
                                  <th className="p-2 text-center border-r border-slate-200">
                                    <div className="text-[10px] text-slate-400">1/8</div>
                                    <div className="font-bold text-slate-700">水</div>
                                  </th>
                                  <th className="p-2 text-center border-r border-slate-200">
                                    <div className="text-[10px] text-slate-400">1/9</div>
                                    <div className="font-bold text-slate-700">木</div>
                                  </th>
                                  <th className="p-2 text-center">
                                    <div className="text-[10px] text-slate-400">1/10</div>
                                    <div className="font-bold text-slate-700">金</div>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-t border-slate-100">
                                  <td className="p-2 text-slate-600 font-medium border-r border-slate-200 bg-slate-50">10:00</td>
                                  <td className="p-1 text-center border-r border-slate-100">
                                    <span className="inline-block w-7 h-7 leading-7 rounded bg-white border border-slate-200 text-emerald-500 font-bold">◯</span>
                                  </td>
                                  <td className="p-1 text-center border-r border-slate-100">
                                    <span className="inline-block w-7 h-7 leading-7 rounded bg-primary-500 text-white font-bold shadow-md">✓</span>
                                  </td>
                                  <td className="p-1 text-center border-r border-slate-100">
                                    <span className="inline-block w-7 h-7 leading-7 rounded bg-white border border-slate-200 text-emerald-500 font-bold">◯</span>
                                  </td>
                                  <td className="p-1 text-center">
                                    <span className="inline-block w-7 h-7 leading-7 rounded bg-slate-100 text-slate-300 font-bold">×</span>
                                  </td>
                                </tr>
                                <tr className="border-t border-slate-100">
                                  <td className="p-2 text-slate-600 font-medium border-r border-slate-200 bg-slate-50">11:00</td>
                                  <td className="p-1 text-center border-r border-slate-100">
                                    <span className="inline-block w-7 h-7 leading-7 rounded bg-white border border-slate-200 text-emerald-500 font-bold">◯</span>
                                  </td>
                                  <td className="p-1 text-center border-r border-slate-100">
                                    <span className="inline-block w-7 h-7 leading-7 rounded bg-white border border-slate-200 text-emerald-500 font-bold">◯</span>
                                  </td>
                                  <td className="p-1 text-center border-r border-slate-100">
                                    <span className="inline-block w-7 h-7 leading-7 rounded bg-slate-100 text-slate-300 font-bold">×</span>
                                  </td>
                                  <td className="p-1 text-center">
                                    <span className="inline-block w-7 h-7 leading-7 rounded bg-white border border-slate-200 text-emerald-500 font-bold">◯</span>
                                  </td>
                                </tr>
                                <tr className="border-t border-slate-100">
                                  <td className="p-2 text-slate-600 font-medium border-r border-slate-200 bg-slate-50">12:00</td>
                                  <td className="p-1 text-center border-r border-slate-100">
                                    <span className="inline-block w-7 h-7 leading-7 rounded bg-slate-100 text-slate-300 font-bold">×</span>
                                  </td>
                                  <td className="p-1 text-center border-r border-slate-100">
                                    <span className="inline-block w-7 h-7 leading-7 rounded bg-white border border-slate-200 text-emerald-500 font-bold">◯</span>
                                  </td>
                                  <td className="p-1 text-center border-r border-slate-100">
                                    <span className="inline-block w-7 h-7 leading-7 rounded bg-white border border-slate-200 text-emerald-500 font-bold">◯</span>
                                  </td>
                                  <td className="p-1 text-center">
                                    <span className="inline-block w-7 h-7 leading-7 rounded bg-white border border-slate-200 text-emerald-500 font-bold">◯</span>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          {/* 選択中の表示 */}
                          <div className="mt-3 p-2 bg-primary-50 border-2 border-primary-200 rounded-lg text-center">
                            <span className="text-xs text-slate-500">選択中：</span>
                            <span className="text-sm font-bold text-primary-600 ml-1">1月8日(水) 10:00</span>
                          </div>
                        </div>
                        {/* 確定ボタン */}
                        <button className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-primary-200 hover:shadow-xl transition-shadow">
                          次へ進む
                        </button>
                      </div>
                    </div>
                    {/* 装飾 */}
                    <motion.div 
                      initial={{ scale: 0, rotate: 10 }}
                      whileInView={{ scale: 1, rotate: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3, type: "spring" }}
                      className="absolute -bottom-4 -left-4 bg-white px-4 py-2 rounded-full shadow-lg border border-slate-100"
                    >
                      <span className="text-sm font-bold text-primary-600">テーマ選択可能!</span>
                    </motion.div>
                  </div>
                </div>
                
                {/* 右側：機能説明 */}
                <div className="p-8 lg:p-12 flex flex-col justify-center order-1 lg:order-2">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-3 rounded-2xl shadow-lg shadow-primary-200">
                      <Palette className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">予約ページ編集</h3>
                      <p className="text-sm text-slate-500">予約フォームを自由にカスタマイズ</p>
                    </div>
                  </div>
                  
                  <p className="text-slate-600 mb-8 leading-relaxed">
                    お客様が予約するページのデザインと機能を、あなたの店舗スタイルに合わせて設定。<br />
                    業種ごとに最適化された予約フローを提供できます。
                  </p>
                  
                  {/* アピールポイント */}
                  <div className="grid sm:grid-cols-2 gap-4 mb-8">
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                      <div className="bg-primary-100 p-2 rounded-lg shrink-0">
                        <Palette className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                          6種類のテーマ
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-bold flex items-center gap-0.5">
                            <Crown className="w-3 h-3" />Pro
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">シンプルは無料、他5種はPro</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                      <div className="bg-primary-100 p-2 rounded-lg shrink-0">
                        <Clock className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">営業時間設定</p>
                        <p className="text-xs text-slate-500 mt-0.5">曜日ごと・臨時休業も対応</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                      <div className="bg-primary-100 p-2 rounded-lg shrink-0">
                        <Users className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">スタッフ・メニュー管理</p>
                        <p className="text-xs text-slate-500 mt-0.5">サロン・飲食店向け機能</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                      <div className="bg-primary-100 p-2 rounded-lg shrink-0">
                        <Smartphone className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">リアルタイムプレビュー</p>
                        <p className="text-xs text-slate-500 mt-0.5">編集しながら即確認</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '営業時間設定', pro: false },
                      { label: 'スタッフ管理', pro: false },
                      { label: 'テーマカラー変更', pro: true },
                      { label: 'ロゴ設定', pro: true },
                      { label: 'Googleカレンダー連携', pro: true },
                    ].map((tag) => (
                      <span key={tag.label} className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${tag.pro ? 'bg-amber-50 text-amber-700' : 'bg-primary-50 text-primary-700'}`}>
                        {tag.label}
                        {tag.pro && <Crown className="w-3 h-3" />}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-16"
          >
            <a 
              href="#auth" 
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary-600 text-white rounded-full font-bold hover:bg-primary-700 transition shadow-lg hover:shadow-xl group"
            >
              無料で始める
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <p className="text-slate-500 text-sm mt-4">
              専門知識不要で簡単に始められます
            </p>
          </motion.div>
        </div>
      </section>

      {/* Onboarding Steps Section - 導入の流れ */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-primary-50/30 blur-3xl"></div>
          <div className="absolute bottom-[20%] left-[10%] w-[40%] h-[40%] rounded-full bg-emerald-50/30 blur-3xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-block"
            >
              <span className="inline-block px-4 py-1.5 mb-4 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-sm font-semibold">
                簡単3ステップ
              </span>
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4"
            >
              始めるまでたった3ステップ
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-slate-600 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed"
            >
              専門知識不要。最短3分で設定完了。<br className="hidden md:block" />
              すぐに運用を始められます。
            </motion.p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: 1,
                title: '無料アカウント作成',
                description: 'メールアドレスとパスワードを入力するだけ。認証コードで本人確認を済ませます。',
                time: '約3分',
                icon: Users
              },
              {
                step: 2,
                title: 'LINE公式アカウントと連携',
                description: 'LINE公式アカウントの設定情報を入力。ワンクリックで連携完了です。',
                time: '約5分',
                icon: MessageCircle
              },
              {
                step: 3,
                title: '設定完了、運用開始！',
                description: '予約枠や応答ルールを設定すれば、すぐに運用を開始できます。',
                time: '約10分',
                icon: Check
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="relative"
              >
                <div className="bg-slate-50 rounded-2xl p-8 hover:bg-white hover:shadow-lg transition-all border border-slate-100 h-full">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-16 h-16 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-xl relative z-10">
                      {item.step}
                    </div>
                    {index < 2 && (
                      <div className="hidden md:block absolute left-full top-1/2 -translate-y-1/2 w-8 h-0.5 bg-primary-200 z-0" style={{ marginLeft: '-1rem' }}>
                        <ArrowRight className="w-4 h-4 text-primary-400 absolute right-0 top-1/2 -translate-y-1/2" />
                      </div>
                    )}
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6 text-primary-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                  <p className="text-slate-600 leading-relaxed mb-4">{item.description}</p>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Clock className="w-4 h-4" />
                    <span>{item.time}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <a 
              href="#auth" 
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary-600 text-white rounded-full font-bold hover:bg-primary-700 transition shadow-lg hover:shadow-xl group"
            >
              今すぐ無料で始める
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section - お客様の声 */}
      <section className="py-24 bg-slate-50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-primary-50/50 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-gradient-to-tr from-emerald-50/50 to-transparent rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-block"
            >
              <span className="inline-block px-4 py-1.5 mb-4 rounded-full bg-primary-100 border border-primary-200 text-primary-700 text-sm font-semibold">
                導入事例
              </span>
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4"
            >
              お客様の声
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-slate-600 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed"
            >
              実際にIToguchiをご利用いただいているお客様の声をご紹介します。
            </motion.p>
          </div>

          {/* Coming Soon プレースホルダー */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-3xl p-12 border-2 border-dashed border-slate-200 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-6">
              <Star className="w-10 h-10 text-primary-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">導入事例を募集中</h3>
            <p className="text-slate-600 mb-6">
              IToguchi をご利用いただいているお客様の声を、<br className="hidden md:block" />
              順次掲載予定です。
            </p>
            <a 
              href="#campaign" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-full font-bold hover:bg-primary-700 transition shadow-md hover:shadow-lg text-sm"
            >
              リリース記念キャンペーンを見る
              <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* Pre-Release Monitor Section（非表示・参照用にコード保持） */}
      {false && (
      <section id="pre-release" className="py-20 bg-linear-to-br from-primary-600 to-primary-800 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20">
          <div className="absolute -top-[50%] -left-[20%] w-[100%] h-[100%] rounded-full bg-white blur-3xl"></div>
          <div className="absolute bottom-[10%] right-[10%] w-[60%] h-[60%] rounded-full bg-primary-300 blur-3xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-bold mb-4 border border-white/30"
            >
              <Sparkles className="w-4 h-4" />
              先行体験モニター募集中
              <Sparkles className="w-4 h-4" />
            </motion.div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              プレリリースモニター募集
            </h2>
            <p className="text-primary-100 text-lg max-w-2xl mx-auto">
              正式リリース前の今だけ！<br className="hidden md:block" />
              <span className="font-bold text-yellow-300">Proプラン2ヶ月無料</span>で先行体験できます。
            </p>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
              <div className="text-center mb-8">
                <div className="bg-white text-primary-700 text-sm font-bold px-4 py-2 rounded-full inline-block mb-4">
                  🎁 プレリリース限定特典
                </div>
                <div className="text-5xl md:text-6xl font-bold mb-2 text-yellow-300">
                  2ヶ月無料
                </div>
                <p className="text-primary-100">
                  Proプラン（通常 ¥4,980/月）が無料で使えます
                </p>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-yellow-300 shrink-0 mt-0.5" />
                  <span className="text-lg">Proプランの全機能を<span className="font-bold text-yellow-300">2ヶ月間無料</span>で利用可能</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-yellow-300 shrink-0 mt-0.5" />
                  <span className="text-lg">ご登録いただいた<span className="font-bold text-yellow-300">データはそのまま継続</span>利用可能</span>
                </li>
              </ul>

              {/* 注意事項 */}
              <div className="bg-primary-900/30 border border-primary-300/30 rounded-xl p-4 mb-8">
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

              <a href="#auth" className="block w-full py-4 bg-white text-primary-700 rounded-xl font-bold text-center text-lg hover:bg-primary-50 transition shadow-lg hover:shadow-xl">
                無料でモニター登録する
              </a>
              
              <p className="text-center text-primary-200 text-sm mt-4">
                ※ 簡単なフィードバックへのご協力をお願いする場合があります
              </p>
            </div>
          </motion.div>
        </div>
      </section>
      )}

      {/* Campaign Section - リリース記念（Pro 30日間無料） */}
      <section id="campaign" className="py-20 bg-linear-to-br from-primary-600 to-primary-800 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20">
          <div className="absolute -top-[50%] -left-[20%] w-[100%] h-[100%] rounded-full bg-white blur-3xl"></div>
          <div className="absolute bottom-[10%] right-[10%] w-[60%] h-[60%] rounded-full bg-primary-300 blur-3xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm font-bold mb-4 border border-white/30">
              リリース記念キャンペーン
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              Proプラン 30日間無料
            </h2>
            <p className="text-primary-100 text-lg max-w-2xl mx-auto">
              初回お申し込みの方は、Proプラン（通常 ¥4,980/月）を<span className="font-bold text-yellow-300">30日間</span>無料でお試しいただけます。
            </p>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-xl mx-auto"
          >
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 md:p-10 border border-white/20 text-center">
              <div className="text-5xl md:text-6xl font-bold text-yellow-300 mb-4">30日間無料</div>
              <ul className="space-y-4 mb-8 text-left max-w-md mx-auto">
                <li className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-yellow-300 shrink-0 mt-0.5" />
                  <span className="text-lg">Proプランの全機能を<span className="font-bold text-yellow-300">30日間</span>お試し</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-yellow-300 shrink-0 mt-0.5" />
                  <span className="text-lg">ご登録データはそのまま<span className="font-bold text-yellow-300">継続利用</span>可能</span>
                </li>
              </ul>
              <a href="#auth" className="inline-block w-full max-w-sm py-4 bg-white text-primary-700 rounded-xl font-bold text-lg hover:bg-primary-50 transition shadow-lg">
                無料で始める
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">料金プラン</h2>
            <p className="text-slate-600">
              ビジネスの成長に合わせて選べる、<br />透明性の高いプラン設定。
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Plan */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col"
            >
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
              <a href="#auth" className="block w-full py-3 px-6 text-center bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition">
                無料で始める
              </a>
            </motion.div>

            {/* Pro Plan */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-white p-8 rounded-3xl shadow-xl border-2 border-primary-500 relative flex flex-col transform md:-translate-y-4"
            >
              <div className="absolute top-0 right-0 bg-primary-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl rounded-tr-2xl">
                おすすめ
              </div>
              <div className="mb-4">
                <span className="px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-xs font-bold uppercase tracking-wider">Standard</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Pro</h3>
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
              <a href="#auth" className="block w-full py-3 px-6 text-center bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition shadow-lg shadow-primary-200">
                Proプランを選択
              </a>
            </motion.div>

            {/* Executive Plan */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col"
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
              <a href="mailto:contact@example.com" className="block w-full py-3 px-6 text-center bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition">
                お問い合わせ
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-primary-50/30 blur-3xl"></div>
          <div className="absolute bottom-[20%] left-[10%] w-[40%] h-[40%] rounded-full bg-emerald-50/30 blur-3xl"></div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-block"
            >
              <span className="inline-block px-4 py-1.5 mb-4 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-sm font-semibold">
                FAQ
              </span>
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4"
            >
              よくある質問
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-slate-600 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed"
            >
              検討中のよくあるご質問にお答えします。
            </motion.p>
          </div>

          <div className="space-y-4">
            {[
              {
                question: '専門知識がなくても設定できますか？',
                answer: 'はい、専門知識は一切不要です。IToguchiはNo-Code設計のため、プログラミングの知識がなくても直感的な操作で設定できます。管理画面のガイドに従って進めるだけで、最短3分で設定完了です。'
              },
              {
                question: 'LINE公式アカウントを持っていなくても始められますか？',
                answer: 'いいえ、LINE公式アカウントが必要です。IToguchiはLINE公式アカウントと連携して動作するサービスです。まだお持ちでない場合は、LINE公式アカウントの開設から始めてください。開設は無料です。'
              },
              {
                question: '無料プランでどこまで使えますか？',
                answer: '無料プランでも予約管理（無制限）、キーワード応答（10件まで）、ポイントカード基本機能が使えます。Proプランにアップグレードすると、Googleカレンダー連携、AI自動応答、デジタル会員証のカスタマイズなど、全機能が使えるようになります。'
              },
              {
                question: 'データは安全ですか？',
                answer: 'はい、安全です。IToguchiはSupabase（PostgreSQL）による堅牢なデータ管理、SSL/TLS暗号化通信、Row Level Security（RLS）によるデータ分離を実装しています。お客様のデータは厳重に保護されています。'
              },
              {
                question: '解約はいつでもできますか？',
                answer: 'はい、いつでも解約可能です。解約は管理画面から簡単に行えます。解約後もデータは一定期間保持されますので、再開時にスムーズに復帰できます。'
              }
            ].map((faq, index) => (
              <FAQItem key={index} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA Section */}
      <section className="py-20 bg-linear-to-br from-primary-50 to-emerald-50 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-30">
          <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-primary-200 blur-3xl"></div>
          <div className="absolute bottom-[20%] left-[10%] w-[40%] h-[40%] rounded-full bg-emerald-200 blur-3xl"></div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-slate-100 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-8 h-8 text-primary-600" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
              ご質問がありますか？
            </h2>
            <p className="text-slate-600 mb-8 max-w-2xl mx-auto">
              LINE公式アカウントで気軽にお問い合わせください。<br className="hidden md:block" />
              お客様のご質問にお答えします。
            </p>
            <a 
              href="https://line.me/R/ti/p/@431cghfd" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#06C755] text-white rounded-full font-bold hover:bg-[#05B048] transition shadow-lg hover:shadow-xl group"
            >
              <MessageSquare className="w-5 h-5" />
              LINEでお問い合わせ
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* Auth Section */}
      <section id="auth" className="py-24 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-primary-50/50 -skew-y-3 transform origin-top-left scale-110"></div>
        
        <div className="max-w-md mx-auto px-4 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white p-10 rounded-3xl shadow-2xl border border-slate-100"
          >
            <div className="flex justify-center mb-8">
              <div className="bg-slate-100 p-1 rounded-xl inline-flex">
                <button
                  className={`py-2 px-6 rounded-lg text-sm font-bold transition-all ${isLoginMode ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setIsLoginMode(true)}
                >
                  ログイン
                </button>
                <button
                  className={`py-2 px-6 rounded-lg text-sm font-bold transition-all ${!isLoginMode ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setIsLoginMode(false)}
                >
                  新規登録
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center mb-8">
              <img src={iconImage} alt="IToguchi" className="h-16 w-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900">
                {showVerificationStep ? '認証コードを入力' : isLoginMode ? 'おかえりなさい' : 'を始める'}
              </h2>
              <p className="text-slate-500 mt-2 text-center text-sm">
                {showVerificationStep 
                  ? <>{email}<br />に送信された6桁のコードを入力してください</>
                  : isLoginMode ? 'アカウントにログインして管理を続けましょう' : 'まずは無料で、新しい繋がりを作りましょう'}
              </p>
            </div>
            
            {showVerificationStep ? (
              /* 認証コード入力フォーム */
              <form onSubmit={handleVerifyCode} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">認証コード</label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setVerificationCode(value)
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white text-center text-2xl tracking-widest font-bold"
                    placeholder="000000"
                    required
                    maxLength={6}
                    pattern="\d{6}"
                    autoFocus
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    コードが届いていませんか？
                    {resendCooldown > 0 ? (
                      <span className="text-slate-400 ml-1">({resendCooldown}秒後に再送信可能)</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={loading}
                        className="text-primary-600 hover:text-primary-700 font-medium ml-1 disabled:opacity-50"
                      >
                        再送信
                      </button>
                    )}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full bg-primary-600 text-white py-3.5 rounded-xl font-bold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-200 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      確認中...
                    </>
                  ) : (
                    '確認して次へ'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowVerificationStep(false)
                    setVerificationCode('')
                  }}
                  className="w-full text-slate-600 hover:text-slate-800 text-sm"
                >
                  ← 戻る
                </button>
              </form>
            ) : (
              /* 通常のログイン/サインアップフォーム */
            <form onSubmit={handleAuth} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">メールアドレス</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white"
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">パスワード</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white pr-10"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {!isLoginMode && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">パスワード（確認）</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-slate-50 focus:bg-white pr-10"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              )}

              {!isLoginMode && (
                <div className="space-y-3 mt-4">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-1 w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500 cursor-pointer"
                      required
                    />
                    <span className="text-sm text-slate-600 leading-relaxed">
                      <Link 
                        to="/terms" 
                        target="_blank"
                        className="text-primary-600 hover:text-primary-700 underline font-medium"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.scrollTo(0, 0)
                        }}
                      >
                        利用規約
                      </Link>
                      に同意します
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={agreedToPrivacy}
                      onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                      className="mt-1 w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500 cursor-pointer"
                      required
                    />
                    <span className="text-sm text-slate-600 leading-relaxed">
                      <Link 
                        to="/privacy" 
                        target="_blank"
                        className="text-primary-600 hover:text-primary-700 underline font-medium"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.scrollTo(0, 0)
                        }}
                      >
                        プライバシーポリシー
                      </Link>
                      に同意します
                    </span>
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (!isLoginMode && (!agreedToTerms || !agreedToPrivacy))}
                className="w-full bg-primary-600 text-white py-3.5 rounded-xl font-bold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-200 mt-2 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    処理中...
                  </>
                ) : (
                  isLoginMode ? 'ログイン' : 'アカウント作成'
                )}
              </button>
            </form>
            )}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl font-bold text-white tracking-tight">IToguchi</span>
              </div>
              <p className="text-slate-400 max-w-sm leading-relaxed">
                お店とお客様を繋ぐ、確かな糸ぐち。<br />
                LINE運用の自動化で、業務効率化と売上アップを実現します。
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-6">サービス</h4>
              <ul className="space-y-4">
                <li><a href="#features" className="hover:text-white transition">機能一覧</a></li>
                <li><a href="#pricing" className="hover:text-white transition">料金プラン</a></li>
                <li><a href="#" className="hover:text-white transition">導入事例</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-6">サポート</h4>
              <ul className="space-y-4">
                <li><a href="https://line.me/R/ti/p/@431cghfd" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">お問い合わせ</a></li>
                <li>
                  <Link 
                    to="/terms" 
                    className="hover:text-white transition"
                    onClick={() => window.scrollTo(0, 0)}
                  >
                    利用規約
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/privacy" 
                    className="hover:text-white transition"
                    onClick={() => window.scrollTo(0, 0)}
                  >
                    プライバシーポリシー
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/specified-commercial-transactions" 
                    className="hover:text-white transition"
                    onClick={() => window.scrollTo(0, 0)}
                  >
                    特定商取引法に基づく表記
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/security" 
                    className="hover:text-white transition"
                    onClick={() => window.scrollTo(0, 0)}
                  >
                    セキュリティポリシー
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-16 pt-8 text-center text-slate-500 text-sm">
            © 2025 IToguchi. All rights reserved.
          </div>
        </div>
      </footer>

      {toast && (
        <Toast
          isVisible={true}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
