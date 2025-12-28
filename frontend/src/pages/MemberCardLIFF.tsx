import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2, CreditCard, AlertCircle } from 'lucide-react'
import liff from '@line/liff'
import { motion } from 'framer-motion'

type CardSettings = {
  title: string
  color: string
  logo_url: string | null
  template_id: string
}

type CustomerInfo = {
  line_user_id: string
  display_name: string
  points: number
  rank: string
  member_no: string
}

export default function MemberCardLIFF() {
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<CardSettings | null>(null)
  const [customer, setCustomer] = useState<CustomerInfo | null>(null)
  
  // Store ID from query param
  const storeId = searchParams.get('store_id')

  useEffect(() => {
    const init = async () => {
      try {
        // 1. Initialize LIFF
        // Note: In a real app, you should use the LIFF ID from the store settings or env
        // For now, we assume LIFF is initialized or we are in a dev environment
        // await liff.init({ liffId: "YOUR_LIFF_ID" }) 

        if (!storeId) {
          throw new Error('Store ID is required')
        }

        // 2. Fetch Store Settings
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('name, membership_card_title, membership_card_color, membership_card_logo_url, membership_card_template_id')
          .eq('id', storeId)
          .single()

        if (storeError) throw storeError

        // Set Document Title
        if (store.name) {
          document.title = `${store.name} - 会員証`
        }

        setSettings({
          title: store.membership_card_title || "MEMBER'S CARD",
          color: store.membership_card_color || '#000000',
          logo_url: store.membership_card_logo_url,
          template_id: store.membership_card_template_id || 'simple'
        })

        // 3. Fetch Customer Data
        let userId = 'mock_user'
        let displayName = 'ゲスト様'

        if (liff.isInClient() || liff.isLoggedIn()) {
           try {
             const profile = await liff.getProfile()
             userId = profile.userId
             displayName = profile.displayName
           } catch (e) {
             console.error('LIFF profile error:', e)
           }
        }

        // Fetch Points
        const { data: pointsData } = await supabase
          .from('points')
          .select('balance')
          .eq('store_id', storeId)
          .eq('line_user_id', userId)
          .maybeSingle()
        
        const currentPoints = pointsData?.balance || 0
        
        // Calculate Rank
        const getRank = (p: number) => {
          if (p >= 1000) return 'Platinum'
          if (p >= 500) return 'Gold'
          if (p >= 100) return 'Silver'
          return 'Bronze'
        }

        setCustomer({
          line_user_id: userId,
          display_name: displayName,
          points: currentPoints,
          rank: getRank(currentPoints),
          member_no: userId.substring(0, 8).toUpperCase()
        })

        // 4. Realtime Subscription
        const channel = supabase
          .channel(`points-${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'points',
              filter: `line_user_id=eq.${userId}`
            },
            (payload) => {
              console.log('Points updated:', payload)
              const newBalance = (payload.new as { balance: number }).balance
              setCustomer(prev => prev ? ({
                ...prev,
                points: newBalance,
                rank: getRank(newBalance)
              }) : null)
            }
          )
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }

      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [storeId])

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (error || !settings || !customer) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50 p-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-800 font-bold mb-2">エラーが発生しました</p>
        <p className="text-gray-600 text-sm">{error || 'データの読み込みに失敗しました'}</p>
      </div>
    )
  }

  // Template Styles
  const getContainerStyle = () => {
    switch (settings.template_id) {
      case 'dark': return 'bg-slate-950'
      case 'elegant': return 'bg-[#F5F5F0]'
      case 'pop': return 'bg-primary-50'
      default: return 'bg-gray-100' // simple
    }
  }

  const getCardStyle = () => {
    const base = "w-full aspect-[1.586/1] rounded-xl shadow-xl p-6 relative overflow-hidden transition-all duration-300"
    switch (settings.template_id) {
      case 'simple': return `${base} text-gray-800 border border-gray-100 bg-white`
      case 'elegant': return `${base} text-[#44403C] border border-[#E7E5E4] bg-white`
      case 'pop': return `${base} text-gray-800 border-2 border-white bg-white`
      case 'dark': return `${base} text-slate-200 border border-slate-700 bg-slate-900`
      default: return `${base} text-white`
    }
  }

  const getCardBackground = () => {
    if (settings.template_id === 'simple') return { backgroundColor: settings.color } // This was actually wrong in my previous revert plan, simple uses color for top bar only now. Wait, simple uses bg-white.
    // Let's check the previous code for simple. Simple was white bg.
    // Pop was white bg.
    return {} 
  }

  return (
    <div className={`min-h-screen p-4 flex flex-col items-center ${getContainerStyle()}`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6"
      >
        {/* Card Component */}
        <div className={getCardStyle()} style={getCardBackground()}>
          {/* Background Accents */}
          {settings.template_id === 'simple' && (
            <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: settings.color }}></div>
          )}
          {settings.template_id === 'elegant' && (
            <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#44403C 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          )}
          {settings.template_id === 'pop' && (
            <>
              <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-200 rounded-bl-full opacity-50"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-primary-200 rounded-tr-full opacity-50"></div>
            </>
          )}
          {settings.template_id === 'dark' && (
            <>
              <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]"></div>
              <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-slate-800/50 to-transparent"></div>
            </>
          )}

          {/* Card Content */}
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex justify-between items-start">
              <h3 className={`font-bold text-lg tracking-wider ${settings.template_id === 'elegant' ? 'font-serif' : ''}`}>
                {settings.title}
              </h3>
              <div className={`p-2 rounded-lg backdrop-blur-sm ${
                settings.template_id === 'simple' ? 'bg-gray-50' : 
                settings.template_id === 'elegant' ? 'bg-[#F5F5F0]' :
                settings.template_id === 'pop' ? 'bg-primary-100 text-primary-600' :
                'bg-slate-800 text-slate-400'
              }`}>
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="w-6 h-6 object-contain" />
                ) : (
                  <CreditCard className={`w-6 h-6 ${
                    settings.template_id === 'simple' ? 'text-gray-400' :
                    settings.template_id === 'elegant' ? 'text-[#44403C]' :
                    settings.template_id === 'pop' ? 'text-primary-600' :
                    'text-slate-400'
                  }`} />
                )}
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className={`text-xs mb-1 ${settings.template_id === 'pop' ? 'opacity-75' : 'opacity-60'}`}>MEMBER NAME</p>
                  <p className={`font-medium tracking-wide ${settings.template_id === 'elegant' ? 'font-serif' : ''}`}>
                    {customer.display_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-xs mb-1 ${settings.template_id === 'pop' ? 'opacity-75' : 'opacity-60'}`}>POINTS</p>
                  <p className={`text-2xl font-bold ${settings.template_id === 'pop' ? 'text-primary-600' : settings.template_id === 'elegant' ? 'font-serif' : ''}`}>
                    {customer.points.toLocaleString()} pt
                  </p>
                </div>
              </div>
              
              <div className={`pt-2 border-t flex justify-between text-xs ${
                settings.template_id === 'simple' ? 'border-gray-100 text-gray-400' :
                settings.template_id === 'elegant' ? 'border-[#E7E5E4]' :
                settings.template_id === 'pop' ? 'border-gray-100 text-gray-500' :
                'border-slate-700 text-slate-500'
              }`}>
                <span>No. {customer.member_no}</span>
                <span>Rank: {customer.rank}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Barcode / QR Code Area (Placeholder) */}
        <div className="bg-white p-6 rounded-xl shadow-sm text-center space-y-4">
          <p className="text-sm text-gray-500">会員バーコード</p>
          <div className="h-16 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400 tracking-widest">
            ||| || ||| || |||| ||| || || |||
          </div>
          <p className="text-xs text-gray-400">{customer.member_no}</p>
        </div>

      </motion.div>
    </div>
  )
}
