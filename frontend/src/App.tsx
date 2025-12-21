import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import LineSettings from './pages/LineSettings'
import AutoResponses from './pages/AutoResponses'
import Customers from './pages/Customers'
import TopPage from './pages/TopPage'
import InitialSetup from './pages/InitialSetup'
import DevSandbox from './pages/DevSandbox'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [hasStore, setHasStore] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lastCheckedUserId = useRef<string | null>(null)

  // ストアの存在確認関数（シンプル版）
  const checkStore = async (userId: string): Promise<boolean> => {
    try {
      console.log('Checking store for user:', userId)
      const { data, error } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle()
      
      if (error) {
        console.warn('Store check failed:', error.message)
        return false
      }
      
      return !!data
    } catch (error) {
      console.error('Unexpected error checking store:', error)
      return false
    }
  }

  useEffect(() => {
    let mounted = true

    // 初期セッション確認
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!mounted) return
        
        if (user) {
          setSession({ user })
          lastCheckedUserId.current = user.id
          
          // 初回チェック
          const exists = await checkStore(user.id)
          
          if (mounted) {
            setHasStore(exists)
            setLoading(false)
          }
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error('Init error:', error)
        if (mounted) {
          setError('初期化中にエラーが発生しました。')
          setLoading(false)
        }
      }
    }

    // 認証状態の監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (!mounted) return
      
      if (!currentSession) {
        setSession(null)
        setHasStore(null)
        setLoading(false)
        lastCheckedUserId.current = null
        return
      }

      setSession(currentSession)
      
      if (currentSession.user.id !== lastCheckedUserId.current) {
        setLoading(true)
        setError(null)
        lastCheckedUserId.current = currentSession.user.id
        const exists = await checkStore(currentSession.user.id)
        if (mounted) {
          setHasStore(exists)
          setLoading(false)
        }
      }
    })

    init()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSetupComplete = () => {
    console.log('Setup complete, updating state...')
    setHasStore(true)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="mb-4"
        >
          <Loader2 className="w-12 h-12 text-indigo-600" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-slate-600 font-medium"
        >
          読み込み中...
        </motion.p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <div className="text-red-500 mb-4 flex justify-center">
            <Loader2 className="w-12 h-12 animate-spin" /> 
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">通信エラー</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            再読み込み
          </button>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {!session ? (
          <Route path="*" element={<TopPage />} />
        ) : hasStore === null ? (
          // セッションはあるがストア確認中の場合もローディングを表示
          <Route path="*" element={
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="mb-4"
              >
                <Loader2 className="w-12 h-12 text-indigo-600" />
              </motion.div>
              <p className="text-slate-600 font-medium">情報を確認中...</p>
            </div>
          } />
        ) : hasStore === false ? (
          <>
            <Route path="/initial-setup" element={<InitialSetup onComplete={handleSetupComplete} />} />
            <Route path="*" element={<Navigate to="/initial-setup" replace />} />
          </>
        ) : (
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/line-settings" element={<LineSettings />} />
            <Route path="/auto-responses" element={<AutoResponses />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/dev" element={<DevSandbox />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  )
}

export default App
