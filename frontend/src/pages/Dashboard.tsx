import { useCallback, useEffect, useState, useRef } from 'react'
import { Users, Calendar, AlertCircle, Bot, User, MessageSquare, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import ProBadge from '../components/ProBadge'

type DashboardStats = {
  manualReplyNeeded: number
  todayReservations: number
  todayAutoResponses: number
  todayAiResponses: number
  totalFriends: number
  totalLogs: number
}

type LogEntry = {
  id: string
  created_at: string
  line_user_id: string
  message_content: string
  reply_content: string | null
  status: 'auto_replied' | 'ai_replied' | 'manual_reply_needed' | 'manual_replied' | 'resolved'
  display_name?: string
  profile_picture_url?: string
}

const STATUS_LABELS = {
  auto_replied: '自動応答',
  ai_replied: 'AI応答',
  manual_reply_needed: '要対応',
  manual_replied: '手動返信',
  resolved: '対応済'
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    manualReplyNeeded: 0,
    todayReservations: 0,
    todayAutoResponses: 0,
    todayAiResponses: 0,
    totalFriends: 0,
    totalLogs: 0
  })
  const [isProPlan, setIsProPlan] = useState(false) // Default to Free Plan, updated by quota check
  const [allLogs, setAllLogs] = useState<LogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'auto_replied' | 'ai_replied' | 'manual_reply_needed' | 'manual_replied' | 'resolved'>('all')
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('all')
  const [storeId, setStoreId] = useState<string | null>(null)

  // Reply Modal State
  const [replyModalOpen, setReplyModalOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [quotaInfo, setQuotaInfo] = useState<{ type: string, limit?: number, totalUsage: number, basicId?: string } | null>(null)
  const [chatHistory, setChatHistory] = useState<LogEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (replyModalOpen && scrollRef.current && chatHistory.length > 0) {
        // Use setTimeout to ensure DOM is updated
        setTimeout(() => {
            if (selectedLog) {
                const targetElement = document.getElementById(`msg-${selectedLog.id}`)
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    return
                }
            }
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
        }, 100)
    }
  }, [replyModalOpen, chatHistory, selectedLog])

  // Toast State
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success'
  })

  const fetchDashboardData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get Profile for Plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single()
      
      setIsProPlan(profile?.plan === 'pro' || profile?.plan === 'executive')

      // Get Store ID
      const { data: stores } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
      
      const storeId = stores?.[0]?.id
      if (!storeId) {
        setLoading(false)
        return
      }
      setStoreId(storeId)

      // Calculate Date Range
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      let start: string | null = null
      let end: string | null = null

      switch (timeRange) {
        case 'today': {
            const endOfToday = new Date(startOfToday)
            endOfToday.setHours(23, 59, 59, 999)
            start = startOfToday.toISOString()
            end = endOfToday.toISOString()
            break
        }
        case 'week': {
            const startOfWeek = new Date(startOfToday)
            startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay()) // Sunday
            const endOfWeek = new Date(startOfWeek)
            endOfWeek.setDate(startOfWeek.getDate() + 6)
            endOfWeek.setHours(23, 59, 59, 999)
            start = startOfWeek.toISOString()
            end = endOfWeek.toISOString()
            break
        }
        case 'month': {
            const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1)
            const endOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth() + 1, 0)
            endOfMonth.setHours(23, 59, 59, 999)
            start = startOfMonth.toISOString()
            end = endOfMonth.toISOString()
            break
        }
        case 'all':
            start = null
            end = null
            break
      }

      // 1. Fetch Logs for Stats & Chart
      let logsQuery = supabase
        .from('customer_logs')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
      
      if (start) logsQuery = logsQuery.gte('created_at', start)
      if (end) logsQuery = logsQuery.lte('created_at', end)
      
      if (!start) {
          logsQuery = logsQuery.limit(2000) // Higher limit for 'all'
      }

      const { data: logs } = await logsQuery

      if (logs) {
        // Calculate Stats
        const manualNeeded = logs.filter(l => l.status === 'manual_reply_needed').length
        const autoResponses = logs.filter(l => l.status === 'auto_replied').length
        const aiResponses = logs.filter(l => l.status === 'ai_replied').length

        setStats(prev => ({
          ...prev,
          manualReplyNeeded: manualNeeded,
          todayAutoResponses: autoResponses,
          todayAiResponses: aiResponses,
          totalLogs: logs.length
        }))
        setAllLogs(logs as LogEntry[])
      }

      // 2. Fetch Reservations
      let resQuery = supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .neq('status', 'cancelled')
      
      if (start) resQuery = resQuery.gte('start_time', start)
      if (end) resQuery = resQuery.lte('start_time', end)
      
      const { count: reservationCount, error: resError } = await resQuery
      
      if (!resError) {
        setStats(prev => ({ ...prev, todayReservations: reservationCount || 0 }))
      }

      // 3. Fetch Total Friends (Unique users in logs as proxy for now)
      if (logs) {
        const uniqueUsers = new Set(logs.map(l => l.line_user_id)).size
        setStats(prev => ({ ...prev, totalFriends: uniqueUsers }))
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchDashboardData()

    const handleProfileUpdate = () => {
      fetchDashboardData()
    }

    window.addEventListener('profile-updated', handleProfileUpdate)
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate)
    }
  }, [fetchDashboardData])

  useEffect(() => {
    if (!storeId) return

    // Real-time subscription for logs and reservations
    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'customer_logs',
          filter: `store_id=eq.${storeId}`
        },
        () => {
          fetchDashboardData()
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'reservations',
          filter: `store_id=eq.${storeId}`
        },
        () => {
          fetchDashboardData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [storeId, fetchDashboardData])

  useEffect(() => {
    if (filterStatus === 'all') {
      setFilteredLogs(allLogs.slice(0, 20))
    } else {
      setFilteredLogs(allLogs.filter(log => log.status === filterStatus).slice(0, 20))
    }
  }, [filterStatus, allLogs])

  const getTimeRangeLabel = () => {
      switch(timeRange) {
          case 'today': return '(今日)'
          case 'week': return '(今週)'
          case 'month': return '(今月)'
          case 'all': return '(全期間)'
      }
  }

  useEffect(() => {
    if (replyModalOpen && storeId) {
      const fetchQuota = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('get-line-quota', {
            body: { storeId }
          })
          if (error) throw error
          setQuotaInfo(data)
        } catch (error) {
          console.error('Error fetching quota:', error)
        }
      }
      fetchQuota()
    }
  }, [replyModalOpen, storeId])

  const fetchChatHistory = async (userId: string) => {
    if (!storeId) return
    setHistoryLoading(true)
    try {
      const { data } = await supabase
        .from('customer_logs')
        .select('*')
        .eq('store_id', storeId)
        .eq('line_user_id', userId)
        .order('created_at', { ascending: true })
        .limit(50)
      
      if (data) {
        setChatHistory(data as LogEntry[])
      }
    } catch (error) {
      console.error('Error fetching history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleReplyClick = (log: LogEntry) => {
    setSelectedLog(log)
    setReplyText('')
    setReplyModalOpen(true)
    fetchChatHistory(log.line_user_id)
  }

  const handleSendReply = async () => {
    if (!selectedLog || !replyText.trim()) return

    setSendingReply(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('認証エラー')

      const { error } = await supabase.functions.invoke('manual-reply', {
        body: {
          messageLogId: selectedLog.id,
          replyText: replyText,
          userId: selectedLog.line_user_id
        }
      })

      if (error) throw error

      setToast({
        isVisible: true,
        message: '返信を送信しました',
        type: 'success'
      })
      setReplyModalOpen(false)
      fetchDashboardData() // Refresh data immediately
    } catch (error) {
      console.error('Reply Error:', error)
      setToast({
        isVisible: true,
        message: '返信の送信に失敗しました',
        type: 'error'
      })
    } finally {
      setSendingReply(false)
    }
  }


  const handleResolve = async () => {
    if (!selectedLog) return

    try {
      const { error } = await supabase
        .from('customer_logs')
        .update({ status: 'resolved' })
        .eq('id', selectedLog.id)

      if (error) throw error

      // Update local state immediately
      setAllLogs(prev => prev.map(log => 
        log.id === selectedLog.id ? { ...log, status: 'resolved' } : log
      ))

      setToast({
        isVisible: true,
        message: '対応済にしました',
        type: 'success'
      })
      setReplyModalOpen(false)
      fetchDashboardData()
    } catch (error) {
      console.error('Resolve Error:', error)
      setToast({
        isVisible: true,
        message: '更新に失敗しました',
        type: 'error'
      })
    }
  }

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
  }

  return (
    <div className="flex flex-col h-full">
      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />

      <div className="shrink-0 z-20 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-200 w-full h-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-full flex justify-between items-end pb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">ダッシュボード</h1>
            <p className="text-gray-500">予約状況や顧客の動向を一目で確認できます。</p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
            {(['all', 'month', 'week', 'today'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  timeRange === range 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {range === 'today' ? '今日' : range === 'week' ? '今週' : range === 'month' ? '今月' : '全期間'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
      <Modal
        isOpen={replyModalOpen}
        onClose={() => setReplyModalOpen(false)}
        title="メッセージ対応"
        footerContent={
          <div className="flex flex-col w-full gap-3">
            <div className="flex justify-end gap-3 w-full">
              {selectedLog?.status === 'manual_reply_needed' && (
                <button
                  onClick={handleResolve}
                  className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                >
                  返信せずに対応済にする
                </button>
              )}
              <button
                onClick={() => setReplyModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
              >
                閉じる
              </button>
              <button
                onClick={handleSendReply}
                disabled={sendingReply || !replyText.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sendingReply ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    送信中...
                  </>
                ) : (
                  '送信する'
                )}
              </button>
            </div>
            {quotaInfo && (
                <div className="text-[10px] text-gray-500 space-y-0.5 text-right">
                    <p>プランごとの無料メッセージ上限: フリー(200) / ライト(5,000) / スタンダード(30,000)</p>
                    <a 
                        href="https://manager.line.biz/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 underline hover:text-emerald-700 inline-flex items-center gap-1"
                    >
                        プランの変更・確認はこちら
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </a>
                </div>
            )}
          </div>
        }
      >
        <div className="space-y-4">
            {/* Quota Info */}
            {quotaInfo && (
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-xs text-emerald-800">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-bold">
                            {quotaInfo.limit === 200 ? 'フリープラン' : 
                             quotaInfo.limit === 5000 ? 'ライトプラン' : 
                             quotaInfo.limit === 30000 ? 'スタンダードプラン' : 'カスタムプラン'}
                        </span>
                        <span className="font-bold">
                            {quotaInfo.totalUsage.toLocaleString()} / {quotaInfo.type === 'none' ? '無制限' : quotaInfo.limit?.toLocaleString()}
                        </span>
                    </div>
                    
                    {/* Progress Bar */}
                    {quotaInfo.type !== 'none' && quotaInfo.limit && (
                        <div className="w-full bg-emerald-200 rounded-full h-1.5">
                            <div 
                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                                style={{ width: `${Math.min((quotaInfo.totalUsage / quotaInfo.limit) * 100, 100)}%` }}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* User Info in Modal */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="w-10 h-10 rounded-full bg-white border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {selectedLog?.profile_picture_url ? (
                        <img src={selectedLog.profile_picture_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <User size={20} className="text-gray-400" />
                    )}
                </div>
                <div>
                    <p className="text-sm font-bold text-gray-900">{selectedLog?.display_name || 'ゲスト'}</p>
                    <p className="text-xs text-gray-500">への返信</p>
                </div>
            </div>

            <div ref={scrollRef} className="bg-gray-50 p-3 rounded-lg border border-gray-100 h-64 overflow-y-auto space-y-3">
                {historyLoading ? (
                    <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div></div>
                ) : chatHistory.length > 0 ? (
                    chatHistory.map((msg) => (
                        <div key={msg.id} id={`msg-${msg.id}`} className={`space-y-1 ${msg.id === selectedLog?.id ? 'bg-yellow-50/30 -mx-2 px-2 py-2 rounded' : ''}`}>
                            {/* User Message */}
                            <div className="flex justify-start flex-col items-start">
                                {msg.id === selectedLog?.id && (
                                    <span className="text-[10px] font-bold text-primary-600 mb-1 ml-1">返信対象</span>
                                )}
                                <div className={`border rounded-lg rounded-tl-none p-2 max-w-[80%] text-sm shadow-sm ${
                                    msg.id === selectedLog?.id 
                                    ? 'bg-white border-primary-300 ring-2 ring-primary-100 text-gray-900' 
                                    : 'bg-white border-gray-200 text-gray-800'
                                }`}>
                                    {msg.message_content}
                                </div>
                            </div>
                            <div className="text-[10px] text-gray-400 ml-1">
                                {new Date(msg.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>

                            {/* Reply (if exists) */}
                            {msg.reply_content && (
                                <>
                                    <div className="flex justify-end">
                                        <div className={`rounded-lg rounded-tr-none p-2 max-w-[80%] text-sm shadow-sm ${
                                            msg.status === 'manual_replied' ? 'bg-emerald-100 text-emerald-900' : 
                                            msg.status === 'ai_replied' ? 'bg-blue-50 text-blue-900' :
                                            'bg-gray-200 text-gray-800'
                                        }`}>
                                            {msg.reply_content}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-gray-400 text-right mr-1">
                                        {STATUS_LABELS[msg.status]}
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                ) : (
                    <p className="text-center text-gray-400 text-sm py-4">履歴がありません</p>
                )}
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">返信内容</label>
                <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[120px]"
                    placeholder="返信メッセージを入力してください..."
                />
            </div>
        </div>
      </Modal>

        {/* Alert Banner */}
        {stats.manualReplyNeeded > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-800">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
              <p className="font-medium">
                現在、<span className="font-bold text-red-700 text-lg mx-1">{stats.manualReplyNeeded}件</span>のお客様への対応が必要です。
              </p>
            </div>
        )}
      
      {/* Top Section: Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* 1. Manual Reply Needed */}
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-red-100 hover:shadow-md transition relative overflow-hidden">
          <div className="absolute top-0 right-0 w-12 h-12 bg-red-50 rounded-bl-full -mr-4 -mt-4" />
          <div className="flex items-center justify-between mb-2 relative">
            <h2 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">要対応 {getTimeRangeLabel()}</h2>
            <div className="p-1.5 bg-red-50 rounded-lg text-red-600 shrink-0">
              <AlertCircle size={16} />
            </div>
          </div>
          <div className="flex items-end gap-1 sm:gap-2 relative flex-wrap">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.manualReplyNeeded}</p>
            <p className="text-[10px] sm:text-xs text-red-600 font-medium mb-1">件</p>
            {stats.totalLogs > 0 && (
              <span className="text-sm sm:text-2xl font-bold text-gray-500 mb-0.5 ml-auto">
                {Math.round((stats.manualReplyNeeded / stats.totalLogs) * 100)}<span className="text-[10px] sm:text-base">%</span>
              </span>
            )}
          </div>
        </div>

        {/* 2. Today's Auto Responses */}
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">自動応答 {getTimeRangeLabel()}</h2>
            <div className="p-1.5 bg-primary-50 rounded-lg text-primary-600 shrink-0">
              <Bot size={16} />
            </div>
          </div>
          <div className="flex items-end gap-1 sm:gap-2 flex-wrap">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.todayAutoResponses}</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mb-1">回</p>
            {stats.totalLogs > 0 && (
              <span className="text-sm sm:text-2xl font-bold text-gray-500 mb-0.5 ml-auto">
                {Math.round((stats.todayAutoResponses / stats.totalLogs) * 100)}<span className="text-[10px] sm:text-base">%</span>
              </span>
            )}
          </div>
        </div>

        {/* 3. AI Responses (New) */}
        <div className={`bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition relative overflow-hidden ${!isProPlan ? 'bg-gray-50' : ''}`}>
          {!isProPlan && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
               <ProBadge />
            </div>
          )}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">AI応答 {getTimeRangeLabel()}</h2>
            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600 shrink-0">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="flex items-end gap-1 sm:gap-2 flex-wrap">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.todayAiResponses}</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mb-1">回</p>
            {stats.totalLogs > 0 && (
              <span className="text-sm sm:text-2xl font-bold text-gray-500 mb-0.5 ml-auto">
                {Math.round((stats.todayAiResponses / stats.totalLogs) * 100)}<span className="text-[10px] sm:text-base">%</span>
              </span>
            )}
          </div>
        </div>

        {/* 4. Today's Reservations */}
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">予約 {getTimeRangeLabel()}</h2>
            <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600 shrink-0">
              <Calendar size={16} />
            </div>
          </div>
          <div className="flex items-end gap-1 sm:gap-2">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.todayReservations}</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mb-1">件</p>
          </div>
        </div>

        {/* 5. Total Friends (Proxy) */}
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">ユーザー {getTimeRangeLabel()}</h2>
            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600 shrink-0">
              <Users size={16} />
            </div>
          </div>
          <div className="flex items-end gap-1 sm:gap-2">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.totalFriends}</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mb-1">人</p>
          </div>
        </div>
      </div>

      {/* Recent Logs List (Compact) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col flex-1 min-h-0 overflow-hidden h-[600px]">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center shrink-0 bg-white z-10 gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">メッセージ・対応状況</h2>
            {stats.manualReplyNeeded > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                要対応: {stats.manualReplyNeeded}
              </span>
            )}
          </div>
            
            {/* Filter Tabs */}
            <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto max-w-full">
                {(['all', 'manual_reply_needed', 'auto_replied', 'ai_replied', 'manual_replied', 'resolved'] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                            filterStatus === status 
                                ? 'bg-white text-gray-900 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {status === 'all' ? 'すべて' : STATUS_LABELS[status]}
                    </button>
                ))}
            </div>
        </div>

        <div className="divide-y divide-gray-100 overflow-y-auto">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log) => (
              <div 
                key={log.id} 
                className="group hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-stretch">
                  {/* Status Indicator Strip */}
                  <div className={`w-1 shrink-0 ${
                    log.status === 'auto_replied' ? 'bg-primary-500' : 
                    log.status === 'ai_replied' ? 'bg-blue-500' : 
                    log.status === 'manual_replied' ? 'bg-emerald-500' :
                    log.status === 'resolved' ? 'bg-gray-400' :
                    'bg-red-500'
                  }`} />

                  <div className="flex-1 p-3 flex flex-col sm:flex-row gap-4 items-start">
                    {/* User Info (Compact) */}
                    <div className="w-full sm:w-32 shrink-0 flex flex-row sm:flex-col gap-2 sm:gap-1 items-center sm:items-start justify-between sm:justify-start">
                      <div className="flex items-center gap-2">
                         <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200 shrink-0 overflow-hidden">
                            {log.profile_picture_url ? (
                                <img src={log.profile_picture_url} alt={log.display_name} className="w-full h-full object-cover" />
                            ) : log.display_name ? (
                                <span className="font-bold text-xs text-gray-600">{log.display_name[0]}</span>
                            ) : (
                                <User size={14} />
                            )}
                         </div>
                         <span className="font-bold text-sm truncate max-w-[100px]">{log.display_name || 'ゲスト'}</span>
                      </div>
                      <div className="flex items-center gap-2 sm:block">
                        <div className="text-xs text-gray-400">
                            {new Date(log.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="mt-0 sm:mt-1">
                            <span className={`text-xs px-2 py-1 rounded border font-bold ${
                                log.status === 'auto_replied' ? 'bg-primary-100 text-primary-800 border-primary-200' : 
                                log.status === 'ai_replied' ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                                log.status === 'manual_replied' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                log.status === 'resolved' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                'bg-red-100 text-red-800 border-red-200'
                            }`}>
                            {STATUS_LABELS[log.status]}
                            </span>
                        </div>
                      </div>
                    </div>

                    {/* Messages Area (Side by Side) */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                      {/* User Message */}
                      <div className="relative ml-4">
                        <div className="absolute top-0 -left-[12px]">
                           <svg width="12" height="20" viewBox="0 0 12 20">
                             <path d="M12,0 L0,0 L12,20 Z" fill="#f3f4f6" />
                           </svg>
                        </div>
                        <div className="bg-gray-100 rounded-2xl rounded-tl-none p-3 text-sm text-gray-800 max-h-32 overflow-y-auto shadow-sm">
                            {log.message_content}
                        </div>
                        {/* Reply Button - Always allow manual follow-up */}
                        <button 
                            onClick={() => handleReplyClick(log)}
                            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm"
                        >
                            <MessageSquare size={14} className="text-emerald-500" />
                            対応する
                        </button>
                      </div>

                      {/* Bot Reply */}
                      {log.reply_content ? (
                        <div className="relative mr-4">
                            <div className="absolute top-0 -right-[11px]">
                               <svg width="12" height="20" viewBox="0 0 12 20" className="overflow-visible">
                                 <path d="M0,0 L12,0 L0,20 Z" fill="#f0fdfa" stroke="none" />
                                 <path d="M0,20 L12,0 L0,0" fill="none" stroke="#ccfbf1" strokeWidth="1" />
                               </svg>
                            </div>
                            
                            <div className={`rounded-2xl rounded-tr-none p-3 text-sm text-gray-800 border max-h-32 overflow-y-auto shadow-sm ${
                                log.status === 'manual_replied' 
                                ? 'bg-emerald-50 border-emerald-100' 
                                : 'bg-primary-50 border-primary-100'
                            }`}>
                                <div className={`flex items-center gap-1 mb-1 sticky top-0 pb-1 border-b w-full z-10 ${
                                    log.status === 'manual_replied'
                                    ? 'bg-emerald-50 border-emerald-100/50'
                                    : 'bg-primary-50 border-primary-100/50'
                                }`}>
                                    {log.status === 'manual_replied' ? (
                                        <>
                                            <User size={12} className="text-emerald-600" />
                                            <span className="text-[10px] font-bold text-emerald-600">スタッフ</span>
                                        </>
                                    ) : (
                                        <>
                                            <Bot size={12} className="text-primary-600" />
                                            <span className="text-[10px] font-bold text-primary-600">Bot</span>
                                        </>
                                    )}
                                </div>
                                {log.reply_content}
                            </div>
                        </div>
                      ) : (
                        <div className="hidden md:block"></div> // Spacer to keep grid alignment
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400">ログがありません</p>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
    </div>
  )
}
