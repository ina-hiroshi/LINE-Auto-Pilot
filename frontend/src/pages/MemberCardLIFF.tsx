import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2, CreditCard, AlertCircle, Stamp } from 'lucide-react'
import liff from '@line/liff'
import { motion } from 'framer-motion'

type CardSettings = {
  title: string
  color: string
  logo_url: string | null
  template_id: string
  card_type: 'point' | 'stamp'
  name_display: 'real_kanji' | 'real_romaji' | 'line_name'
  show_icon: boolean
  show_member_no: boolean
  show_rank: boolean
  stamp_config: {
    total_slots: number
    goal_reward: string
  }
  rank_settings: { name: string, threshold: number }[]
}

type CustomerInfo = {
  line_user_id: string
  display_name: string
  real_name: string | null
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
  const rankSettingsRef = useRef<any[]>([])
  
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
          .select('name, membership_card_title, membership_card_color, membership_card_logo_url, membership_card_template_id, membership_card_settings, membership_rank_settings')
          .eq('id', storeId)
          .single()

        if (storeError) throw storeError

        // Set Document Title
        if (store.name) {
          document.title = `${store.name} - 会員証`
        }

        const updateSettingsFromStore = (storeData: any) => {
          let cardSettings = storeData.membership_card_settings
          if (typeof cardSettings === 'string') {
            try {
              cardSettings = JSON.parse(cardSettings)
            } catch (e) {
              console.error('Failed to parse card settings', e)
              cardSettings = {}
            }
          }
          cardSettings = cardSettings || {}

          const rankSettings = storeData.membership_rank_settings || [
            { name: 'Bronze', threshold: 0 },
            { name: 'Silver', threshold: 100 },
            { name: 'Gold', threshold: 500 }
          ]
          
          rankSettingsRef.current = rankSettings

          // Ensure stamp_config values are properly typed
          const stampConfig = cardSettings.stamp_config || { total_slots: 20, goal_reward: '特典チケット' }
          const safeStampConfig = {
            total_slots: Number(stampConfig.total_slots) || 20,
            goal_reward: stampConfig.goal_reward || '特典チケット'
          }

          setSettings({
            title: storeData.membership_card_title || "MEMBER'S CARD",
            color: storeData.membership_card_color || '#000000',
            logo_url: storeData.membership_card_logo_url,
            template_id: storeData.membership_card_template_id || 'simple',
            card_type: cardSettings.card_type || 'point',
            name_display: cardSettings.name_display || 'line_name',
            show_icon: cardSettings.show_icon ?? true,
            show_member_no: cardSettings.show_member_no ?? true,
            show_rank: cardSettings.show_rank ?? true,
            stamp_config: safeStampConfig,
            rank_settings: rankSettings
          })
        }

        updateSettingsFromStore(store)

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

        // Fetch Real Name from Customers table
        const { data: customerData } = await supabase
          .from('customers')
          .select('real_name')
          .eq('store_id', storeId)
          .eq('line_user_id', userId)
          .maybeSingle()

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
          // Sort ranks by threshold desc
          const sortedRanks = [...rankSettingsRef.current].sort((a: any, b: any) => b.threshold - a.threshold)
          const rank = sortedRanks.find((r: any) => p >= r.threshold)
          return rank ? rank.name : sortedRanks[sortedRanks.length - 1].name
        }

        setCustomer({
          line_user_id: userId,
          display_name: displayName,
          real_name: customerData?.real_name || null,
          points: currentPoints,
          rank: getRank(currentPoints),
          member_no: userId.substring(0, 8).toUpperCase()
        })

        // 4. Realtime Subscription
        const pointsChannel = supabase
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

        const storeChannel = supabase
          .channel(`store-settings-${storeId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'stores',
              filter: `id=eq.${storeId}`
            },
            (payload) => {
              console.log('Store settings updated:', payload)
              updateSettingsFromStore(payload.new)
            }
          )
          .subscribe()

        return () => {
          supabase.removeChannel(pointsChannel)
          supabase.removeChannel(storeChannel)
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
    // Match Preview logic: Simple uses white bg with colored top bar
    if (settings.template_id === 'pop' || settings.template_id === 'elegant') {
      return { backgroundColor: '#FFFFFF' }
    }
    return {} 
  }

  return (
    <div className={`min-h-screen p-4 flex flex-col items-center ${getContainerStyle()}`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
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
              {settings.show_icon && (
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
              )}
            </div>
            
            {settings.card_type === 'stamp' ? (
              <div className="flex-1 flex flex-col justify-between py-1">
                <div 
                  className={`grid ${settings.stamp_config.total_slots > 20 ? 'gap-0.5' : 'gap-1'} ${settings.stamp_config.total_slots <= 10 ? 'px-12' : ''}`}
                  style={{
                    gridTemplateColumns: `repeat(${
                      settings.stamp_config.total_slots <= 10 ? 5 :
                      settings.stamp_config.total_slots <= 20 ? 10 :
                      settings.stamp_config.total_slots <= 30 ? 12 :
                      settings.stamp_config.total_slots <= 40 ? 14 : 17
                    }, minmax(0, 1fr))`
                  }}
                >
                  {Array.from({ length: settings.stamp_config.total_slots }).map((_, i) => (
                    <div key={i} className={`aspect-square rounded-full border flex items-center justify-center ${
                      settings.stamp_config.total_slots > 30 ? 'text-[6px]' : 'text-[8px]'
                    } ${
                      i < customer.points 
                        ? (settings.template_id === 'pop' ? 'border-primary-500 text-primary-500 bg-primary-50' : 'border-current opacity-80') 
                        : (settings.template_id === 'dark' ? 'border-slate-700 text-slate-700' : 'border-gray-200 text-gray-300')
                    }`}>
                      {i < customer.points ? <Stamp className={settings.stamp_config.total_slots > 30 ? "w-2 h-2" : "w-2.5 h-2.5"} /> : i + 1}
                    </div>
                  ))}
                </div>
                
                <div className="space-y-0.5 mt-auto">
                  <div className={`text-right text-[10px] ${settings.template_id === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                    あと {Math.max(0, settings.stamp_config.total_slots - customer.points)} 個で {settings.stamp_config.goal_reward}
                  </div>

                  <div className="flex justify-between items-end border-t pt-1 border-dashed border-gray-300/30">
                    <div>
                      <p className={`text-[8px] mb-0.5 ${settings.template_id === 'pop' ? 'opacity-75' : 'opacity-60'}`}>MEMBER NAME</p>
                      <p className={`font-medium text-xs tracking-wide ${settings.template_id === 'elegant' ? 'font-serif' : ''}`}>
                        {settings.name_display === 'real_kanji' && customer.real_name ? customer.real_name : 
                         settings.name_display === 'real_romaji' && customer.real_name ? customer.real_name : 
                         customer.display_name}
                      </p>
                    </div>
                  </div>
                  
                  {(settings.show_member_no || settings.show_rank) && (
                    <div className={`flex justify-between text-[8px] ${
                      settings.template_id === 'simple' ? 'text-gray-400' :
                      settings.template_id === 'elegant' ? 'text-[#44403C]/60' :
                      settings.template_id === 'pop' ? 'text-gray-500' :
                      'text-slate-500'
                    }`}>
                      {settings.show_member_no && <span>No. {customer.member_no}</span>}
                      {settings.show_rank && <span>Rank: {customer.rank}</span>}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <p className={`text-xs mb-1 ${settings.template_id === 'pop' ? 'opacity-75' : 'opacity-60'}`}>MEMBER NAME</p>
                    <p className={`font-medium tracking-wide ${settings.template_id === 'elegant' ? 'font-serif' : ''}`}>
                      {settings.name_display === 'real_kanji' && customer.real_name ? customer.real_name : 
                       settings.name_display === 'real_romaji' && customer.real_name ? customer.real_name : 
                       customer.display_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs mb-1 ${settings.template_id === 'pop' ? 'opacity-75' : 'opacity-60'}`}>POINTS</p>
                    <p className={`text-2xl font-bold ${settings.template_id === 'pop' ? 'text-primary-600' : settings.template_id === 'elegant' ? 'font-serif' : ''}`}>
                      {customer.points.toLocaleString()} pt
                    </p>
                  </div>
                </div>
                
                {(settings.show_member_no || settings.show_rank) && (
                  <div className={`pt-2 border-t flex justify-between text-xs ${
                    settings.template_id === 'simple' ? 'border-gray-100 text-gray-400' :
                    settings.template_id === 'elegant' ? 'border-[#E7E5E4]' :
                    settings.template_id === 'pop' ? 'border-gray-100 text-gray-500' :
                    'border-slate-700 text-slate-500'
                  }`}>
                    {settings.show_member_no && <span>No. {customer.member_no}</span>}
                    {settings.show_rank && <span>Rank: {customer.rank}</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* QR Code Area */}
        <div className="bg-white p-6 rounded-xl shadow-sm text-center space-y-4">
          <p className="text-sm text-gray-500">会員QRコード</p>
          <div className="flex justify-center">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/customers?customer_id=${customer.line_user_id}`)}`}
              alt="Member QR Code"
              className="w-32 h-32"
            />
          </div>
          <p className="text-xs text-gray-400">{customer.member_no}</p>
          <p className="text-[10px] text-gray-300">スタッフに提示してください</p>
        </div>

      </motion.div>
    </div>
  )
}
