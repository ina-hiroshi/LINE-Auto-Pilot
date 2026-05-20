import { useCallback, useEffect, useState, useRef } from 'react'
import { Users, Calendar, AlertCircle, Bot, User, MessageSquare, Sparkles, BarChart3, TrendingUp, Search, Lightbulb, Target, FolderOpen } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import {
  LineMessagingQuotaPanel,
  LineMessagingQuotaFooterLinks,
  type LineQuotaInfo,
} from '../components/line/LineMessagingQuotaNotice'
import Toast from '../components/Toast'
import { UnderlineTabs } from '../components/UnderlineTabs'
import ProBadge from '../components/ProBadge'
import ProLockOverlay from '../components/ProLockOverlay'
import { usePlan } from '../hooks/usePlan'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts'

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

type DailyData = {
  date: string
  count: number
}

type WeekdayData = {
  day: string
  count: number
}

type StatusData = {
  name: string
  value: number
  color: string
}

type ReservationData = {
  id: string
  start_time: string
  status: string
  menu_id?: string
  staff_id?: string
}

type MenuData = {
  id: string
  name: string
}

type StaffData = {
  id: string
  name: string
}

type AIAnalysis = {
  summary: string
  insights: string[]
  improvements: string[]
  reservationAnalysis: string
  questionCategories: { category: string; count: number; examples: string[] }[]
  topCustomersByMessages: { name: string; count: number }[]
  topCustomersByReservations: { name: string; count: number }[]
  popularMenus: { name: string; count: number }[]
  staffStats: { name: string; count: number }[]
  loading: boolean
  error: string | null
}

const STATUS_LABELS = {
  auto_replied: '自動応答',
  ai_replied: 'AI応答',
  manual_reply_needed: '要対応',
  manual_replied: '手動返信',
  resolved: '対応済'
}

// Summary Cardsの色と統一したカラーパレット
const STATUS_COLORS = {
  auto_replied: '#0d9488', // primary-600 (自動応答カードと同じ)
  ai_replied: '#2563eb', // blue-600 (AI応答カードと同じ)
  manual_reply_needed: '#dc2626', // red-600 (要対応カードと同じ)
  manual_replied: '#0f766e', // primary-700
  resolved: '#94a3b8' // slate-400 (グレー系)
}

// グラフ用カラーパレット（サイドバーのprimary-600と統一 - index.cssの値を使用）
const CHART_COLORS = {
  primary: '#00a3b8', // primary-600 (サイドバーと同じ - index.cssの値)
  primaryLight: '#22d3ee', // primary-400 (index.cssの値)
  primaryDark: '#00a3b8', // primary-600
  primaryDarker: '#008496', // primary-700 (index.cssの値)
  gradient: {
    start: '#22d3ee', // primary-400
    end: '#00a3b8', // primary-600
  },
  area: {
    fill: 'rgba(0, 163, 184, 0.15)', // primary-600 with opacity
    stroke: '#00a3b8', // primary-600
  }
}

const WEEKDAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

