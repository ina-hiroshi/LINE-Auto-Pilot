import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import LineSettings from './pages/LineSettings'
import AutoResponses from './pages/AutoResponses'
import Customers from './pages/Customers'
import TopPage from './pages/TopPage'
import InitialSetup from './pages/InitialSetup'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [hasStore, setHasStore] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true

    // 安全策: 5秒経過してもロードが終わらない場合は強制的にロードを終了する
    const timeoutId = setTimeout(() => {
      if (mounted) {
        setLoading(prev => {
          if (prev) console.warn('Loading timed out, forcing render')
          return false
        })
      }
    }, 5000)

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        setSession(session)
        
        if (session) {
          await checkStore(session.user.id)
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error('Initialization error:', error)
        if (mounted) setLoading(false)
      }
    }
    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      setSession(session)
      
      if (session) {
        if (event === 'SIGNED_IN' || hasStore === null) {
           await checkStore(session.user.id)
        }
      } else {
        setHasStore(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  const checkStore = async (userId: string) => {
    try {
      // maybeSingle()は複数行あるとエラーになるため、limit(1)でリストとして取得して存在確認する
      const { data, error } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', userId)
        .limit(1)
      
      if (error) {
        console.warn('Store check failed:', error.message)
        setHasStore(false)
      } else {
        // 配列が空でなければストアが存在する
        setHasStore(data && data.length > 0)
      }
    } catch (error) {
      console.error('Unexpected error checking store:', error)
      setHasStore(false)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <BrowserRouter>
      <Routes>
        {!session ? (
          <Route path="*" element={<TopPage />} />
        ) : (
          <>
            {!hasStore ? (
              <>
                <Route path="/initial-setup" element={<InitialSetup />} />
                <Route path="*" element={<Navigate to="/initial-setup" replace />} />
              </>
            ) : (
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="line-settings" element={<LineSettings />} />
                <Route path="auto-responses" element={<AutoResponses />} />
                <Route path="customers" element={<Customers />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            )}
          </>
        )}
      </Routes>
    </BrowserRouter>
  )
}

export default App
