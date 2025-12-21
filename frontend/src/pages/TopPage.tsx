import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { motion } from 'framer-motion'
import { MessageCircle, Calendar, CreditCard, ArrowRight, Check, Eye, EyeOff } from 'lucide-react'
import topHeroImage from '../assets/top_hero.jpg'
import smartAutoChatImage from '../assets/smartautochat.jpg'
import iconImage from '../assets/icon.png'

export default function TopPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [loading, setLoading] = useState(false)

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
          alert('パスワードが一致しません。')
          return
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        alert('アカウントを作成しました。ログインしてください。')
        setIsLoginMode(true)
      }
    } catch (error: any) {
      console.error('Auth error:', error)
      alert(error.message || 'エラーが発生しました。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md fixed w-full z-50 border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <img src={iconImage} alt="IToguchi" className="h-10 w-auto" />
            </div>
            <nav className="hidden md:flex space-x-8 items-center">
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition">機能</a>
              <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition">料金</a>
              <a href="#auth" className="px-5 py-2.5 bg-indigo-600 text-white rounded-full text-sm font-medium hover:bg-indigo-700 transition shadow-md hover:shadow-lg">
                ログイン / 登録
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-40 pb-24 lg:pt-48 lg:pb-32 overflow-hidden relative">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-indigo-50/50 blur-3xl"></div>
          <div className="absolute top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-50/50 blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="lg:w-1/2 text-left"
            >
              <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-sm sm:text-base font-semibold tracking-wide whitespace-nowrap sm:whitespace-normal">
                誰でも簡単、気軽に始めるLINEマーケティング
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-8 leading-[1.15] tracking-tight">
                <span className="block lg:whitespace-nowrap">お店とお客様をつなぐ、</span>
                <span className="text-indigo-700 block lg:whitespace-nowrap">たしかな糸ぐち。</span>
              </h1>
              <p className="text-base sm:text-lg text-slate-600 mb-10 max-w-2xl leading-relaxed">
                LINE公式アカウントが、あなたの代わりにお客様対応。<br />
                質問への自動返信、予約の受付、ポイントカードの管理まで。<br />
                スマホひとつで、お店のファン作りをサポートします。
              </p>
              <div className="flex flex-col sm:flex-row justify-start gap-4">
                <a href="#auth" className="px-8 py-4 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 transition shadow-lg hover:shadow-indigo-200 flex items-center justify-center gap-2 group">
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
              
              {/* Badge 1: Auto Response (Bottom Left) */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="absolute -bottom-6 -left-6 bg-white p-4 lg:p-6 rounded-2xl shadow-xl border border-slate-100 hidden md:block"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-green-100 p-3 rounded-full">
                    <MessageCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">自動応答率</p>
                    <p className="text-2xl font-bold text-slate-900">98%</p>
                  </div>
                </div>
              </motion.div>

              {/* Badge 2: Reservation (Top Right) */}
              <motion.div 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="absolute -top-6 -right-6 bg-white p-4 lg:p-6 rounded-2xl shadow-xl border border-slate-100 hidden md:block"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 p-3 rounded-full">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">予約受付</p>
                    <p className="text-2xl font-bold text-slate-900">24h</p>
                  </div>
                </div>
              </motion.div>

              {/* Badge 3: Membership (Bottom Right - slightly offset) */}
              <motion.div 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="absolute -bottom-6 -right-6 bg-white p-4 lg:p-6 rounded-2xl shadow-xl border border-slate-100 hidden md:block"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-orange-100 p-3 rounded-full">
                    <CreditCard className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">会員証</p>
                    <p className="text-xl font-bold text-slate-900">デジタル化</p>
                  </div>
                </div>
              </motion.div>

            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              繋がりを深める、3つの機能
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              IToguchiは、店舗運営に必要な機能をシンプルに統合。<br />
              お客様とのコミュニケーションを円滑にします。
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { 
                image: smartAutoChatImage, 
                title: 'スマート自動応答', 
                desc: 'よくある質問にはAIが即座に対応。お客様をお待たせすることなく、機会損失を防ぎます。' 
              },
              { 
                image: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=500&q=60', 
                title: 'かんたん予約管理', 
                desc: 'LINEのトーク画面からそのまま予約完了。電話対応の手間を減らし、予約のハードルを下げます。' 
              },
              { 
                image: 'https://images.unsplash.com/photo-1556742111-a301076d9d18?auto=format&fit=crop&w=500&q=60', 
                title: 'デジタル会員証', 
                desc: 'お財布を圧迫しないLINE上の会員証。ポイント管理もスムーズで、リピート率向上に貢献します。' 
              }
            ].map((feature, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="group bg-slate-50 rounded-3xl overflow-hidden hover:bg-white hover:shadow-xl transition-all duration-300 border border-slate-100"
              >
                <div className="h-56 overflow-hidden relative">
                  <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors z-10"></div>
                  <img src={feature.image} alt={feature.title} className="w-full h-full object-cover transform group-hover:scale-105 transition duration-700" />
                </div>
                <div className="p-8">
                  <h3 className="text-xl font-bold mb-3 text-slate-900">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
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
                  '1アカウント連携',
                  '固定応答 10件',
                  '予約・ポイント基本機能'
                ].map((item, i) => (
                  <li key={i} className="flex items-center text-slate-600">
                    <Check className="w-5 h-5 text-indigo-500 mr-3 shrink-0" />
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
              className="bg-white p-8 rounded-3xl shadow-xl border-2 border-indigo-500 relative flex flex-col transform md:-translate-y-4"
            >
              <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl rounded-tr-2xl">
                おすすめ
              </div>
              <div className="mb-4">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-wider">Standard</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Pro</h3>
              <div className="flex items-baseline mb-8">
                <span className="text-4xl font-bold text-slate-900">¥5,000</span>
                <span className="text-slate-500 ml-2">/月〜</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  '無制限応答',
                  'AI応答機能',
                  '詳細分析レポート',
                  '優先サポート'
                ].map((item, i) => (
                  <li key={i} className="flex items-center text-slate-700 font-medium">
                    <Check className="w-5 h-5 text-indigo-600 mr-3 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <a href="#auth" className="block w-full py-3 px-6 text-center bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
                Proプランを選択
              </a>
            </motion.div>

            {/* Enterprise Plan */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col"
            >
              <div className="mb-4">
                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-wider">Business</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Enterprise</h3>
              <div className="flex items-baseline mb-8">
                <span className="text-3xl font-bold text-slate-900">要相談</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  '独自ドメイン',
                  '個別カスタマイズ開発',
                  'スタッフ連携機能',
                  '専任担当者サポート'
                ].map((item, i) => (
                  <li key={i} className="flex items-center text-slate-600">
                    <Check className="w-5 h-5 text-indigo-500 mr-3 shrink-0" />
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

      {/* Auth Section */}
      <section id="auth" className="py-24 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-indigo-50/50 -skew-y-3 transform origin-top-left scale-110"></div>
        
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
                  className={`py-2 px-6 rounded-lg text-sm font-bold transition-all ${isLoginMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setIsLoginMode(true)}
                >
                  ログイン
                </button>
                <button
                  className={`py-2 px-6 rounded-lg text-sm font-bold transition-all ${!isLoginMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setIsLoginMode(false)}
                >
                  新規登録
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center mb-8">
              <img src={iconImage} alt="IToguchi" className="h-16 w-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900">
                {isLoginMode ? 'おかえりなさい' : 'IToguchiを始める'}
              </h2>
              <p className="text-slate-500 mt-2 text-center text-sm">
                {isLoginMode ? 'アカウントにログインして管理を続けましょう' : 'まずは無料で、新しい繋がりを作りましょう'}
              </p>
            </div>
            
            <form onSubmit={handleAuth} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">メールアドレス</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-slate-50 focus:bg-white"
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
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-slate-50 focus:bg-white pr-10"
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
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-slate-50 focus:bg-white pr-10"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 mt-2"
              >
                {loading ? '処理中...' : (isLoginMode ? 'ログイン' : 'アカウント作成')}
              </button>
            </form>
            {!isLoginMode && (
              <p className="mt-6 text-xs text-center text-slate-400 leading-relaxed">
                登録することで、<a href="#" className="underline hover:text-indigo-600">利用規約</a>と<a href="#" className="underline hover:text-indigo-600">プライバシーポリシー</a>に同意したことになります。
              </p>
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
                <li><a href="#" className="hover:text-white transition">ヘルプセンター</a></li>
                <li><a href="#" className="hover:text-white transition">お問い合わせ</a></li>
                <li><a href="#" className="hover:text-white transition">利用規約</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-16 pt-8 text-center text-slate-500 text-sm">
            © 2025 IToguchi. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
