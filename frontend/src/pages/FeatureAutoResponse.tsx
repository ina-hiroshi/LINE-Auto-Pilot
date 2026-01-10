import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MessageCircle, ArrowLeft, ArrowRight, Check, Settings, Bot, Clock, TrendingUp, BookOpen, RefreshCw, Send, Crown, Tag, Plus, Edit2, Trash2 } from 'lucide-react'
import smartAutoChatImage from '../assets/smartautochat.jpg'
import iconImage from '../assets/icon.png'

export default function FeatureAutoResponse() {
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
                <MessageCircle className="w-4 h-4" />
                スマート自動応答
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-slate-900 mb-4 sm:mb-6 leading-[1.15] tracking-tight">
                お客様を待たせない、<br />
                <span className="text-primary-600">AI自動応答</span>システム
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-slate-600 mb-6 sm:mb-8 max-w-2xl leading-relaxed">
                よくある質問にはAIが即座に対応。営業時間外でも24時間365日、
                お客様の問い合わせに素早く回答。機会損失を防ぎ、顧客満足度を向上させます。
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
                    src={smartAutoChatImage}
                    alt="スマート自動応答" 
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
                      <Clock className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">応答速度</p>
                      <p className="text-lg font-bold text-slate-900">瞬時</p>
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
              直感的な操作で、キーワード応答やAI設定を簡単に管理できます。
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Setup Steps */}
            <div className="space-y-6 lg:space-y-8">
              {[
                {
                  step: 1,
                  title: 'キーワードを登録',
                  description: '「営業時間」「予約」などのキーワードと、それに対する応答メッセージを設定します。'
                },
                {
                  step: 2,
                  title: 'AI設定を調整（Pro）',
                  description: 'トーンやペルソナを設定し、お店のイメージに合った応答を生成させます。'
                },
                {
                  step: 3,
                  title: '学習データを追加（Pro）',
                  description: 'お店の情報やFAQをアップロードして、より正確な回答を可能に。'
                }
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  className="flex gap-4 lg:gap-6"
                >
                  <div className="shrink-0 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-base lg:text-lg">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-lg lg:text-xl font-bold text-slate-900 mb-1 lg:mb-2">{item.title}</h3>
                    <p className="text-sm lg:text-base text-slate-600 leading-relaxed">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Real Admin UI Preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lg:sticky lg:top-32 w-full"
            >
              <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                {/* Tabs */}
                <div className="border-b border-gray-200 overflow-x-auto">
                  <div className="flex min-w-max">
                    <button className="px-3 lg:px-4 py-2 lg:py-3 text-xs lg:text-sm font-medium border-b-2 border-primary-500 text-primary-600 bg-primary-50/50 whitespace-nowrap">
                      <Tag className="w-3 h-3 lg:w-4 lg:h-4 inline mr-1 lg:mr-1.5" />
                      キーワード応答
                    </button>
                    <button className="px-3 lg:px-4 py-2 lg:py-3 text-xs lg:text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1 lg:gap-1.5 whitespace-nowrap">
                      <Bot className="w-3 h-3 lg:w-4 lg:h-4" />
                      AI基本設定
                      <span className="text-[9px] lg:text-[10px] px-1 lg:px-1.5 py-0.5 bg-primary-100 text-primary-600 rounded-full font-bold">Pro</span>
                    </button>
                    <button className="px-3 lg:px-4 py-2 lg:py-3 text-xs lg:text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1 lg:gap-1.5 whitespace-nowrap">
                      <BookOpen className="w-3 h-3 lg:w-4 lg:h-4" />
                      AI学習データ
                      <span className="text-[9px] lg:text-[10px] px-1 lg:px-1.5 py-0.5 bg-primary-100 text-primary-600 rounded-full font-bold">Pro</span>
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-3 lg:p-4">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 mb-3 lg:mb-4">
                    <div>
                      <h3 className="text-sm lg:text-base font-bold text-gray-800">キーワード応答ルール</h3>
                      <p className="text-[10px] lg:text-xs text-gray-500 mt-0.5">3 / 10 件設定中（Free上限: 10件）</p>
                    </div>
                    <button className="flex items-center gap-1 px-2.5 lg:px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 whitespace-nowrap">
                      <Plus size={12} className="lg:w-3.5 lg:h-3.5" /> 新規追加
                    </button>
                  </div>

                  {/* Rule List */}
                  <div className="space-y-2">
                    {[
                      { keyword: '営業時間', subKeywords: ['何時まで', '開店'], response: '営業時間は10:00〜19:00です。定休日は毎週火曜日...', active: true },
                      { keyword: '予約', subKeywords: ['予約したい', '空き'], response: '予約はこちらのリンクからお願いします...', active: true },
                      { keyword: '駐車場', subKeywords: ['車', 'パーキング'], response: '店舗前に2台分の駐車スペースがございます...', active: false }
                    ].map((rule, i) => (
                      <div key={i} className={`p-2 lg:p-3 rounded-lg border ${rule.active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 lg:gap-2 mb-1 flex-wrap">
                              <span className="text-xs lg:text-sm font-bold text-gray-800">{rule.keyword}</span>
                              <div className="flex gap-1 flex-wrap">
                                {rule.subKeywords.map((sub, j) => (
                                  <span key={j} className="text-[9px] lg:text-[10px] px-1 lg:px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded whitespace-nowrap">{sub}</span>
                                ))}
                              </div>
                            </div>
                            <p className="text-[10px] lg:text-xs text-gray-500 truncate">{rule.response}</p>
                          </div>
                          <div className="flex items-center gap-0.5 lg:gap-1 shrink-0">
                            <button className="p-1 hover:bg-gray-100 rounded">
                              <Edit2 size={12} className="text-gray-400 lg:w-3.5 lg:h-3.5" />
                            </button>
                            <button className="p-1 hover:bg-gray-100 rounded">
                              <Trash2 size={12} className="text-gray-400 lg:w-3.5 lg:h-3.5" />
                            </button>
                            <div className={`w-7 lg:w-8 h-3.5 lg:h-4 rounded-full relative cursor-pointer transition ${rule.active ? 'bg-primary-500' : 'bg-gray-300'}`}>
                              <div className={`w-2.5 lg:w-3 h-2.5 lg:h-3 bg-white rounded-full absolute top-0.5 transition-all ${rule.active ? 'right-0.5' : 'left-0.5'}`}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Chat Preview (Pro) */}
              <div className="mt-4 lg:mt-6 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                <div className="p-2.5 lg:p-3 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 lg:gap-2">
                    <Settings size={14} className="text-gray-500 lg:w-4 lg:h-4" />
                    <span className="text-xs lg:text-sm font-medium text-gray-700">チャットプレビュー</span>
                  </div>
                  <span className="text-[9px] lg:text-[10px] px-1 lg:px-1.5 py-0.5 bg-primary-100 text-primary-600 rounded-full font-bold">Pro</span>
                </div>
                <div className="p-3 lg:p-4 bg-gray-50 min-h-[120px] lg:min-h-[150px] space-y-2 lg:space-y-3">
                  {/* User Message */}
                  <div className="flex justify-end">
                    <div className="bg-primary-500 text-white px-2.5 lg:px-3 py-1.5 lg:py-2 rounded-2xl rounded-tr-sm text-xs lg:text-sm max-w-[80%] lg:max-w-[70%]">
                      予約の空き状況を教えてください
                    </div>
                  </div>
                  {/* AI Response */}
                  <div className="flex justify-start gap-1.5 lg:gap-2">
                    <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                      <Bot size={12} className="text-primary-600 lg:w-3.5 lg:h-3.5" />
                    </div>
                    <div className="bg-white px-2.5 lg:px-3 py-1.5 lg:py-2 rounded-2xl rounded-tl-sm text-xs lg:text-sm max-w-[80%] lg:max-w-[70%] shadow-sm border border-gray-100">
                      お問い合わせありがとうございます！<br />
                      本日はまだ空きがございます。ご予約はこちらからどうぞ 👇
                    </div>
                  </div>
                </div>
                <div className="p-2 lg:p-3 border-t border-gray-200 flex items-center gap-1.5 lg:gap-2">
                  <input type="text" placeholder="テストメッセージを入力..." className="flex-1 px-2 lg:px-3 py-1.5 text-xs lg:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <button className="p-1.5 lg:p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                    <Send size={12} className="lg:w-3.5 lg:h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-center text-xs text-slate-500 mt-3 lg:mt-4">※実際の管理画面</p>
            </motion.div>
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
          
          <div className="grid md:grid-cols-3 gap-8">
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
            自動応答を始めよう
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