export default function Dashboard() {
  const { isPro } = usePlan()
  const [stats, setStats] = useState<DashboardStats>({
    manualReplyNeeded: 0,
    todayReservations: 0,
    todayAutoResponses: 0,
    todayAiResponses: 0,
    totalFriends: 0,
    totalLogs: 0
  })
  const [allLogs, setAllLogs] = useState<LogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'auto_replied' | 'ai_replied' | 'manual_reply_needed' | 'manual_replied' | 'resolved'>('all')
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('all')
  const [storeId, setStoreId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'graphs' | 'messages' | 'analysis'>('graphs')

  // Graph Data
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [weekdayData, setWeekdayData] = useState<WeekdayData[]>([])
  const [statusData, setStatusData] = useState<StatusData[]>([])
  const [dailyUserData, setDailyUserData] = useState<DailyData[]>([])
  const [dailyReservationData, setDailyReservationData] = useState<DailyData[]>([])
  const [menuData, setMenuData] = useState<{ name: string; count: number }[]>([])
  const [staffData, setStaffData] = useState<{ name: string; count: number }[]>([])

  // AI Analysis
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis>({
    summary: '',
    insights: [],
    improvements: [],
    reservationAnalysis: '',
    questionCategories: [],
    topCustomersByMessages: [],
    topCustomersByReservations: [],
    popularMenus: [],
    staffStats: [],
    loading: false,
    error: null
  })

  // Reply Modal State
  const [replyModalOpen, setReplyModalOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [quotaInfo, setQuotaInfo] = useState<LineQuotaInfo | null>(null)
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

  // Process logs for graph data
  const processGraphData = useCallback((logs: LogEntry[]) => {
    // Daily data (last 14 days)
    const dailyMap = new Map<string, number>()
    const now = new Date()
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const key = `${date.getMonth() + 1}/${date.getDate()}`
      dailyMap.set(key, 0)
    }
    
    logs.forEach(log => {
      const date = new Date(log.created_at)
      const key = `${date.getMonth() + 1}/${date.getDate()}`
      if (dailyMap.has(key)) {
        dailyMap.set(key, (dailyMap.get(key) || 0) + 1)
      }
    })
    
    setDailyData(Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count })))

    // Weekday data
    const weekdayMap = new Map<number, number>()
    for (let i = 0; i < 7; i++) weekdayMap.set(i, 0)
    
    logs.forEach(log => {
      const day = new Date(log.created_at).getDay()
      weekdayMap.set(day, (weekdayMap.get(day) || 0) + 1)
    })
    
    setWeekdayData(WEEKDAY_NAMES.map((day, i) => ({ day, count: weekdayMap.get(i) || 0 })))

    // Status distribution
    const statusMap = new Map<string, number>()
    logs.forEach(log => {
      statusMap.set(log.status, (statusMap.get(log.status) || 0) + 1)
    })
    
    setStatusData([
      { name: '自動応答', value: statusMap.get('auto_replied') || 0, color: STATUS_COLORS.auto_replied },
      { name: 'AI応答', value: statusMap.get('ai_replied') || 0, color: STATUS_COLORS.ai_replied },
      { name: '要対応', value: statusMap.get('manual_reply_needed') || 0, color: STATUS_COLORS.manual_reply_needed },
      { name: '手動返信', value: statusMap.get('manual_replied') || 0, color: STATUS_COLORS.manual_replied },
      { name: '対応済', value: statusMap.get('resolved') || 0, color: STATUS_COLORS.resolved },
    ].filter(item => item.value > 0))
  }, [])

  // Process user graph data (daily unique users)
  const processUserGraphData = useCallback((logs: LogEntry[]) => {
    const dailyUserMap = new Map<string, Set<string>>()
    const now = new Date()
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const key = `${date.getMonth() + 1}/${date.getDate()}`
      dailyUserMap.set(key, new Set())
    }
    
    logs.forEach(log => {
      const date = new Date(log.created_at)
      const key = `${date.getMonth() + 1}/${date.getDate()}`
      const userSet = dailyUserMap.get(key)
      if (userSet) {
        userSet.add(log.line_user_id)
      }
    })
    
    setDailyUserData(Array.from(dailyUserMap.entries()).map(([date, userSet]) => ({ 
      date, 
      count: userSet.size 
    })))
  }, [])

  // Process reservation graph data
  const processReservationGraphData = useCallback((reservations: ReservationData[]) => {
    const dailyResMap = new Map<string, number>()
    const now = new Date()
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const key = `${date.getMonth() + 1}/${date.getDate()}`
      dailyResMap.set(key, 0)
    }
    
    reservations.forEach(res => {
      if (res.start_time) {
        const date = new Date(res.start_time)
        const key = `${date.getMonth() + 1}/${date.getDate()}`
        if (dailyResMap.has(key)) {
          dailyResMap.set(key, (dailyResMap.get(key) || 0) + 1)
        }
      }
    })
    
    setDailyReservationData(Array.from(dailyResMap.entries()).map(([date, count]) => ({ date, count })))
  }, [])

  // Process menu and staff data
  const processMenuAndStaffData = useCallback((
    reservations: ReservationData[],
    menus: MenuData[],
    staffMembers: StaffData[]
  ) => {
    const menuMap = new Map(menus.map(m => [m.id, m.name]))
    const staffMap = new Map(staffMembers.map(s => [s.id, s.name]))

    // Menu counts
    const menuCounts = new Map<string, number>()
    reservations.forEach(res => {
      if (res.menu_id) {
        const menuName = menuMap.get(res.menu_id) || '未設定'
        menuCounts.set(menuName, (menuCounts.get(menuName) || 0) + 1)
      }
    })
    
    setMenuData(Array.from(menuCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10))

    // Staff counts
    const staffCounts = new Map<string, number>()
    reservations.forEach(res => {
      if (res.staff_id) {
        const staffName = staffMap.get(res.staff_id) || '未設定'
        staffCounts.set(staffName, (staffCounts.get(staffName) || 0) + 1)
      }
    })
    
    setStaffData(Array.from(staffCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10))
  }, [])

  const fetchDashboardData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return


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
        processGraphData(logs as LogEntry[])
      }

      // 2. Fetch Reservations
      let resQuery = supabase
        .from('reservations')
        .select('id, start_time, status, menu_id, staff_id', { count: 'exact' })
        .eq('store_id', storeId)
        .neq('status', 'cancelled')
      
      if (start) resQuery = resQuery.gte('start_time', start)
      if (end) resQuery = resQuery.lte('start_time', end)
      
      const { data: reservations, count: reservationCount, error: resError } = await resQuery
      
      if (!resError) {
        setStats(prev => ({ ...prev, todayReservations: reservationCount || 0 }))
        
        // Process reservation graph data
        if (reservations) {
          processReservationGraphData(reservations as ReservationData[])
        }
      }

      // 3. Fetch Total Friends (Unique users in logs as proxy for now)
      if (logs) {
        const uniqueUsers = new Set(logs.map(l => l.line_user_id)).size
        setStats(prev => ({ ...prev, totalFriends: uniqueUsers }))
        processUserGraphData(logs as LogEntry[])
      }

      // 4. Fetch Menus and Staff for analysis
      const { data: menus } = await supabase
        .from('booking_menus')
        .select('id, name')
        .eq('store_id', storeId)

      const { data: staffMembers } = await supabase
        .from('staff_members')
        .select('id, name')
        .eq('store_id', storeId)

      if (reservations && menus && staffMembers) {
        processMenuAndStaffData(
          reservations as ReservationData[],
          menus as MenuData[],
          staffMembers as StaffData[]
        )
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [timeRange, processGraphData, processUserGraphData, processReservationGraphData, processMenuAndStaffData])

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

  // Load AI analysis from localStorage
  const loadAIAnalysisFromStorage = useCallback(() => {
    if (!storeId) return null
    
    try {
      const storageKey = `ai-analysis-${storeId}`
      const stored = localStorage.getItem(storageKey)
      if (!stored) return null
      
      const parsed = JSON.parse(stored)
      const now = Date.now()
      const oneDayInMs = 24 * 60 * 60 * 1000 // 24時間
      
      // 24時間以内のデータのみ有効
      if (parsed.timestamp && (now - parsed.timestamp) < oneDayInMs) {
        return parsed.data
      }
      
      // 古いデータは削除
      localStorage.removeItem(storageKey)
      return null
    } catch (error) {
      console.error('Error loading AI analysis from storage:', error)
      return null
    }
  }, [storeId])

  // Save AI analysis to localStorage
  const saveAIAnalysisToStorage = useCallback((data: Omit<AIAnalysis, 'loading' | 'error'>) => {
    if (!storeId) return
    
    try {
      const storageKey = `ai-analysis-${storeId}`
      const storageData = {
        timestamp: Date.now(),
        data: data
      }
      localStorage.setItem(storageKey, JSON.stringify(storageData))
    } catch (error) {
      console.error('Error saving AI analysis to storage:', error)
    }
  }, [storeId])

  // AI Analysis
  const fetchAIAnalysis = async (forceRefresh = false) => {
    if (!storeId || !isPro) return

    // 強制更新でない場合、localStorageから読み込み
    if (!forceRefresh) {
      const cachedData = loadAIAnalysisFromStorage()
      if (cachedData) {
        setAiAnalysis({
          ...cachedData,
          loading: false,
          error: null
        })
        return
      }
    }

    setAiAnalysis(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const { data, error } = await supabase.functions.invoke('dashboard-ai-analysis', {
        body: { storeId }
      })

      if (error) throw error

      const analysisData = {
        summary: data.summary || '',
        insights: data.insights || [],
        improvements: data.improvements || [],
        reservationAnalysis: data.reservationAnalysis || '',
        questionCategories: data.questionCategories || [],
        topCustomersByMessages: data.topCustomersByMessages || [],
        topCustomersByReservations: data.topCustomersByReservations || [],
        popularMenus: data.popularMenus || [],
        staffStats: data.staffStats || [],
        loading: false,
        error: null
      }

      setAiAnalysis(analysisData)
      
      // localStorageに保存
      saveAIAnalysisToStorage({
        summary: analysisData.summary,
        insights: analysisData.insights,
        improvements: analysisData.improvements,
        reservationAnalysis: analysisData.reservationAnalysis,
        questionCategories: analysisData.questionCategories,
        topCustomersByMessages: analysisData.topCustomersByMessages,
        topCustomersByReservations: analysisData.topCustomersByReservations,
        popularMenus: analysisData.popularMenus,
        staffStats: analysisData.staffStats
      })
    } catch (error) {
      console.error('AI Analysis Error:', error)
      setAiAnalysis(prev => ({
        ...prev,
        loading: false,
        error: 'AI分析の取得に失敗しました'
      }))
    }
  }

  // Load from localStorage on mount
  useEffect(() => {
    if (storeId && isPro) {
      const cachedData = loadAIAnalysisFromStorage()
      if (cachedData) {
        setAiAnalysis({
          ...cachedData,
          loading: false,
          error: null
        })
      }
    }
  }, [storeId, isPro, loadAIAnalysisFromStorage])

  // Fetch AI analysis when tab changes to analysis
  useEffect(() => {
    if (activeTab === 'analysis' && isPro && !aiAnalysis.summary && !aiAnalysis.loading) {
      fetchAIAnalysis(false) // localStorageから読み込みを試みる
    }
  }, [activeTab, isPro, storeId])

  useEffect(() => {
    if (replyModalOpen && storeId) {
      const fetchQuota = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('get-line-quota', {
            body: { storeId }
          })
          if (error) throw error
          setQuotaInfo(data as LineQuotaInfo)
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

      <div className="shrink-0 z-20 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-200 w-full">
        <div className="px-4 sm:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">ダッシュボード</h1>
              <p className="text-sm text-gray-500">予約状況や顧客の動向を一目で確認できます。</p>
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
      </div>

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
            {quotaInfo && <LineMessagingQuotaFooterLinks align="right" />}
          </div>
        }
      >
        <div className="space-y-4">
            <LineMessagingQuotaPanel quotaInfo={quotaInfo} />

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

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="w-full">
          <UnderlineTabs
            activeId={activeTab}
            onChange={setActiveTab}
            items={[
              { id: 'graphs', label: 'グラフ', icon: BarChart3, hideLabelOnMobile: true },
              {
                id: 'messages',
                label: 'メッセージ',
                icon: MessageSquare,
                hideLabelOnMobile: true,
                badge:
                  stats.manualReplyNeeded > 0 ? (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {stats.manualReplyNeeded}
                    </span>
                  ) : undefined,
              },
              {
                id: 'analysis',
                label: '詳細分析',
                icon: Search,
                hideLabelOnMobile: true,
                badge: !isPro ? <ProBadge /> : undefined,
              },
            ]}
          />
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">

            {/* Tab Content */}
            {activeTab === 'graphs' && (
              <div className="space-y-6">
        {/* Alert Banner */}
        {stats.manualReplyNeeded > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-800">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
              <p className="font-medium">
                現在、<span className="font-bold text-red-700 text-lg mx-1">{stats.manualReplyNeeded}件</span>のお客様への対応が必要です。
              </p>
                    <button 
                      onClick={() => setActiveTab('messages')}
                      className="ml-auto px-3 py-1 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                      対応する
                    </button>
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
        <div className={`bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition relative overflow-hidden ${!isPro ? 'bg-gray-50' : ''}`}>
          {!isPro && (
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

      {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Message Trend Chart */}
                  <div className="bg-gradient-to-br from-white to-primary-50/30 p-5 rounded-2xl border border-primary-100/50 shadow-sm hover:shadow-lg transition-all duration-300">
                    <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                        <TrendingUp size={16} className="text-primary-600" />
                      </div>
                      メッセージ推移（過去14日間）
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyData}>
                          <defs>
                            <linearGradient id="messageGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.25} />
                              <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
                            </linearGradient>
                            <filter id="glow">
                              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                              <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                              </feMerge>
                            </filter>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                              border: 'none',
                              borderRadius: '16px',
                              boxShadow: '0 20px 40px -10px rgba(0, 184, 169, 0.2), 0 10px 20px -5px rgba(0, 0, 0, 0.08)',
                              padding: '14px 18px',
                              backdropFilter: 'blur(8px)'
                            }}
                            labelStyle={{ color: '#1F2937', fontWeight: 700, marginBottom: '6px', fontSize: '14px' }}
                            formatter={(value) => [`${value}件`, 'メッセージ数']}
                            cursor={{ stroke: CHART_COLORS.primary, strokeWidth: 1, strokeDasharray: '5 5' }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="count" 
                            stroke={CHART_COLORS.primary}
                            strokeWidth={3}
                            dot={{ fill: '#fff', strokeWidth: 3, r: 5, stroke: CHART_COLORS.primary }}
                            activeDot={{ r: 8, fill: CHART_COLORS.primary, stroke: '#fff', strokeWidth: 3, filter: 'url(#glow)' }}
                            fill="url(#messageGradient)"
                          />
                        </LineChart>
                      </ResponsiveContainer>
        </div>
      </div>

                  {/* Status Distribution Pie Chart */}
                  <div className="bg-gradient-to-br from-white to-primary-50/30 p-5 rounded-2xl border border-primary-100/50 shadow-sm hover:shadow-lg transition-all duration-300">
                    <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                        <BarChart3 size={16} className="text-primary-600" />
                      </div>
                      ステータス分布
                    </h3>
                    <div className="h-64">
                      {statusData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <defs>
                              <filter id="pieGlow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                <feMerge>
                                  <feMergeNode in="coloredBlur"/>
                                  <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                              </filter>
                            </defs>
                            <Pie
                              data={statusData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={85}
                              paddingAngle={4}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              {statusData.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={entry.color}
                                  stroke="#fff"
                                  strokeWidth={3}
                                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                                />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                                border: 'none',
                                borderRadius: '16px',
                                boxShadow: '0 20px 40px -10px rgba(0, 184, 169, 0.2), 0 10px 20px -5px rgba(0, 0, 0, 0.08)',
                                padding: '14px 18px',
                                backdropFilter: 'blur(8px)'
                              }}
                              formatter={(value) => [`${value}件`, '']}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-400">
                          データがありません
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Weekday Distribution Bar Chart */}
                <div className="bg-gradient-to-br from-white to-primary-50/30 p-5 rounded-2xl border border-primary-100/50 shadow-sm hover:shadow-lg transition-all duration-300">
                  <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                      <BarChart3 size={16} className="text-primary-600" />
                    </div>
                    曜日別メッセージ数
                  </h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weekdayData}>
                        <defs>
                          <linearGradient id="weekdayGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_COLORS.primaryLight} stopOpacity={1}/>
                            <stop offset="100%" stopColor={CHART_COLORS.primaryDark} stopOpacity={1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis 
                          dataKey="day" 
                          tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                            border: 'none',
                            borderRadius: '16px',
                            boxShadow: '0 20px 40px -10px rgba(0, 184, 169, 0.2), 0 10px 20px -5px rgba(0, 0, 0, 0.08)',
                            padding: '14px 18px',
                            backdropFilter: 'blur(8px)'
                          }}
                          labelStyle={{ color: '#1F2937', fontWeight: 700, marginBottom: '6px' }}
                          formatter={(value) => [`${value}件`, 'メッセージ数']}
                          cursor={{ fill: 'rgba(0, 184, 169, 0.08)' }}
                        />
                        <Bar 
                          dataKey="count" 
                          fill="url(#weekdayGradient)" 
                          radius={[10, 10, 0, 0]}
                          style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 184, 169, 0.2))' }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* User Count Trend Chart */}
                <div className="bg-gradient-to-br from-white to-primary-50/30 p-5 rounded-2xl border border-primary-100/50 shadow-sm hover:shadow-lg transition-all duration-300">
                  <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                      <Users size={16} className="text-primary-600" />
                    </div>
                    ユーザー数推移（過去14日間）
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyUserData}>
                        <defs>
                          <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.25}/>
                            <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                            border: 'none',
                            borderRadius: '16px',
                            boxShadow: '0 20px 40px -10px rgba(0, 184, 169, 0.2), 0 10px 20px -5px rgba(0, 0, 0, 0.08)',
                            padding: '14px 18px',
                            backdropFilter: 'blur(8px)'
                          }}
                          labelStyle={{ color: '#1F2937', fontWeight: 700, marginBottom: '6px' }}
                          formatter={(value) => [`${value}人`, 'ユーザー数']}
                          cursor={{ stroke: CHART_COLORS.primary, strokeWidth: 1, strokeDasharray: '5 5' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="count" 
                          stroke={CHART_COLORS.primary}
                          strokeWidth={3}
                          dot={{ fill: '#fff', strokeWidth: 3, r: 5, stroke: CHART_COLORS.primary }}
                          activeDot={{ r: 8, fill: CHART_COLORS.primary, stroke: '#fff', strokeWidth: 3 }}
                          fill="url(#userGradient)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Reservation Trend Chart */}
                <div className="bg-gradient-to-br from-white to-primary-50/30 p-5 rounded-2xl border border-primary-100/50 shadow-sm hover:shadow-lg transition-all duration-300">
                  <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                      <Calendar size={16} className="text-primary-600" />
                    </div>
                    予約数推移（過去14日間）
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyReservationData}>
                        <defs>
                          <linearGradient id="reservationGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.25}/>
                            <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                            border: 'none',
                            borderRadius: '16px',
                            boxShadow: '0 20px 40px -10px rgba(0, 184, 169, 0.2), 0 10px 20px -5px rgba(0, 0, 0, 0.08)',
                            padding: '14px 18px',
                            backdropFilter: 'blur(8px)'
                          }}
                          labelStyle={{ color: '#1F2937', fontWeight: 700, marginBottom: '6px' }}
                          formatter={(value) => [`${value}件`, '予約数']}
                          cursor={{ stroke: CHART_COLORS.primary, strokeWidth: 1, strokeDasharray: '5 5' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="count" 
                          stroke={CHART_COLORS.primary}
                          strokeWidth={3}
                          dot={{ fill: '#fff', strokeWidth: 3, r: 5, stroke: CHART_COLORS.primary }}
                          activeDot={{ r: 8, fill: CHART_COLORS.primary, stroke: '#fff', strokeWidth: 3 }}
                          fill="url(#reservationGradient)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Menu Analysis Bar Chart */}
                {menuData.length > 0 && (
                  <div className="bg-gradient-to-br from-white to-primary-50/30 p-5 rounded-2xl border border-primary-100/50 shadow-sm hover:shadow-lg transition-all duration-300">
                    <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                        <BarChart3 size={16} className="text-primary-600" />
                      </div>
                      メニュー別予約数
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={menuData} layout="vertical">
                          <defs>
                            <linearGradient id="menuGradient" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor={CHART_COLORS.primaryLight} stopOpacity={1}/>
                              <stop offset="100%" stopColor={CHART_COLORS.primaryDark} stopOpacity={1}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                          <XAxis 
                            type="number"
                            tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <YAxis 
                            type="category"
                            dataKey="name" 
                            tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }}
                            tickLine={false}
                            axisLine={false}
                            width={100}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                              border: 'none',
                              borderRadius: '16px',
                              boxShadow: '0 20px 40px -10px rgba(0, 184, 169, 0.2), 0 10px 20px -5px rgba(0, 0, 0, 0.08)',
                              padding: '14px 18px',
                              backdropFilter: 'blur(8px)'
                            }}
                            labelStyle={{ color: '#1F2937', fontWeight: 700, marginBottom: '6px' }}
                            formatter={(value) => [`${value}件`, '予約数']}
                          />
                          <Bar 
                            dataKey="count" 
                            fill="url(#menuGradient)" 
                            radius={[0, 8, 8, 0]}
                            style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 184, 169, 0.2))' }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Staff Analysis Bar Chart */}
                {staffData.length > 0 && (
                  <div className="bg-gradient-to-br from-white to-primary-50/30 p-5 rounded-2xl border border-primary-100/50 shadow-sm hover:shadow-lg transition-all duration-300">
                    <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                        <User size={16} className="text-primary-600" />
                      </div>
                      担当者別予約数
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={staffData} layout="vertical">
                          <defs>
                            <linearGradient id="staffGradient" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor={CHART_COLORS.primaryLight} stopOpacity={1}/>
                              <stop offset="100%" stopColor={CHART_COLORS.primaryDark} stopOpacity={1}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                          <XAxis 
                            type="number"
                            tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <YAxis 
                            type="category"
                            dataKey="name" 
                            tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }}
                            tickLine={false}
                            axisLine={false}
                            width={100}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                              border: 'none',
                              borderRadius: '16px',
                              boxShadow: '0 20px 40px -10px rgba(0, 184, 169, 0.2), 0 10px 20px -5px rgba(0, 0, 0, 0.08)',
                              padding: '14px 18px',
                              backdropFilter: 'blur(8px)'
                            }}
                            labelStyle={{ color: '#1F2937', fontWeight: 700, marginBottom: '6px' }}
                            formatter={(value) => [`${value}件`, '予約数']}
                          />
                          <Bar 
                            dataKey="count" 
                            fill="url(#staffGradient)" 
                            radius={[0, 8, 8, 0]}
                            style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 184, 169, 0.2))' }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'messages' && (
              <div className="bg-white rounded-xl border border-gray-100 flex flex-col min-h-0 overflow-hidden h-[600px]">
                <div className="p-4 border-b border-gray-100 shrink-0 bg-white z-10">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-gray-900">メッセージ・対応状況</h2>
                      {stats.manualReplyNeeded > 0 && (
                        <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                          要対応: {stats.manualReplyNeeded}
                        </span>
                      )}
                    </div>
                    
                    {/* Filter Tabs */}
                    <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto scrollbar-hide shrink-0">
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
                                <div className="hidden md:block"></div>
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
            )}

            {activeTab === 'analysis' && (
              <div className="relative min-h-[600px]">
                {!isPro ? (
                  <ProLockOverlay 
                    title="AI詳細分析"
                    description={
                      <div className="space-y-2">
                        <p>Gemini AIを活用した高度な分析機能です。</p>
                        <ul className="list-disc list-inside text-left space-y-1">
                          <li>顧客行動パターンの分析</li>
                          <li>よくある質問のカテゴリ分類</li>
                          <li>改善提案レポート</li>
                          <li>顧客ランキング表示</li>
                        </ul>
        </div>
                    }
                  />
                ) : (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                          <BarChart3 size={20} className="text-primary-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">AIによるデータ分析</h3>
                          <p className="text-gray-500 text-sm">過去30日間のデータを分析</p>
                        </div>
                      </div>
                      <button
                        onClick={() => fetchAIAnalysis(true)}
                        disabled={aiAnalysis.loading}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all text-sm font-medium disabled:opacity-50 flex items-center gap-2 shadow-sm"
                      >
                        {aiAnalysis.loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            分析中...
                          </>
                        ) : (
                          '分析を更新'
                        )}
                      </button>
                    </div>

                    {aiAnalysis.error && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-center gap-3">
                        <AlertCircle size={20} />
                        {aiAnalysis.error}
                      </div>
                    )}

                    {aiAnalysis.loading && !aiAnalysis.summary ? (
                      <div className="flex flex-col items-center justify-center py-20">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-full border-4 border-primary-100"></div>
                          <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary-600 border-t-transparent animate-spin"></div>
                        </div>
                        <p className="text-gray-500 mt-6 font-medium">AIがデータを分析しています...</p>
                        <p className="text-gray-400 text-sm mt-1">しばらくお待ちください</p>
                      </div>
                    ) : aiAnalysis.summary ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Summary Card */}
                        <div className="lg:col-span-2 bg-primary-50 p-5 rounded-xl border border-primary-100">
                          <div className="flex items-center gap-2 mb-3">
                            <TrendingUp size={18} className="text-primary-600" />
                            <h4 className="font-bold text-gray-800">今月の傾向サマリー</h4>
                          </div>
                          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{aiAnalysis.summary}</p>
                        </div>

                        {/* Reservation Analysis Card */}
                        {aiAnalysis.reservationAnalysis && (
                          <div className="lg:col-span-2 bg-primary-50/50 p-5 rounded-xl border border-primary-100">
                            <div className="flex items-center gap-2 mb-3">
                              <Calendar size={18} className="text-primary-600" />
                              <h4 className="font-bold text-gray-800">予約状況の分析</h4>
                            </div>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{aiAnalysis.reservationAnalysis}</p>
                          </div>
                        )}

                        {/* Insights Card */}
                        <div className="bg-white p-5 rounded-xl border border-primary-100 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <Lightbulb size={18} className="text-primary-600" />
                            <h4 className="font-bold text-gray-800">気づき</h4>
                          </div>
                          <ul className="space-y-2.5">
                            {aiAnalysis.insights.map((insight, index) => (
                              <li key={index} className="flex items-start gap-2.5 text-gray-700">
                                <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                  {index + 1}
                                </span>
                                <span className="text-sm">{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Improvements Card */}
                        <div className="bg-white p-5 rounded-xl border border-primary-100 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <Target size={18} className="text-primary-600" />
                            <h4 className="font-bold text-gray-800">改善提案</h4>
                          </div>
                          <ul className="space-y-2.5">
                            {aiAnalysis.improvements.map((improvement, index) => (
                              <li key={index} className="flex items-start gap-2.5 text-gray-700">
                                <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                  {index + 1}
                                </span>
                                <span className="text-sm">{improvement}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Question Categories Card */}
                        {aiAnalysis.questionCategories.length > 0 && (
                          <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-primary-100 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <FolderOpen size={18} className="text-primary-600" />
                              <h4 className="font-bold text-gray-800">よくある質問のカテゴリ分類</h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {aiAnalysis.questionCategories.map((category, index) => (
                                <div key={index} className="p-4 bg-gradient-to-br from-primary-50 to-primary-50/50 rounded-lg border border-primary-100">
                                  <div className="flex items-center justify-between mb-2">
                                    <h5 className="font-bold text-gray-800 text-sm">{category.category}</h5>
                                    <span className="text-xs font-bold text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full">
                                      {category.count}件
                                    </span>
                                  </div>
                                  <ul className="space-y-1.5 mt-2">
                                    {category.examples.map((example, exIndex) => (
                                      <li key={exIndex} className="text-xs text-gray-600 flex items-start gap-1.5">
                                        <span className="text-primary-500 mt-0.5">•</span>
                                        <span className="flex-1">{example}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Top Customers by Messages Card */}
                        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <MessageSquare size={18} className="text-primary-600" />
                            <h4 className="font-bold text-gray-800">メッセージ数ランキング</h4>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                            {aiAnalysis.topCustomersByMessages.map((customer, index) => (
                              <div key={index} className={`p-3 rounded-lg border transition-all hover:shadow-md ${
                                index === 0 ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200' :
                                index === 1 ? 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200' :
                                index === 2 ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200' :
                                'bg-white border-gray-100'
                              }`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                    index === 0 ? 'bg-yellow-500 text-white shadow-sm' :
                                    index === 1 ? 'bg-gray-400 text-white shadow-sm' :
                                    index === 2 ? 'bg-orange-500 text-white shadow-sm' :
                                    'bg-gray-300 text-gray-700'
                                  }`}>
                                    {index + 1}
                                  </span>
                                  <p className="font-semibold text-gray-800 truncate text-sm flex-1">{customer.name}</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <MessageSquare size={14} className="text-primary-500" />
                                  <span className="text-xs text-gray-600">メッセージ</span>
                                  <span className="ml-auto text-sm font-bold text-gray-800">{customer.count}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Top Customers by Reservations Card */}
                        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <Calendar size={18} className="text-primary-600" />
                            <h4 className="font-bold text-gray-800">予約数ランキング</h4>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                            {aiAnalysis.topCustomersByReservations.map((customer, index) => (
                              <div key={index} className={`p-3 rounded-lg border transition-all hover:shadow-md ${
                                index === 0 ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200' :
                                index === 1 ? 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200' :
                                index === 2 ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200' :
                                'bg-white border-gray-100'
                              }`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                    index === 0 ? 'bg-yellow-500 text-white shadow-sm' :
                                    index === 1 ? 'bg-gray-400 text-white shadow-sm' :
                                    index === 2 ? 'bg-orange-500 text-white shadow-sm' :
                                    'bg-gray-300 text-gray-700'
                                  }`}>
                                    {index + 1}
                                  </span>
                                  <p className="font-semibold text-gray-800 truncate text-sm flex-1">{customer.name}</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Calendar size={14} className="text-purple-500" />
                                  <span className="text-xs text-gray-600">予約</span>
                                  <span className="ml-auto text-sm font-bold text-gray-800">{customer.count}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Popular Menus Card */}
                        {aiAnalysis.popularMenus.length > 0 && (
                          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <BarChart3 size={18} className="text-primary-600" />
                              <h4 className="font-bold text-gray-800">人気メニュー</h4>
                            </div>
                            <div className="space-y-2">
                              {aiAnalysis.popularMenus.map((menu, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                      index === 0 ? 'bg-primary-500 text-white' :
                                      'bg-gray-200 text-gray-600'
                                    }`}>
                                      {index + 1}
                                    </span>
                                    <span className="text-sm font-medium text-gray-700 truncate">{menu.name}</span>
                                  </div>
                                  <span className="text-sm text-gray-500 font-medium">{menu.count}件</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Staff Stats Card */}
                        {aiAnalysis.staffStats.length > 0 && (
                          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <User size={18} className="text-primary-600" />
                              <h4 className="font-bold text-gray-800">担当者別予約数</h4>
                            </div>
                            <div className="space-y-2">
                              {aiAnalysis.staffStats.map((staff, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                      index === 0 ? 'bg-primary-500 text-white' :
                                      'bg-gray-200 text-gray-600'
                                    }`}>
                                      {index + 1}
                                    </span>
                                    <span className="text-sm font-medium text-gray-700">{staff.name}</span>
                                  </div>
                                  <span className="text-sm text-gray-500 font-medium">{staff.count}件</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
                          <BarChart3 size={28} className="text-primary-400" />
                        </div>
                        <p className="text-gray-600 font-medium">AIによる分析を開始しましょう</p>
                        <p className="text-gray-400 text-sm mt-1">「分析を更新」をクリックしてください</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
