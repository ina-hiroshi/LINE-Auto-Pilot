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
import MembershipCard from './pages/MembershipCard'
import RichMenu from './pages/RichMenu'
import BookingSettings from './pages/BookingSettings'
import Reservations from './pages/Reservations'
import TopPage from './pages/TopPage'
import Onboarding from './pages/Onboarding'
import Booking from './pages/Booking'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import SpecifiedCommercialTransactions from './pages/SpecifiedCommercialTransactions'
import SecurityPolicy from './pages/SecurityPolicy'
import PlanSettings from './pages/PlanSettings'

import MemberCardLIFF from './pages/MemberCardLIFF'
import FeatureAutoResponse from './pages/FeatureAutoResponse'
import FeatureReservation from './pages/FeatureReservation'
import FeatureMembership from './pages/FeatureMembership'
import AdminDashboard from './pages/AdminDashboard'
import { UserFeaturesProvider } from './hooks/useUserFeatures'

import type { Session } from '@supabase/supabase-js'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasStore, setHasStore] = useState<boolean | null>(null)
  const [hasLineAccount, setHasLineAccount] = useState<boolean | null>(null)
  const lastCheckedUserId = useRef<string | null>(null)

  // ストアとLINE連携の存在確認関数（タイムアウト付き）
  const checkStoreAndLine = async (userId: string): Promise<{ hasStore: boolean; hasLine: boolean }> => {
    try {
      console.log('Checking store and LINE account for user:', userId)
      
      // 5秒でタイムアウト
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Check timeout')), 5000)
      )

      const checkStorePromise = supabase
        .from('stores')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle()
      
      const result = await Promise.race([checkStorePromise, timeoutPromise])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: storeData, error: storeError } = result as any
      
      if (storeError) {
        console.warn('Store check failed:', storeError.message)
        return { hasStore: false, hasLine: false }
      }
      
      const storeExists = !!storeData
      
      // ストアが存在する場合のみLINE連携をチェック
      if (storeExists && storeData) {
        const checkLinePromise = supabase
          .from('line_accounts')
          .select('id')
          .eq('store_id', storeData.id)
          .maybeSingle()
        
        const lineResult = await Promise.race([checkLinePromise, timeoutPromise])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: lineData, error: lineError } = lineResult as any
        
        if (lineError) {
          console.warn('LINE account check failed:', lineError.message)
          return { hasStore: storeExists, hasLine: false }
        }
        
        return { hasStore: storeExists, hasLine: !!lineData }
      }
      
      return { hasStore: storeExists, hasLine: false }
    } catch (error) {
      console.error('Unexpected error checking store and LINE:', error)
      return { hasStore: false, hasLine: false }
    }
  }

  useEffect(() => {
    let mounted = true

    const handleSessionCheck = async (currentSession: Session | null) => {
      if (!mounted) return

      if (!currentSession) {
        setSession(null)
        setHasStore(null)
        setHasLineAccount(null)
        setLoading(false)
        lastCheckedUserId.current = null
        return
      }

      setSession(currentSession)

      // ユーザーが変わった場合、または初回チェック
      if (currentSession.user.id !== lastCheckedUserId.current) {
        lastCheckedUserId.current = currentSession.user.id
        
        // ストアとLINE連携を確認
        const { hasStore, hasLine } = await checkStoreAndLine(currentSession.user.id)
        
        if (mounted) {
          setHasStore(hasStore)
          setHasLineAccount(hasLine)
          setLoading(false)
        }
      } else {
        // すでにチェック済みのユーザーの場合
        if (mounted) {
           setLoading(false)
        }
      }
    }

    // 1. イベントリスナーの登録
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSessionCheck(session)
    })

    // 2. 初期化時に一度だけ現在の状態を確認
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && !lastCheckedUserId.current) {
         handleSessionCheck(session)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSetupComplete = () => {
    console.log('Setup complete, updating state...')
    setHasStore(true)
    setHasLineAccount(true)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="mb-4"
        >
          <Loader2 className="w-12 h-12 text-primary-600" />
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

  return (
    <BrowserRouter>
      <UserFeaturesProvider>
      <Routes>
        <Route path="/booking" element={<Booking />} />
        <Route path="/member-card" element={<MemberCardLIFF />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/specified-commercial-transactions" element={<SpecifiedCommercialTransactions />} />
        <Route path="/security" element={<SecurityPolicy />} />
        <Route path="/feature/auto-response" element={<FeatureAutoResponse />} />
        <Route path="/feature/reservation" element={<FeatureReservation />} />
        <Route path="/feature/membership" element={<FeatureMembership />} />
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
                <Loader2 className="w-12 h-12 text-primary-600" />
              </motion.div>
              <p className="text-slate-600 font-medium">情報を確認中...</p>
            </div>
          } />
        ) : hasStore === false || hasLineAccount === false ? (
          <>
            <Route path="/onboarding" element={<Onboarding onComplete={handleSetupComplete} />} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          </>
        ) : (
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/reservations" element={<Reservations />} />
            <Route path="/line-settings" element={<LineSettings />} />
            <Route path="/auto-responses" element={<AutoResponses />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/membership-card" element={<MembershipCard />} />
            <Route path="/rich-menu" element={<RichMenu />} />
            <Route path="/booking-settings" element={<BookingSettings />} />
            <Route path="/plan-settings" element={<PlanSettings />} />
            <Route path="/dev" element={<AdminDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
      </UserFeaturesProvider>
    </BrowserRouter>
  )
}

export default App
