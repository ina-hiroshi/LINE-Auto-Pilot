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
  const [hasLineAccount, setHasLineAccount] = useState<boolean | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      if (session) {
        await checkLineAccount(session.user.id)
      } else {
        setLoading(false)
      }
    }
    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) {
        // Only check if we don't know yet or if we think we don't have one (re-check)
        if (hasLineAccount === null || hasLineAccount === false) {
            await checkLineAccount(session.user.id)
        }
      } else {
        setHasLineAccount(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkLineAccount = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('line_accounts')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()
      
      if (error) {
        console.error('Error checking line account:', error)
      }
      
      setHasLineAccount(!!data)
    } catch (error) {
      console.error('Error checking line account:', error)
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
            {!hasLineAccount ? (
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
