import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CreditCard, ArrowLeft, ArrowRight, Check, QrCode, Gift, Crown, Stamp, Palette, Award } from 'lucide-react'
import membersImage from '../assets/members.png'
import iconImage from '../assets/icon.png'

// Mock data for preview
const mockCustomer = {
  display_name: '山田 太郎',
  points: 1250,
  member_no: 'ABC12345',
  rank: 'Gold'
}

// Card Template Component - Matches MemberCardLIFF.tsx exactly
function MemberCardPreview({ template, color = '#00c3dc', title = "MEMBER'S CARD" }: { 
  template: 'simple' | 'dark' | 'elegant' | 'pop'
  color?: string
  title?: string
}) {
  const getCardStyle = () => {
    const base = "w-full max-w-sm min-h-[220px] rounded-xl shadow-xl p-4 relative overflow-hidden transition-all duration-300 flex flex-col"
    switch (template) {
      case 'simple': return `${base} text-gray-800 border border-gray-100 bg-white`
      case 'elegant': return `${base} text-[#44403C] border border-[#E7E5E4] bg-white`
      case 'pop': return `${base} text-gray-800 border-2 border-white bg-white`
      case 'dark': return `${base} text-slate-200 border border-slate-700 bg-slate-900`
      default: return `${base} text-white`
    }
  }

  return (
    <div className={getCardStyle()}>
      {/* Background Accents */}
      {template === 'simple' && (
        <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: color }}></div>
      )}
      {template === 'elegant' && (
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#44403C 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      )}
      {template === 'pop' && (
        <>
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-200 rounded-bl-full opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-primary-200 rounded-tr-full opacity-50"></div>
        </>
      )}
      {template === 'dark' && (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]"></div>
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-slate-800/50 to-transparent"></div>
        </>
      )}

      {/* Card Content */}
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex justify-between items-start">
          <h3 className={`font-bold text-lg tracking-wider ${template === 'elegant' ? 'font-serif' : ''}`}>
            {title}
          </h3>
        </div>
        
        <div className="flex-1 flex flex-col justify-end space-y-4 pb-2">
          <div className="flex justify-between items-end">
            <div>
              <p className={`text-xs mb-1 ${template === 'pop' ? 'opacity-75' : 'opacity-60'}`}>MEMBER NAME</p>
              <p className={`font-medium tracking-wide ${template === 'elegant' ? 'font-serif' : ''}`}>
                {mockCustomer.display_name}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-xs mb-1 ${template === 'pop' ? 'opacity-75' : 'opacity-60'}`}>POINTS</p>
              <p className={`text-2xl font-bold ${template === 'pop' ? 'text-primary-600' : template === 'elegant' ? 'font-serif' : ''}`}>
                {mockCustomer.points.toLocaleString()} pt
              </p>
            </div>
          </div>
          
          <div className={`pt-2 border-t flex justify-between text-xs ${
            template === 'simple' ? 'border-gray-100 text-gray-400' :
            template === 'elegant' ? 'border-[#E7E5E4]' :
            template === 'pop' ? 'border-gray-100 text-gray-500' :
            'border-slate-700 text-slate-500'
          }`}>
            <span>No. {mockCustomer.member_no}</span>
            <span>Rank: {mockCustomer.rank}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Stamp Card Preview Component - Matches MemberCardLIFF.tsx exactly
function StampCardPreview({ template, color = '#00c3dc' }: { 
  template: 'simple' | 'dark' | 'elegant' | 'pop'
  color?: string
}) {
  const stampCount = 7
  const totalSlots = 10

  const getCardStyle = () => {
    const base = "w-full max-w-sm min-h-[220px] rounded-xl shadow-xl p-4 relative overflow-hidden transition-all duration-300 flex flex-col"
    switch (template) {
      case 'simple': return `${base} text-gray-800 border border-gray-100 bg-white`
      case 'elegant': return `${base} text-[#44403C] border border-[#E7E5E4] bg-white`
      case 'pop': return `${base} text-gray-800 border-2 border-white bg-white`
      case 'dark': return `${base} text-slate-200 border border-slate-700 bg-slate-900`
      default: return `${base} text-white`
    }
  }

  const getStampStyle = (filled: boolean) => {
    if (!filled) {
      switch (template) {
        case 'dark': return 'border-slate-700 text-slate-700'
        default: return 'border-gray-200 text-gray-300'
      }
    }
    switch (template) {
      case 'pop': return 'border-primary-500 text-primary-500 bg-primary-50'
      case 'dark': return 'border-current opacity-80'
      case 'elegant': return 'border-current opacity-80'
      default: return 'border-current opacity-80'
    }
  }
  
  return (
    <div className={getCardStyle()}>
      {/* Background Accents */}
      {template === 'simple' && (
        <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: color }}></div>
      )}
      {template === 'elegant' && (
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#44403C 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      )}
      {template === 'pop' && (
        <>
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-200 rounded-bl-full opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-primary-200 rounded-tr-full opacity-50"></div>
        </>
      )}
      {template === 'dark' && (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]"></div>
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-slate-800/50 to-transparent"></div>
        </>
      )}
      
      <div className="relative z-10 flex flex-col h-full justify-between">
        <h3 className={`font-bold text-lg tracking-wider ${template === 'elegant' ? 'font-serif' : ''}`}>STAMP CARD</h3>
        
        <div className="flex-1 flex flex-col justify-between py-1">
          <div className="grid grid-cols-5 gap-1 px-8">
            {Array.from({ length: totalSlots }).map((_, i) => (
              <div 
                key={i} 
                className={`aspect-square rounded-full border flex items-center justify-center text-[8px] ${getStampStyle(i < stampCount)}`}
              >
                {i < stampCount ? <Stamp className="w-2.5 h-2.5" /> : i + 1}
              </div>
            ))}
          </div>
          
          <div className="space-y-0.5 mt-auto">
            <div className={`text-right text-[10px] ${template === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
              あと {totalSlots - stampCount} 個で 特典チケット
            </div>

            <div className="flex justify-between items-end border-t pt-1 border-dashed border-gray-300/30">
              <div>
                <p className={`text-[8px] mb-0.5 ${template === 'pop' ? 'opacity-75' : 'opacity-60'}`}>MEMBER NAME</p>
                <p className={`font-medium text-xs tracking-wide ${template === 'elegant' ? 'font-serif' : ''}`}>
                  {mockCustomer.display_name}
                </p>
              </div>
            </div>
            
            <div className={`flex justify-between text-[10px] mt-1 flex-shrink-0 ${
              template === 'simple' ? 'text-gray-500' :
              template === 'elegant' ? 'text-[#44403C]/80' :
              template === 'pop' ? 'text-gray-600' :
              'text-slate-400'
            }`}>
              <span>No. {mockCustomer.member_no}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FeatureMembership() {
  const location = useLocation()

  // Scroll to top on navigation
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md fixed w-full z-50 border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center gap-3">
              <img src={iconImage} alt="IToguchi" className="h-10 md:h-16 w-auto" />
            </Link>
            <nav className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary-600 transition">
                <ArrowLeft className="w-4 h-4" />
                トップに戻る
              </Link>
              <Link to="/" state={{ scrollTo: 'auth' }} className="px-5 py-2.5 bg-primary-600 text-white rounded-full text-sm font-medium hover:bg-primary-700 transition shadow-md hover:shadow-lg">
                無料で始める
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-24 overflow-hidden relative px-4">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-primary-50/50 blur-3xl"></div>
          <div className="absolute top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary-50/50 blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="lg:w-1/2 text-left w-full"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-primary-50 border border-primary-100 text-primary-600 text-sm font-semibold">
                <CreditCard className="w-4 h-4" />
                デジタル会員証
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-slate-900 mb-4 sm:mb-6 leading-[1.15] tracking-tight">
                紙のカードは<br />
                <span className="text-primary-600">もう不要です</span>
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-slate-600 mb-6 sm:mb-8 max-w-2xl leading-relaxed">
                LINEがそのままデジタル会員証に。
                ポイント管理もスタンプカードも、お客様のスマホで完結。
                「財布にカードが入らない」はもう言わせません。
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Link to="/" state={{ scrollTo: 'auth' }} className="px-6 sm:px-8 py-3 sm:py-4 bg-primary-600 text-white rounded-full font-bold hover:bg-primary-700 transition shadow-lg hover:shadow-primary-200 flex items-center justify-center gap-2 group text-sm sm:text-base">
                  無料で始める
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:w-1/2 relative"
            >
              <div className="relative">
                <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
                  <img 
                    src={membersImage}
                    alt="デジタル会員証" 
                    className="w-full h-auto object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent"></div>
                </div>
                {/* Stats Badge - Positioned to overlap top-left corner of image */}
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="absolute -top-4 -left-4 bg-white/95 backdrop-blur-sm p-3 lg:p-4 rounded-xl shadow-lg border border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-primary-100 p-2 rounded-full">
                      <QrCode className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">ポイント付与</p>
                      <p className="text-lg font-bold text-slate-900">QRで即時</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Free vs Pro Comparison */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              Free と Pro の違い
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              無料プランでも基本的なポイントカード機能は使い放題。
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-slate-50 rounded-3xl p-8 border border-slate-200"
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 bg-slate-200 text-slate-700 rounded-full text-xs font-bold">Free</span>
                <h3 className="text-xl font-bold text-slate-900">基本ポイントカード</h3>
              </div>
              <ul className="space-y-4 mb-6">
                {[
                  'ポイント / スタンプ管理',
                  'QRコードで付与・消費',
                  '会員証表示（シンプル）',
                  '会員番号の表示',
                  'LINE名での表示'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-600">
                    <Check className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="text-center pt-4 border-t border-slate-200">
                <span className="text-3xl font-bold text-slate-900">¥0</span>
                <span className="text-slate-500">/月</span>
              </div>
            </motion.div>

            {/* Pro Plan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-primary-50 rounded-3xl p-8 border-2 border-primary-500 relative"
            >
              <div className="absolute -top-3 right-6 px-3 py-1 bg-primary-600 text-white text-xs font-bold rounded-full">
                おすすめ
              </div>
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 bg-primary-600 text-white rounded-full text-xs font-bold flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Pro
                </span>
                <h3 className="text-xl font-bold text-slate-900">カスタマイズ</h3>
              </div>
              <ul className="space-y-4 mb-6">
                {[
                  'Freeの全機能',
                  'カードテンプレート選択',
                  'ブランドカラー設定',
                  'ロゴ画像のアップロード',
                  'ランク機能（Bronze/Silver/Gold）',
                  'カスタムタイトル設定'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700 font-medium">
                    <Check className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="text-center pt-4 border-t border-primary-200">
                <span className="text-3xl font-bold text-slate-900">¥4,980</span>
                <span className="text-slate-500">/月</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Real Card Templates Preview - Point Cards */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              実際の会員証デザイン
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              4種類のテンプレートからお店のイメージに合ったデザインを選択できます。
            </p>
          </div>

          {/* Point Card Templates */}
          <div className="mb-16">
            <h3 className="text-center text-lg font-bold text-slate-700 mb-8 flex items-center justify-center gap-2">
              <CreditCard className="w-5 h-5 text-primary-600" />
              ポイントカード
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 justify-items-center max-w-4xl mx-auto">
              {(['simple', 'dark', 'elegant', 'pop'] as const).map((template, index) => (
                <motion.div
                  key={template}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex flex-col items-center w-full"
                >
                  <div className={`flex justify-center p-8 rounded-lg w-full ${
                    template === 'dark' ? 'bg-slate-950' :
                    template === 'elegant' ? 'bg-[#F5F5F0]' :
                    template === 'pop' ? 'bg-primary-50' :
                    'bg-gray-100'
                  }`}>
                    <MemberCardPreview template={template} />
                  </div>
                  <span className="mt-3 text-sm font-medium text-slate-600 capitalize flex items-center gap-1">
                    {template}
                    {template !== 'simple' && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-primary-100 text-primary-600 rounded-full font-bold">Pro</span>
                    )}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Stamp Card Templates - All 4 types */}
          <div>
            <h3 className="text-center text-lg font-bold text-slate-700 mb-8 flex items-center justify-center gap-2">
              <Stamp className="w-5 h-5 text-primary-600" />
              スタンプカード
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 justify-items-center max-w-4xl mx-auto">
              {(['simple', 'dark', 'elegant', 'pop'] as const).map((template, index) => (
                <motion.div
                  key={template}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex flex-col items-center w-full"
                >
                  <div className={`flex justify-center p-8 rounded-lg w-full ${
                    template === 'dark' ? 'bg-slate-950' :
                    template === 'elegant' ? 'bg-[#F5F5F0]' :
                    template === 'pop' ? 'bg-primary-50' :
                    'bg-gray-100'
                  }`}>
                    <StampCardPreview template={template} />
                  </div>
                  <span className="mt-3 text-sm font-medium text-slate-600 capitalize flex items-center gap-1">
                    {template}
                    {template !== 'simple' && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-primary-100 text-primary-600 rounded-full font-bold">Pro</span>
                    )}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How to Setup Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              設定の流れ
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: 1,
                icon: Palette,
                title: 'デザインを選択',
                description: 'テンプレートを選び、お店のブランドカラーとロゴを設定します。'
              },
              {
                step: 2,
                icon: Gift,
                title: 'ポイント設定',
                description: 'ポイント制 or スタンプ制を選び、付与ルールを決めます。'
              },
              {
                step: 3,
                icon: QrCode,
                title: 'QRで運用開始',
                description: 'お客様のQRを読み取るだけでポイント付与・消費ができます。'
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6 relative">
                  <item.icon className="w-8 h-8 text-primary-600" />
                  <span className="absolute -top-2 -right-2 w-7 h-7 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-600 leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              お店のメリット
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: CreditCard,
                title: 'カード忘れゼロ',
                description: 'スマホさえあればOK。「カード忘れた」でポイント付与漏れがなくなります。'
              },
              {
                icon: Gift,
                title: 'リピート促進',
                description: 'ポイントやスタンプで再来店のきっかけを作り、顧客ロイヤルティを向上。'
              },
              {
                icon: Award,
                title: 'ランクで特別感',
                description: 'Bronze→Silver→Goldのランク制度で、常連客に特別な体験を提供。'
              }
            ].map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-8 hover:shadow-lg transition-all border border-slate-100"
              >
                <div className="w-14 h-14 rounded-xl bg-primary-100 flex items-center justify-center mb-6">
                  <benefit.icon className="w-7 h-7 text-primary-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{benefit.title}</h3>
                <p className="text-slate-600 leading-relaxed">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-linear-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">
            デジタル会員証を始めよう
          </h2>
          <p className="text-primary-100 text-lg mb-10 max-w-2xl mx-auto">
            無料プランでポイント機能は使い放題。<br />
            Proプランでブランディングを強化。
          </p>
          <Link 
            to="/" 
            state={{ scrollTo: 'auth' }}
            className="inline-flex items-center gap-2 px-10 py-4 bg-white text-primary-700 rounded-full font-bold hover:bg-primary-50 transition shadow-lg group"
          >
            無料で始める
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <Link to="/" className="text-xl font-bold text-white">IToguchi</Link>
            <div className="flex gap-6 text-sm">
              <Link to="/feature/auto-response" className="hover:text-white transition">スマート自動応答</Link>
              <Link to="/feature/reservation" className="hover:text-white transition">かんたん予約管理</Link>
              <Link to="/feature/membership" className="hover:text-white transition">デジタル会員証</Link>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-500 text-sm">
            © 2025 IToguchi. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
