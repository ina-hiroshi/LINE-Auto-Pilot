import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bot, ArrowLeft, ArrowRight, Check, Settings, Clock, TrendingUp, BookOpen, RefreshCw, Send, Crown, Upload, FileText, Link as LinkIcon, BarChart3, Smartphone, Search, Lightbulb, Target, FolderOpen, MessageSquare } from 'lucide-react'
import itoguchiaiImage from '../assets/itoguchiai.png'
import iconImage from '../assets/icon.png'

// Chat Preview Component for UI Mock
const ChatPreviewMock = () => {
  const mockMessages = [
    { role: 'user' as const, content: '営業時間を教えてください' },
    { role: 'assistant' as const, content: '営業時間は10:00〜19:00です。定休日は毎週火曜日となっております。' },
    { role: 'user' as const, content: '駐車場はありますか？' },
    { role: 'assistant' as const, content: 'はい、店舗前に2台分の駐車スペースがございます。お車でお越しの際はご利用ください。' }
  ]

  return (
    <div className="bg-gray-800 rounded-[3rem] p-4 border-4 border-gray-900 shadow-2xl max-w-[320px] mx-auto relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-xl z-20" />
      
      <div className="bg-[#8c9eff] w-full h-[500px] rounded-[2rem] overflow-hidden relative flex flex-col">
        {/* Preview Header */}
        <div className="h-14 bg-[#2c3e50] text-white z-10 flex items-center justify-between px-4 pt-4 shrink-0">
          <div className="font-bold text-sm truncate">AIアシスタント</div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#7494c0]">
          {mockMessages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] p-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-[#8de055] text-black rounded-tr-none'
                    : 'bg-white text-black rounded-tl-none'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="bg-white p-2 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="メッセージを入力"
              className="flex-1 px-3 py-2 bg-gray-100 border-none rounded-full text-xs focus:ring-0 focus:outline-none"
              disabled
            />
            <button
              disabled
              className="p-2 bg-[#2c3e50] text-white rounded-full opacity-50 transition-colors flex items-center justify-center"
            >
              <Send size={14} className="rotate-45 ml-0.5 mt-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FeatureAI() {
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
                <Bot className="w-4 h-4" />
                AIで進化
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-slate-900 mb-4 sm:mb-6 leading-[1.15] tracking-tight">
                AIがあなたの代わりに<br />
                <span className="text-primary-600">接客と分析</span>
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-slate-600 mb-6 sm:mb-8 max-w-2xl leading-relaxed">
                営業時間外でも24時間、お客様に寄り添う接客を実現します。
                キーワード応答で対応できない質問にもAIが即座に回答。
                さらに、Gemini AIがデータを分析し、運営改善の提案まで自動で行います。
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Link to="/" state={{ scrollTo: 'auth' }} className="px-6 sm:px-8 py-3 sm:py-4 bg-primary-600 text-white rounded-full font-bold hover:bg-primary-700 transition shadow-lg hover:shadow-primary-200 flex items-center justify-center gap-2 group text-sm sm:text-base">
                  ProプランでAIを始める
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
                    src={itoguchiaiImage}
                    alt="AIがあなたの代わりに接客と分析" 
                    className="w-full h-auto object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent"></div>
                </div>
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
              無料プランでもキーワード応答が使えます。Proプランで AI 自動応答を解放。
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
                <h3 className="text-xl font-bold text-slate-900">キーワード応答</h3>
              </div>
              <ul className="space-y-4 mb-6">
                {[
                  'キーワード応答ルール（10件まで）',
                  'サブキーワード設定',
                  '部分一致 / 完全一致',
                  'ON/OFF切り替え'
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
                <h3 className="text-xl font-bold text-slate-900">AI自動応答</h3>
              </div>
              <ul className="space-y-4 mb-6">
                {[
                  'キーワード応答（無制限）',
                  'AI自動応答',
                  'トーン選択（丁寧/カジュアル）',
                  'ペルソナ設定',
                  'AI学習データのアップロード',
                  'チャットプレビュー'
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

      {/* Real UI Preview Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              実際の管理画面
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              直感的な操作で、AI設定を簡単に管理できます。
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Left: AI Settings Preview */}
            <div className="space-y-6 lg:space-y-8">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
              >
                {/* Tabs */}
                <div className="border-b border-gray-200">
                  <div className="flex">
                    <button className="px-4 py-3 text-sm font-medium border-b-2 border-primary-500 text-primary-600 bg-primary-50/50 flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      AI基本設定
                      <span className="text-[10px] px-1.5 py-0.5 bg-primary-100 text-primary-600 rounded-full font-bold">Pro</span>
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-6">
                  {/* Enable Switch */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                      <h3 className="font-bold text-gray-900">AI自動応答を有効にする</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        有効にすると、キーワード応答に該当しないメッセージに対してAIが自動で返信します。
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-14 h-7 bg-primary-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all"></div>
                    </label>
                  </div>

                  {/* Tone Selection */}
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-3">
                      AIの口調（キャラクター）
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button className="p-3 rounded-xl border-2 border-primary-500 bg-primary-50 ring-1 ring-primary-500 text-left">
                        <div className="font-bold text-gray-900 text-sm">丁寧・フォーマル</div>
                        <div className="text-xs text-gray-500 mt-1">
                          「承知いたしました。ご予約ありがとうございます。」
                        </div>
                      </button>
                      <button className="p-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 text-left">
                        <div className="font-bold text-gray-900 text-sm">フレンドリー</div>
                        <div className="text-xs text-gray-500 mt-1">
                          「わかったよ！予約ありがとう！」
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Persona Prompt */}
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      追加の指示・ペルソナ設定
                    </label>
                    <textarea
                      defaultValue="あなたは創業50年の老舗和菓子屋の店主です。頑固ですがお客様への感謝は忘れません。"
                      className="w-full h-32 px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-sm leading-relaxed bg-gray-50"
                      disabled
                    />
                  </div>
                </div>
              </motion.div>

              {/* Knowledge Base Preview */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
              >
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    AI学習データ
                    <span className="text-[10px] px-1.5 py-0.5 bg-primary-100 text-primary-600 rounded-full font-bold">Pro</span>
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  {/* Upload Area */}
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center bg-gray-50/30">
                    <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Upload size={20} />
                    </div>
                    <p className="text-sm font-bold text-gray-900">資料をアップロード</p>
                    <p className="text-xs text-gray-500 mt-1">PDF, Word, テキストファイル</p>
                  </div>

                  {/* URL Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://example.com/menu.pdf"
                      className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-300 bg-gray-50"
                      disabled
                    />
                    <button className="px-4 py-2 bg-primary-600 text-white rounded-lg font-bold text-xs opacity-50" disabled>
                      <LinkIcon size={14} />
                    </button>
                  </div>

                  {/* Document List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                          <FileText size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 text-sm">メニュー表.pdf</div>
                          <div className="text-xs text-gray-500">PDF • 245 KB</div>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">学習中</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right: Chat Preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lg:sticky lg:top-32"
            >
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Smartphone size={16} /> チャットプレビュー
                </h3>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  実際のAI応答を確認できます
                </p>
              </div>
              <ChatPreviewMock />
              <p className="text-center text-xs text-slate-500 mt-4">※実際の管理画面</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* AI Features Section - 3つの特徴 */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              AI機能の3つの特徴
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Proプランで、AIの力をフルに活用できます。
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {[
              {
                icon: Bot,
                title: '24時間自動接客',
                description: 'キーワード応答で対応できない質問にもAIが即座に回答。深夜・早朝のお問い合わせも逃しません。',
                iconBg: 'bg-blue-100',
                iconColor: 'text-blue-600'
              },
              {
                icon: BookOpen,
                title: 'あなたの店舗を学習',
                description: 'メニュー表やFAQ、WebページをAIに学習させることで、店舗独自の正確な回答を実現。',
                iconBg: 'bg-purple-100',
                iconColor: 'text-purple-600'
              },
              {
                icon: BarChart3,
                title: 'データから改善提案',
                description: 'Gemini AIが顧客データを分析し、よくある質問のカテゴリ分類や改善ポイントを提案。',
                iconBg: 'bg-emerald-100',
                iconColor: 'text-emerald-600'
              }
            ].map((feature, index) => {
              const IconComponent = feature.icon
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  className="relative bg-white rounded-2xl p-8 hover:shadow-lg transition-all border border-slate-100 group"
                >
                  {/* Proバッジ */}
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-xs font-bold">
                      <Crown className="w-3 h-3" />
                      Pro
                    </span>
                  </div>
                  
                  {/* アイコン */}
                  <div className={`w-14 h-14 rounded-xl ${feature.iconBg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <IconComponent className={`w-7 h-7 ${feature.iconColor}`} />
                  </div>
                  
                  {/* コンテンツ */}
                  <h3 className="text-xl font-bold mb-3 text-slate-900">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed text-sm">{feature.description}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Dashboard AI Analysis Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-block mb-4"
            >
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-sm font-semibold">
                AI分析
              </span>
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4"
            >
              データから改善提案を自動生成
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-slate-600 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed"
            >
              Gemini AIが過去30日間のデータを分析し、<br className="hidden md:block" />
              お店の運営改善に役立つインサイトを自動で提案します。
            </motion.p>
          </div>

          {/* Analysis Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: TrendingUp,
                title: '傾向サマリー',
                description: '過去30日間のメッセージや予約の傾向を自動で分析し、わかりやすくまとめます。',
                iconBg: 'bg-primary-100',
                iconColor: 'text-primary-600'
              },
              {
                icon: Lightbulb,
                title: '気づき',
                description: 'データから見つけた重要な気づきをリストアップ。お店の強みや課題を発見できます。',
                iconBg: 'bg-yellow-100',
                iconColor: 'text-yellow-600'
              },
              {
                icon: Target,
                title: '改善提案',
                description: '具体的な改善アクションを提案。データに基づいた実践的なアドバイスを提供します。',
                iconBg: 'bg-emerald-100',
                iconColor: 'text-emerald-600'
              },
              {
                icon: FolderOpen,
                title: '質問カテゴリ分類',
                description: 'よくある質問を自動でカテゴリに分類。キーワード応答の設定に役立ちます。',
                iconBg: 'bg-blue-100',
                iconColor: 'text-blue-600'
              },
              {
                icon: MessageSquare,
                title: '顧客ランキング',
                description: 'メッセージ数や予約数で顧客をランキング。重要な顧客を一目で把握できます。',
                iconBg: 'bg-purple-100',
                iconColor: 'text-purple-600'
              },
              {
                icon: BarChart3,
                title: 'メニュー・スタッフ分析',
                description: '人気メニューや担当者別の予約数を分析。売上向上のヒントを見つけられます。',
                iconBg: 'bg-orange-100',
                iconColor: 'text-orange-600'
              }
            ].map((feature, index) => {
              const IconComponent = feature.icon
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="relative bg-white rounded-2xl p-6 hover:shadow-lg transition-all border border-slate-100 group"
                >
                  {/* Proバッジ */}
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-xs font-bold">
                      <Crown className="w-3 h-3" />
                      Pro
                    </span>
                  </div>
                  
                  {/* アイコン */}
                  <div className={`w-12 h-12 rounded-xl ${feature.iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <IconComponent className={`w-6 h-6 ${feature.iconColor}`} />
                  </div>
                  
                  {/* コンテンツ */}
                  <h3 className="text-lg font-bold mb-2 text-slate-900">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed text-sm">{feature.description}</p>
                </motion.div>
              )
            })}
          </div>

          {/* Dashboard Preview Mock */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
          >
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-primary-600" />
                  <h3 className="text-sm font-bold text-gray-700">AIによるデータ分析</h3>
                  <span className="text-[10px] px-1.5 py-0.5 bg-primary-100 text-primary-600 rounded-full font-bold">Pro</span>
                </div>
                <button className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg">分析を更新</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* Summary Card */}
              <div className="bg-primary-50 p-4 rounded-xl border border-primary-100">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-primary-600" />
                  <h4 className="font-bold text-gray-800 text-sm">今月の傾向サマリー</h4>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">
                  過去30日間でメッセージ数が前月比15%増加。特に「営業時間」に関する質問が多く、リッチメニューへの導線強化を推奨します。
                </p>
              </div>

              {/* Insights & Improvements */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb size={16} className="text-primary-600" />
                    <h4 className="font-bold text-gray-800 text-sm">気づき</h4>
                  </div>
                  <ul className="space-y-2">
                    {[
                      '平日の午後2時〜4時に問い合わせが集中',
                      '「駐車場」に関する質問が増加傾向',
                      'リピート顧客のメッセージ数が全体の40%'
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                        <span className="w-4 h-4 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Target size={16} className="text-primary-600" />
                    <h4 className="font-bold text-gray-800 text-sm">改善提案</h4>
                  </div>
                  <ul className="space-y-2">
                    {[
                      '「営業時間」のキーワード応答を追加',
                      'リッチメニューに「駐車場情報」ボタンを追加',
                      'リピート顧客向けの特典を検討'
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                        <span className="w-4 h-4 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Question Categories */}
              <div className="bg-white p-4 rounded-xl border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen size={16} className="text-primary-600" />
                  <h4 className="font-bold text-gray-800 text-sm">よくある質問のカテゴリ分類</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { category: '営業時間', count: 45 },
                    { category: '駐車場', count: 23 },
                    { category: '予約方法', count: 18 }
                  ].map((cat, i) => (
                    <div key={i} className="p-3 bg-primary-50 rounded-lg border border-primary-100">
                      <div className="flex items-center justify-between mb-1">
                        <h5 className="font-bold text-gray-800 text-xs">{cat.category}</h5>
                        <span className="text-[10px] font-bold text-primary-600 bg-primary-100 px-1.5 py-0.5 rounded-full">
                          {cat.count}件
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Setup Steps */}
      <section className="py-20 bg-slate-50">
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
                icon: Settings,
                title: 'AI自動応答を有効化',
                description: '管理画面でAI自動応答のスイッチをONにするだけ。すぐに運用を開始できます。'
              },
              {
                step: 2,
                icon: Bot,
                title: 'トーン・ペルソナを設定',
                description: '丁寧な口調かフレンドリーか、お店のイメージに合わせて選択。追加の指示も設定可能です。'
              },
              {
                step: 3,
                icon: BookOpen,
                title: '学習データをアップロード',
                description: 'メニュー表やFAQをアップロードして、より正確な回答を実現。URLからも追加できます。'
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
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              お店のメリット
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Clock,
                title: '対応時間の削減',
                description: 'よくある質問への回答を自動化。スタッフは本来の業務に集中できます。'
              },
              {
                icon: TrendingUp,
                title: '機会損失を防止',
                description: '営業時間外でも即座に回答。問い合わせの取りこぼしをゼロに。'
              },
              {
                icon: RefreshCw,
                title: '24時間対応',
                description: '深夜でも早朝でも、AIがお客様の質問に対応し続けます。'
              },
              {
                icon: BookOpen,
                title: '店舗独自の正確な回答',
                description: '学習データを追加することで、あなたの店舗に特化した回答が可能です。'
              }
            ].map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-50 rounded-2xl p-8 hover:shadow-lg transition-all border border-slate-100"
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
            ProプランでAIを始めよう
          </h2>
          <p className="text-primary-100 text-lg mb-10 max-w-2xl mx-auto">
            無料プランでキーワード応答を試せます。<br />
            ProプランでAIの力を解放。
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
              <Link to="/feature/ai" className="hover:text-white transition">AI機能</Link>
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
