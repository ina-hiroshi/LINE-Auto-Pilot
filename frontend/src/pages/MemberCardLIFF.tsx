import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2, AlertCircle, Stamp } from 'lucide-react'
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
  id: string
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

        // Check Plan
        const { data: plan } = await supabase.rpc('get_store_plan', { p_store_id: storeId })
        const isPro = plan === 'pro'

        // Set Document Title
        if (store.name) {
          document.title = `${store.name} - 会員証`
        }

        const updateSettingsFromStore = (storeData: any, isProPlan: boolean) => {
          console.log('Raw store data:', storeData)
          
          let cardSettings = storeData.membership_card_settings
          if (typeof cardSettings === 'string') {
            try {
              cardSettings = JSON.parse(cardSettings)
            } catch (e) {
              console.error('Failed to parse card settings', e)
              cardSettings = {}
            }
          }
          // Ensure cardSettings is an object
          cardSettings = cardSettings || {}
          console.log('Parsed card settings:', cardSettings)

          const rankSettings = storeData.membership_rank_settings || [
            { name: 'Bronze', threshold: 0 },
            { name: 'Silver', threshold: 100 },
            { name: 'Gold', threshold: 500 }
          ]
          
          rankSettingsRef.current = rankSettings

          // Helper for boolean values
          const getBool = (val: any, def: boolean) => {
            if (val === undefined || val === null) return def
            if (val === true || val === 'true') return true
            if (val === false || val === 'false') return false
            return def
          }

          // Ensure stamp_config values are properly typed
          const stampConfig = cardSettings.stamp_config || {}
          const safeStampConfig = {
            total_slots: Number(stampConfig.total_slots) || 20,
            goal_reward: stampConfig.goal_reward || '特典チケット'
          }

          setSettings({
            title: storeData.membership_card_title || "MEMBER'S CARD",
            color: isProPlan ? (storeData.membership_card_color || '#000000') : '#000000',
            logo_url: isProPlan ? storeData.membership_card_logo_url : null,
            template_id: isProPlan ? (storeData.membership_card_template_id || 'simple') : 'simple',
            card_type: cardSettings.card_type || 'point',
            name_display: cardSettings.name_display || 'line_name',
            show_icon: getBool(cardSettings.show_icon, true),
            show_member_no: getBool(cardSettings.show_member_no, true),
            show_rank: isProPlan ? getBool(cardSettings.show_rank, true) : false, // Rank is Pro feature? Maybe not, but let's keep it simple. Actually user didn't specify rank is pro only, but themes/colors are.
            stamp_config: safeStampConfig,
            rank_settings: rankSettings
          })
        }

        updateSettingsFromStore(store, isPro)

        // 3. Fetch Customer Data via Edge Function (Secure)
        let userId = 'mock_user'
        let displayName = 'ゲスト様'
        let realName = null
        let currentPoints = 0

        // Try to get LIFF token
        let accessToken = null
        if (liff.isInClient() || liff.isLoggedIn()) {
           accessToken = liff.getAccessToken()
        }

        // Function to fetch data (extracted for reuse)
        const fetchData = async (token: string | null) => {
          if (!token || !storeId) return

          try {
            const { data, error } = await supabase.functions.invoke('get-liff-customer', {
              body: { accessToken: token, storeId }
            })

            if (error) throw error

            if (data) {
              console.log('Fetched Data:', data)
              const newUserId = data.lineProfile?.userId || userId
              const newPoints = data.points?.balance || 0
              
              // Calculate Rank
              const currentRanks = rankSettingsRef.current.length > 0 ? rankSettingsRef.current : [
                { name: 'Bronze', threshold: 0 },
                { name: 'Silver', threshold: 100 },
                { name: 'Gold', threshold: 500 }
              ]
              
              const sortedRanks = [...currentRanks].sort((a: any, b: any) => b.threshold - a.threshold)
              const rankObj = sortedRanks.find((r: any) => newPoints >= r.threshold)
              const rankName = rankObj ? rankObj.name : sortedRanks[sortedRanks.length - 1].name

              const memberNo = newUserId.substring(0, 8).toUpperCase()

              console.log('Calculated Customer Data:', {
                line_user_id: newUserId,
                points: newPoints,
                rank: rankName,
                member_no: memberNo
              })

              setCustomer({
                id: data.customer?.id ?? newUserId,
                line_user_id: newUserId,
                display_name: data.lineProfile?.displayName || displayName,
                real_name: data.customer?.real_name || null,
                points: newPoints,
                rank: rankName,
                member_no: memberNo
              })
            }
          } catch (e) {
            console.error('Failed to fetch secure customer data:', e)
          }
        }

        if (accessToken) {
          await fetchData(accessToken)
        } else {
          // Fallback for dev/mock (if needed, or just keep defaults)
          console.log('No access token available, using mock/guest data')
          
          // Calculate Rank for mock
          const currentRanks = rankSettingsRef.current.length > 0 ? rankSettingsRef.current : [
            { name: 'Bronze', threshold: 0 },
            { name: 'Silver', threshold: 100 },
            { name: 'Gold', threshold: 500 }
          ]
          const sortedRanks = [...currentRanks].sort((a: any, b: any) => b.threshold - a.threshold)
          const rankObj = sortedRanks.find((r: any) => currentPoints >= r.threshold)
          const rankName = rankObj ? rankObj.name : sortedRanks[sortedRanks.length - 1].name
          
          setCustomer({
            id: userId,
            line_user_id: userId,
            display_name: displayName,
            real_name: realName,
            points: currentPoints,
            rank: rankName,
            member_no: userId.substring(0, 8).toUpperCase()
          })
        }

        // 4. Subscribe to Realtime Updates (Broadcast)
        if (storeId && accessToken) {
          const profile = await liff.getProfile().catch(() => null)
          const myUserId = profile?.userId

          if (myUserId) {
            supabase.channel(`points:${storeId}`)
              .on('broadcast', { event: 'update' }, (payload) => {
                if (payload.payload?.line_user_id === myUserId) {
                  console.log('Received point update signal, refetching...')
                  fetchData(accessToken)
                }
              })
              .subscribe()
          }
        }

        supabase
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
              updateSettingsFromStore(payload.new, isPro)
            }
          )
          .subscribe()

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
      case 'luxury': return 'bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950'
      case 'natural': return 'bg-gradient-to-b from-amber-100/60 via-orange-50/40 to-lime-50/30'
      default: return 'bg-gray-100' // simple
    }
  }

  const getCardStyle = () => {
    // aspect-ratioを削除し、min-hを設定してコンテンツ量に応じて伸縮するように変更
    // p-5 -> p-4 に変更して余白を節約
    const base = "w-full max-w-sm min-h-[220px] rounded-xl shadow-xl p-4 relative overflow-hidden transition-all duration-300 flex flex-col"
    switch (settings.template_id) {
      case 'simple': return `${base} text-gray-800 border border-gray-100 bg-white`
      case 'elegant': return `${base} text-[#44403C] border border-[#E7E5E4] bg-white`
      case 'pop': return `${base} text-gray-800 border-2 border-white bg-white`
      case 'dark': return `${base} text-slate-200 border border-slate-700 bg-slate-900`
      case 'luxury': return `${base} text-amber-100 bg-gradient-to-br from-stone-900 to-stone-950 border border-amber-600/30 shadow-[0_0_30px_-10px_rgba(217,119,6,0.3)]`
      case 'natural': return `${base} text-amber-950 bg-gradient-to-br from-orange-50/95 to-amber-50/90 border border-amber-300/40 shadow-lg shadow-amber-900/10`
      default: return `${base} text-white`
    }
  }

  const getCardBackground = () => {
    // Match Preview logic: Simple uses white bg with colored top bar
    if (settings.template_id === 'pop' || settings.template_id === 'elegant') {
      return { backgroundColor: '#FFFFFF' }
    }
    // luxuryとnaturalはクラスでグラデーション設定済み
    return {} 
  }

  // ロゴアイコンのスタイルを取得
  const getLogoStyle = () => {
    switch (settings.template_id) {
      case 'simple': return 'bg-gray-50'
      case 'elegant': return 'bg-[#F5F5F0]'
      case 'pop': return 'bg-primary-100 text-primary-600'
      case 'dark': return 'bg-slate-800 text-slate-400'
      case 'luxury': return 'bg-stone-800/50 text-amber-400 border border-amber-600/20'
      case 'natural': return 'bg-amber-100/60 text-amber-800 border border-amber-300/40'
      default: return 'bg-gray-50'
    }
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
            <>
              <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: settings.color }}></div>
              <div className="absolute bottom-0 left-0 w-full h-1" style={{ backgroundColor: settings.color, opacity: 0.3 }}></div>
            </>
          )}
          {settings.template_id === 'elegant' && (
            <>
              <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#44403C 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
              <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: settings.color }}></div>
              <div className="absolute bottom-0 left-0 w-full h-1" style={{ backgroundColor: settings.color, opacity: 0.3 }}></div>
            </>
          )}
          {settings.template_id === 'pop' && (
            <>
              <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-200 rounded-bl-full opacity-50"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 rounded-tr-full opacity-50" style={{ backgroundColor: settings.color }}></div>
              <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: settings.color }}></div>
            </>
          )}
          {settings.template_id === 'dark' && (
            <>
              <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]"></div>
              <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-slate-800/50 to-transparent"></div>
              <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: settings.color }}></div>
              <div className="absolute bottom-0 left-0 w-full h-1" style={{ backgroundColor: settings.color, opacity: 0.3 }}></div>
            </>
          )}
          {settings.template_id === 'luxury' && (
            <>
              <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(251,191,36,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]"></div>
              <div className="absolute top-0 left-0 w-full h-2" style={{ background: `linear-gradient(to right, ${settings.color}CC, ${settings.color}, ${settings.color}CC)` }}></div>
              <div className="absolute bottom-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl"></div>
              <div className="absolute top-0 left-0 w-24 h-24 bg-amber-400/5 rounded-full blur-2xl"></div>
            </>
          )}
          {settings.template_id === 'natural' && (
            <>
              <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(132, 204, 22, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(251, 191, 36, 0.1) 0%, transparent 50%)' }}></div>
              <div className="absolute -top-6 -right-6 w-28 h-28 bg-lime-200/40 rounded-full blur-xl"></div>
              <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-amber-200/30 rounded-full blur-xl"></div>
              <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: settings.color }}></div>
              <div className="absolute bottom-0 left-0 w-full h-1" style={{ backgroundColor: settings.color, opacity: 0.3 }}></div>
            </>
          )}

          {/* Card Content */}
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex justify-between items-start mb-2">
              <h3 className={`font-bold text-lg tracking-wider ${settings.template_id === 'elegant' ? 'font-serif' : ''}`}>
                {settings.title}
              </h3>
              {settings.logo_url && (
                <div className={`p-2 rounded-lg backdrop-blur-sm ${getLogoStyle()}`}>
                  <img src={settings.logo_url} alt="Logo" className="w-6 h-6 object-contain" />
                </div>
              )}
            </div>
            
            {settings.card_type === 'stamp' ? (
              <div className="flex-1 flex flex-col justify-between py-1">
                <div 
                  className={`grid ${settings.stamp_config.total_slots > 20 ? 'gap-0.5' : 'gap-1'} ${settings.stamp_config.total_slots <= 10 ? 'px-8' : ''}`}
                  style={{
                    gridTemplateColumns: `repeat(${
                      settings.stamp_config.total_slots <= 10 ? 5 :
                      settings.stamp_config.total_slots <= 20 ? 10 :
                      settings.stamp_config.total_slots <= 30 ? 12 :
                      settings.stamp_config.total_slots <= 40 ? 14 : 17
                    }, minmax(0, 1fr))`
                  }}
                >
                  {Array.from({ length: settings.stamp_config.total_slots }).map((_, i) => {
                    const isStamped = i < customer.points
                    const stampedStyle = {
                      borderColor: settings.color,
                      color: settings.color,
                      backgroundColor: `${settings.color}20`
                    }
                    
                    return (
                    <div 
                      key={i} 
                      className={`aspect-square rounded-full border flex items-center justify-center ${
                        settings.stamp_config.total_slots > 30 ? 'text-[6px]' : 'text-[8px]'
                      } ${
                        isStamped ? 'opacity-100' : 
                        (settings.template_id === 'dark' ? 'border-slate-700 text-slate-700' : 
                         settings.template_id === 'luxury' ? 'border-amber-600/30 text-amber-200/30' :
                         settings.template_id === 'natural' ? 'border-amber-300/50 text-amber-400/60' :
                         'border-gray-200 text-gray-300')
                      }`}
                      style={isStamped ? stampedStyle : undefined}
                    >
                      {isStamped ? <Stamp className={settings.stamp_config.total_slots > 30 ? "w-2 h-2" : "w-2.5 h-2.5"} /> : i + 1}
                    </div>
                    )
                  })}
                </div>
                
                <div className="space-y-0.5 mt-auto">
                  <div className={`text-right text-[10px] ${
                    settings.template_id === 'dark' ? 'text-slate-400' : 
                    settings.template_id === 'luxury' ? 'text-amber-200/60' :
                    settings.template_id === 'natural' ? 'text-amber-700' :
                    'text-gray-500'
                  }`}>
                    あと {Math.max(0, settings.stamp_config.total_slots - customer.points)} 個で {settings.stamp_config.goal_reward}
                  </div>

                  <div className="flex justify-between items-end border-t pt-1 border-dashed border-gray-300/30">
                    <div>
                      <p className={`text-[8px] mb-0.5 ${settings.template_id === 'pop' ? 'opacity-75' : 'opacity-60'}`}>MEMBER NAME</p>
                      <p className={`font-medium text-sm tracking-wide ${settings.template_id === 'elegant' ? 'font-serif' : ''}`}>
                        {settings.name_display === 'real_kanji' && customer.real_name ? customer.real_name : 
                         settings.name_display === 'real_romaji' && customer.real_name ? customer.real_name : 
                         customer.display_name}
                      </p>
                    </div>
                  </div>
                  
                  {(settings.show_member_no || settings.show_rank) && (
                    <div className={`flex justify-between text-[10px] mt-1 flex-shrink-0 ${
                      settings.template_id === 'simple' ? 'text-gray-500' :
                      settings.template_id === 'elegant' ? 'text-[#44403C]/80' :
                      settings.template_id === 'pop' ? 'text-gray-600' :
                      settings.template_id === 'luxury' ? 'text-amber-200/50' :
                      settings.template_id === 'natural' ? 'text-amber-800' :
                      'text-slate-400'
                    }`}>
                      {settings.show_member_no && <span>No. {customer.member_no}</span>}
                      {settings.show_rank && <span>Rank: {customer.rank}</span>}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <p className={`text-xs mb-1 ${settings.template_id === 'pop' ? 'opacity-75' : 'opacity-60'}`}>MEMBER NAME</p>
                    <p className={`font-medium text-base tracking-wide ${settings.template_id === 'elegant' ? 'font-serif' : ''}`}>
                      {settings.name_display === 'real_kanji' && customer.real_name ? customer.real_name : 
                       settings.name_display === 'real_romaji' && customer.real_name ? customer.real_name : 
                       customer.display_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs mb-1 ${settings.template_id === 'pop' ? 'opacity-75' : 'opacity-60'}`}>POINTS</p>
                    <p 
                      className={`text-3xl font-bold ${
                        settings.template_id === 'elegant' ? 'font-serif' : 
                        settings.template_id === 'luxury' ? 'font-light tracking-wider' : ''
                      }`}
                      style={{ color: settings.color }}
                    >
                      {customer.points.toLocaleString()} pt
                    </p>
                  </div>
                </div>
                
                {(settings.show_member_no || settings.show_rank) && (
                  <div className={`pt-2 border-t flex justify-between text-xs ${
                    settings.template_id === 'simple' ? 'border-gray-100 text-gray-400' :
                    settings.template_id === 'elegant' ? 'border-[#E7E5E4]' :
                    settings.template_id === 'pop' ? 'border-gray-100 text-gray-500' :
                    settings.template_id === 'luxury' ? 'border-amber-600/20 text-amber-200/50' :
                    settings.template_id === 'natural' ? 'border-amber-300/40 text-amber-800' :
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
        <div className={`rounded-xl shadow-sm p-6 text-center space-y-4 ${
          settings.template_id === 'dark' ? 'bg-slate-900 text-slate-200' :
          settings.template_id === 'luxury' ? 'bg-stone-900 text-amber-100 border border-amber-600/20' :
          settings.template_id === 'natural' ? 'bg-white text-amber-950 border border-amber-200' :
          'bg-white text-gray-800'
        }`}>
          <p className={`text-sm ${
            settings.template_id === 'dark' ? 'text-slate-400' :
            settings.template_id === 'luxury' ? 'text-amber-200/60' :
            settings.template_id === 'natural' ? 'text-amber-700' :
            'text-gray-500'
          }`}>
            会員QRコード
          </p>
          <div className="flex justify-center">
            <div 
              className="p-3 rounded-lg inline-block"
              style={{
                border: `2px solid ${settings.color}`,
                backgroundColor: `${settings.color}08`
              }}
            >
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/customers/${customer.id}`)}`}
                alt="Member QR Code"
                className="w-32 h-32"
              />
            </div>
          </div>
          <p className={`text-xs ${
            settings.template_id === 'dark' ? 'text-slate-500' :
            settings.template_id === 'luxury' ? 'text-amber-200/40' :
            settings.template_id === 'natural' ? 'text-amber-600' :
            'text-gray-400'
          }`}>
            {customer.member_no}
          </p>
          <p className={`text-[10px] ${
            settings.template_id === 'dark' ? 'text-slate-600' :
            settings.template_id === 'luxury' ? 'text-amber-200/30' :
            settings.template_id === 'natural' ? 'text-amber-500' :
            'text-gray-300'
          }`}>
            スタッフに提示してください
          </p>
        </div>

      </motion.div>
    </div>
  )
}
