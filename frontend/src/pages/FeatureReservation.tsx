import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar, ArrowLeft, ArrowRight, Check, Clock, Users, Bell, Crown, User, CheckCircle, XCircle, Edit2 } from 'lucide-react'
import yoyakuImage from '../assets/yoyaku.png'
import iconImage from '../assets/icon.png'

// Dummy reservation data
const dummyReservations = [
  { id: 1, date: '2026-01-02', time: '10:00', endTime: '11:00', name: '山田 花子', menu: 'カット', status: 'confirmed', profileUrl: null },
  { id: 2, date: '2026-01-02', time: '11:30', endTime: '13:00', name: '佐藤 太郎', menu: 'カラー', status: 'confirmed', profileUrl: null },
  { id: 3, date: '2026-01-02', time: '14:00', endTime: '16:00', name: '田中 美咲', menu: 'パーマ', status: 'confirmed', profileUrl: null },
  { id: 4, date: '2026-01-03', time: '10:30', endTime: '11:30', name: '鈴木 一郎', menu: 'カット', status: 'confirmed', profileUrl: null },
  { id: 5, date: '2026-01-05', time: '13:00', endTime: '14:30', name: '高橋 恵子', menu: 'トリートメント', status: 'cancelled', profileUrl: null },
]

export default function FeatureReservation() {
  const location = useLocation()
  const currentDate = new Date()
  const dayNames = ['日', '月', '火', '水', '木', '金', '土']
  
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
                <Calendar className="w-4 h-4" />
                かんたん予約管理
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-slate-900 mb-4 sm:mb-6 leading-[1.15] tracking-tight">
                電話いらずで<br />
                <span className="text-primary-600">24時間予約受付</span>
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-slate-600 mb-6 sm:mb-8 max-w-2xl leading-relaxed">
                お客様はLINEのトーク画面からそのまま予約完了。
                電話対応の手間を減らし、予約のハードルを下げます。
                Googleカレンダーとの連携で、ダブルブッキングも防止できます。
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
                    src={yoyakuImage}
                    alt="かんたん予約管理" 
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
                      <p className="text-xs text-slate-500 font-medium">予約受付</p>
                      <p className="text-lg font-bold text-slate-900">24時間</p>
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
              無料プランでも予約管理は無制限。Proプランでカレンダー連携を解放。
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
                <h3 className="text-xl font-bold text-slate-900">基本予約管理</h3>
              </div>
              <ul className="space-y-4 mb-6">
                {[
                  '予約管理（無制限）',
                  'LINE予約受付',
                  '予約確認・変更・キャンセル',
                  '予約一覧のリスト表示'
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
                <h3 className="text-xl font-bold text-slate-900">カレンダー連携</h3>
              </div>
              <ul className="space-y-4 mb-6">
                {[
                  'Freeの全機能',
                  'Googleカレンダー連携',
                  'リアルタイム同期（双方向）',
                  'カレンダービュー（日/週/月）',
                  'Webhook通知',
                  'ダブルブッキング防止'
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

      {/* Real UI Preview Section - List View */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              実際の管理画面
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              リスト表示とカレンダー表示の2つのビューで予約を管理できます。
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* List View */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-gray-900">予約管理</h3>
                    <button className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg">+ 予約登録</button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button className="px-3 py-1.5 text-xs font-medium rounded-md bg-white shadow-sm text-gray-900">リスト</button>
                      <button className="px-3 py-1.5 text-xs font-medium rounded-md text-gray-500">カレンダー</button>
                    </div>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button className="px-2 py-1 text-[10px] font-medium rounded-md text-gray-500">全期間</button>
                      <button className="px-2 py-1 text-[10px] font-medium rounded-md text-gray-500">今月</button>
                      <button className="px-2 py-1 text-[10px] font-medium rounded-md text-gray-500">今週</button>
                      <button className="px-2 py-1 text-[10px] font-medium rounded-md bg-white shadow-sm text-gray-900">今日</button>
                    </div>
                  </div>
                </div>

                {/* List Content */}
                <div className="p-4">
                  <h4 className="font-bold text-gray-800 mb-3">予約一覧</h4>
                  <div className="space-y-2">
                    {dummyReservations.slice(0, 4).map((res) => {
                      const date = new Date(res.date)
                      const month = date.getMonth() + 1
                      const day = date.getDate()
                      const dayOfWeek = dayNames[date.getDay()]
                      
                      return (
                        <div key={res.id} className="p-2 hover:bg-gray-50 rounded-lg transition flex items-center gap-3 cursor-pointer border border-gray-100">
                          {/* Date */}
                          <div className="flex flex-col items-center justify-center w-12 h-12 bg-primary-50 rounded-lg text-primary-700 shrink-0">
                            <span className="text-[10px] font-bold leading-none">{month}月</span>
                            <span className="text-lg font-bold leading-none my-0.5">{day}</span>
                            <span className="text-[10px] font-bold leading-none">({dayOfWeek})</span>
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <div className="flex items-center gap-1 text-gray-900 font-bold text-sm">
                                <Clock size={12} className="text-gray-400" />
                                <span>{res.time} - {res.endTime}</span>
                              </div>
                              <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-medium ${
                                res.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                              }`}>
                                {res.status === 'cancelled' ? 'キャンセル' : 'LINE予約'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                                <User size={12} className="text-gray-400" />
                              </div>
                              <span className="text-sm text-gray-700 font-medium">{res.name}</span>
                              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{res.menu}</span>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400">
                              <Edit2 size={14} />
                            </button>
                            {res.status !== 'cancelled' && (
                              <>
                                <button className="p-1.5 hover:bg-gray-100 rounded text-green-500">
                                  <CheckCircle size={14} />
                                </button>
                                <button className="p-1.5 hover:bg-gray-100 rounded text-red-400">
                                  <XCircle size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-slate-500 mt-3">※リスト表示</p>
            </motion.div>

            {/* Calendar View - Matches actual Reservations.tsx UI */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
                {/* Header / Settings Bar - Matches Reservations.tsx */}
                <div className="p-4 border-b border-gray-100 bg-white">
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                      <h2 className="text-lg font-bold text-gray-800 whitespace-nowrap">
                        {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
                      </h2>
                      
                      <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
                        <button className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition text-gray-600">
                          ←
                        </button>
                        <button className="px-3 py-1.5 text-xs font-medium hover:bg-white hover:shadow-sm rounded-md transition text-gray-600">
                          今日
                        </button>
                        <button className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition text-gray-600">
                          →
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                      {/* Calendar Name Display */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-md border border-gray-200">
                          <div className="w-3 h-3 rounded-full border border-gray-200 shadow-sm bg-primary-500"></div>
                          <span className="text-xs font-bold text-gray-700 truncate max-w-[100px]">
                            予約カレンダー
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-green-700 font-medium px-2 py-1 bg-green-100 rounded-full text-[10px] whitespace-nowrap border border-green-200">
                          <CheckCircle size={10} />
                          <span>連携中</span>
                        </div>
                      </div>

                      <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
                        <button className="px-2 py-1.5 text-xs font-medium rounded-md transition bg-white shadow-sm text-gray-900">
                          月
                        </button>
                        <button className="px-2 py-1.5 text-xs font-medium rounded-md transition text-gray-500 hover:text-gray-700">
                          週
                        </button>
                        <button className="px-2 py-1.5 text-xs font-medium rounded-md transition text-gray-500 hover:text-gray-700">
                          日
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Calendar Grid View - Matches Reservations.tsx month view */}
                <div className="flex flex-col h-[350px]">
                  {/* Days Header */}
                  <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 shrink-0">
                    {dayNames.map((day, i) => (
                      <div key={day} className={`py-2 text-center text-xs font-semibold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Body - Month View */}
                  <div className="flex-1 grid grid-cols-7 grid-rows-5 divide-x divide-y divide-gray-200 bg-gray-200 gap-px overflow-hidden">
                    {(() => {
                      const year = currentDate.getFullYear()
                      const month = currentDate.getMonth()
                      const firstDay = new Date(year, month, 1)
                      const lastDay = new Date(year, month + 1, 0)
                      const daysInMonth = lastDay.getDate()
                      const startingDay = firstDay.getDay()
                      
                      const days = []
                      
                      // Previous month padding
                      const prevMonthLastDay = new Date(year, month, 0).getDate()
                      for (let i = 0; i < startingDay; i++) {
                        days.push({ day: prevMonthLastDay - startingDay + 1 + i, currentMonth: false })
                      }
                      
                      // Current month
                      for (let i = 1; i <= daysInMonth; i++) {
                        days.push({ day: i, currentMonth: true })
                      }
                      
                      // Next month padding
                      const remainingCells = 35 - days.length
                      for (let i = 1; i <= remainingCells; i++) {
                        days.push({ day: i, currentMonth: false })
                      }

                      return days.map((d, idx) => {
                        const isToday = d.currentMonth && d.day === currentDate.getDate()
                        // Find reservations for this day
                        const dayReservations = d.currentMonth ? dummyReservations.filter(r => {
                          const resDate = new Date(r.date)
                          return resDate.getDate() === d.day && resDate.getMonth() === month
                        }) : []

                        return (
                          <div key={idx} className={`bg-white min-h-0 p-1 flex flex-col ${!d.currentMonth ? 'bg-gray-50 text-gray-400' : ''}`}>
                            <div className={`text-xs font-medium mb-1 flex items-center shrink-0 ${isToday ? 'text-primary-600' : ''}`}>
                              <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] ${isToday ? 'bg-primary-100 font-bold' : ''}`}>
                                {d.day}
                              </span>
                            </div>
                            
                            <div className="flex-1 overflow-hidden space-y-0.5">
                              {dayReservations.map(r => (
                                <div 
                                  key={r.id} 
                                  className="text-[8px] bg-primary-50 text-primary-700 px-1 py-0.5 rounded border-l-2 border-primary-500 truncate cursor-pointer hover:opacity-80 leading-tight"
                                >
                                  <span className="font-bold">{r.time}</span>
                                  {' '}{r.name.split(' ')[0]}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-slate-500 mt-3">※カレンダー表示（Pro）</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Setup Steps */}
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
                title: 'Googleカレンダーを連携（Pro）',
                description: 'ワンクリックでGoogleアカウントと連携。既存の予定と自動同期されます。'
              },
              {
                step: 2,
                title: '予約枠を設定',
                description: '営業時間、予約可能な時間枠、所要時間などを設定します。'
              },
              {
                step: 3,
                title: 'リッチメニューに予約ボタンを配置',
                description: 'LINEのリッチメニューに予約ボタンを設置して、お客様がすぐにアクセスできるようにします。'
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
                  <Calendar className="w-8 h-8 text-primary-600" />
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
                icon: Bell,
                title: '電話対応ゼロへ',
                description: '施術中の電話対応が不要に。お客様に集中できる環境を実現します。'
              },
              {
                icon: Users,
                title: '予約のハードル低下',
                description: '「電話するのが面倒」というお客様もLINEなら気軽に予約できます。'
              },
              {
                icon: Calendar,
                title: 'Googleカレンダー連携',
                description: '既存のスケジュールと自動同期。ダブルブッキングを確実に防止します。'
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
            今すぐLINE予約を始めよう
          </h2>
          <p className="text-primary-100 text-lg mb-10 max-w-2xl mx-auto">
            無料プランでも予約管理機能は無制限。<br />
            Googleカレンダー連携でさらに便利に。
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
