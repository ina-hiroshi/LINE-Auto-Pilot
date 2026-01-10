import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  // #region agent log
  await fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'get-admin-analytics:entry',message:'Edge function called',data:{method:req.method,hasAuth:!!req.headers.get('Authorization'),origin:req.headers.get('Origin')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin')
    const headers = getCorsHeaders(origin)
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'get-admin-analytics:options',message:'OPTIONS request handled',data:{origin,headers:Object.keys(headers)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return new Response('ok', { status: 200, headers })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'get-admin-analytics:after-client',message:'Supabase client created',data:{hasUrl:!!Deno.env.get('SUPABASE_URL'),hasAnonKey:!!Deno.env.get('SUPABASE_ANON_KEY')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    const { data: { user } } = await supabaseClient.auth.getUser()
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'get-admin-analytics:after-getUser',message:'getUser completed',data:{hasUser:!!user,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (!user) {
      // #region agent log
      await fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'get-admin-analytics:no-user',message:'No user found',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const origin = req.headers.get('Origin')
      const headers = getCorsHeaders(origin)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    // 管理者権限を確認
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'get-admin-analytics:after-profile',message:'Profile check completed',data:{hasProfile:!!profile,isAdmin:profile?.is_admin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    if (!profile?.is_admin) {
      // #region agent log
      await fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'get-admin-analytics:not-admin',message:'User is not admin',data:{userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      const origin = req.headers.get('Origin')
      const headers = getCorsHeaders(origin)
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    // Service Role Keyを使用して全てのデータを取得
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'get-admin-analytics:before-admin-client',message:'Creating admin client',data:{hasServiceRoleKey:!!serviceRoleKey},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 1. 登録者統計
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'get-admin-analytics:before-profiles-query',message:'About to query profiles',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    const { data: allProfiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, created_at, plan')
      .order('created_at', { ascending: true })
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'get-admin-analytics:after-profiles-query',message:'Profiles query completed',data:{hasData:!!allProfiles,dataLength:allProfiles?.length,hasError:!!profilesError,errorMessage:profilesError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    if (profilesError) {
      // #region agent log
      await fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'get-admin-analytics:profiles-error',message:'Profiles query error',data:{errorMessage:profilesError.message,errorDetails:JSON.stringify(profilesError)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      throw profilesError
    }

    const totalUsers = allProfiles?.length || 0
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // 日別登録数（過去30日）
    const dailyRegistrations: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split('T')[0]
      dailyRegistrations[dateKey] = 0
    }

    allProfiles?.forEach(profile => {
      const createdDate = new Date(profile.created_at).toISOString().split('T')[0]
      if (dailyRegistrations[createdDate] !== undefined) {
        dailyRegistrations[createdDate]++
      }
    })

    const dailyRegistrationData = Object.entries(dailyRegistrations).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
      count
    }))

    // プラン統計
    const planCounts: Record<string, number> = { free: 0, pro: 0, executive: 0 }
    allProfiles?.forEach(profile => {
      const plan = profile.plan || 'free'
      if (plan in planCounts) {
        planCounts[plan]++
      }
    })

    const planData = [
      { name: 'Free', value: planCounts.free, color: '#94a3b8' },
      { name: 'Pro', value: planCounts.pro, color: '#2563eb' },
      { name: 'Executive', value: planCounts.executive, color: '#f59e0b' }
    ]

    const paidPlanRate = totalUsers > 0 
      ? ((planCounts.pro + planCounts.executive) / totalUsers * 100).toFixed(1)
      : '0.0'

    // 2. LINEメッセージ統計
    const { data: allLogs, error: logsError } = await supabaseAdmin
      .from('customer_logs')
      .select('id, created_at, status')
      .order('created_at', { ascending: false })

    if (logsError) {
      throw logsError
    }

    const totalMessages = allLogs?.length || 0
    const autoReplied = allLogs?.filter(log => log.status === 'auto_replied').length || 0
    const aiReplied = allLogs?.filter(log => log.status === 'ai_replied').length || 0
    const autoResponseRate = totalMessages > 0
      ? (((autoReplied + aiReplied) / totalMessages) * 100).toFixed(1)
      : '0.0'

    // 日別メッセージ数（過去30日）
    const dailyMessages: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split('T')[0]
      dailyMessages[dateKey] = 0
    }

    allLogs?.forEach(log => {
      const logDate = new Date(log.created_at).toISOString().split('T')[0]
      if (dailyMessages[logDate] !== undefined) {
        dailyMessages[logDate]++
      }
    })

    const dailyMessageData = Object.entries(dailyMessages).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
      count
    }))

    // ステータス別内訳
    const statusCounts: Record<string, number> = {}
    allLogs?.forEach(log => {
      statusCounts[log.status] = (statusCounts[log.status] || 0) + 1
    })

    // 3. 予約統計
    const { data: allReservations, error: reservationsError } = await supabaseAdmin
      .from('reservations')
      .select('id, start_time, status, registration_type')
      .order('start_time', { ascending: false })

    if (reservationsError) {
      throw reservationsError
    }

    const totalReservations = allReservations?.length || 0

    // 日別予約数（過去30日）
    const dailyReservations: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split('T')[0]
      dailyReservations[dateKey] = 0
    }

    allReservations?.forEach(reservation => {
      if (reservation.start_time) {
        const resDate = new Date(reservation.start_time).toISOString().split('T')[0]
        if (dailyReservations[resDate] !== undefined) {
          dailyReservations[resDate]++
        }
      }
    })

    const dailyReservationData = Object.entries(dailyReservations).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
      count
    }))

    // ステータス別・登録種別内訳
    const reservationStatusCounts: Record<string, number> = {}
    const registrationTypeCounts: Record<string, number> = { line: 0, manual: 0 }

    allReservations?.forEach(reservation => {
      reservationStatusCounts[reservation.status || 'pending'] = 
        (reservationStatusCounts[reservation.status || 'pending'] || 0) + 1
      
      const regType = reservation.registration_type || 'line'
      registrationTypeCounts[regType] = (registrationTypeCounts[regType] || 0) + 1
    })

    // 4. LINE連携状況
    const { data: allStores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('id, owner_id, name, created_at')

    if (storesError) {
      throw storesError
    }

    const { data: allLineAccounts, error: lineAccountsError } = await supabaseAdmin
      .from('line_accounts')
      .select('store_id, bot_id, channel_id, created_at, line_user_id')

    if (lineAccountsError) {
      throw lineAccountsError
    }

    const lineAccountMap = new Map()
    allLineAccounts?.forEach(account => {
      lineAccountMap.set(account.store_id, account)
    })

    const connectedStores = new Set(allLineAccounts?.map(acc => acc.store_id) || [])
    const totalStores = allStores?.length || 0
    const connectedStoresCount = connectedStores.size
    const lineConnectionRate = totalStores > 0
      ? ((connectedStoresCount / totalStores) * 100).toFixed(1)
      : '0.0'

    // ユーザー別連携詳細リスト
    const connectionDetails = allStores?.map(store => {
      const lineAccount = lineAccountMap.get(store.id)
      return {
        store_id: store.id,
        store_name: store.name,
        owner_id: store.owner_id,
        has_line_connection: !!lineAccount,
        bot_id: lineAccount?.bot_id || null,
        channel_id: lineAccount?.channel_id || null,
        line_connected_at: lineAccount?.created_at || null,
        store_created_at: store.created_at
      }
    }) || []

    // ユーザー情報を取得してマージ
    const ownerIds = [...new Set(connectionDetails.map(d => d.owner_id).filter(Boolean))]
    const { data: ownerProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, created_at, plan')
      .in('id', ownerIds)

    const profileMap = new Map()
    ownerProfiles?.forEach(profile => {
      profileMap.set(profile.id, profile)
    })

    // 店舗別メッセージ統計を取得
    const storeIds = allStores?.map(s => s.id) || []
    const { data: storeMessages } = await supabaseAdmin
      .from('customer_logs')
      .select('store_id, status')
      .in('store_id', storeIds)

    const messageStatsMap = new Map<string, { total: number; auto_replied: number; ai_replied: number }>()
    storeMessages?.forEach(log => {
      if (!log.store_id) return
      const stats = messageStatsMap.get(log.store_id) || { total: 0, auto_replied: 0, ai_replied: 0 }
      stats.total++
      if (log.status === 'auto_replied') stats.auto_replied++
      if (log.status === 'ai_replied') stats.ai_replied++
      messageStatsMap.set(log.store_id, stats)
    })

    // 店舗別予約統計を取得
    const { data: storeReservations } = await supabaseAdmin
      .from('reservations')
      .select('store_id')
      .in('store_id', storeIds)

    const reservationStatsMap = new Map<string, number>()
    storeReservations?.forEach(reservation => {
      if (!reservation.store_id) return
      const count = reservationStatsMap.get(reservation.store_id) || 0
      reservationStatsMap.set(reservation.store_id, count + 1)
    })

    // LINE Bot情報を取得（アイコンURL用）
    // データベースにキャッシュされたbot_picture_urlを使用
    // キャッシュがない場合はLINE APIから取得して保存（フォールバック）
    const { data: lineAccountsWithPicture } = await supabaseAdmin
      .from('line_accounts')
      .select('store_id, bot_picture_url, channel_access_token')
      .in('store_id', storeIds)

    const botPictureMap = new Map<string, string | null>()
    
    // データベースから取得したbot_picture_urlをマップに格納
    if (lineAccountsWithPicture && lineAccountsWithPicture.length > 0) {
      // キャッシュがない店舗を特定
      const storesNeedingFetch = lineAccountsWithPicture.filter(
        account => !account.bot_picture_url && account.channel_access_token
      )
      
      // キャッシュ済みのURLをマップに格納
      lineAccountsWithPicture.forEach(account => {
        if (account.bot_picture_url) {
          botPictureMap.set(account.store_id, account.bot_picture_url)
        }
      })
      
      // キャッシュがない店舗に対してLINE APIから取得（フォールバック）
      if (storesNeedingFetch.length > 0) {
        const botInfoPromises = storesNeedingFetch.map(async (account) => {
          if (!account.channel_access_token) {
            return { storeId: account.store_id, pictureUrl: null }
          }
          
          try {
            const response = await fetch('https://api.line.me/v2/bot/info', {
              headers: {
                Authorization: `Bearer ${account.channel_access_token}`,
              },
            })
            
            if (!response.ok) {
              console.error(`Failed to fetch bot info for store ${account.store_id}: ${response.status}`)
              return { storeId: account.store_id, pictureUrl: null }
            }
            
            const botInfo = await response.json()
            const pictureUrl = botInfo.pictureUrl || null
            
            // データベースに保存
            if (pictureUrl) {
              await supabaseAdmin
                .from('line_accounts')
                .update({ bot_picture_url: pictureUrl })
                .eq('store_id', account.store_id)
                .then(() => {
                  console.log(`Cached bot_picture_url for store ${account.store_id}`)
                })
                .catch((error) => {
                  console.error(`Failed to cache bot_picture_url for store ${account.store_id}:`, error)
                })
            }
            
            return { storeId: account.store_id, pictureUrl }
          } catch (error) {
            console.error(`Error fetching bot info for store ${account.store_id}:`, error)
            return { storeId: account.store_id, pictureUrl: null }
          }
        })
        
        const botInfoResults = await Promise.all(botInfoPromises)
        botInfoResults.forEach(result => {
          botPictureMap.set(result.storeId, result.pictureUrl)
        })
      }
    }

    const connectionDetailsWithUsers = connectionDetails.map(detail => {
      const profile = profileMap.get(detail.owner_id)
      const messageStats = messageStatsMap.get(detail.store_id) || { total: 0, auto_replied: 0, ai_replied: 0 }
      const reservationCount = reservationStatsMap.get(detail.store_id) || 0
      const botPictureUrl = botPictureMap.get(detail.store_id) || null
      
      return {
        ...detail,
        user_email: profile?.email || null,
        user_name: profile?.full_name || null,
        user_created_at: profile?.created_at || null,
        plan: profile?.plan || 'free',
        bot_picture_url: botPictureUrl,
        store_message_count: messageStats.total,
        store_auto_reply_count: messageStats.auto_replied,
        store_ai_reply_count: messageStats.ai_replied,
        store_reservation_count: reservationCount
      }
    })

    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'get-admin-analytics:before-response',message:'About to return success response',data:{totalUsers,hasRegistrations:!!dailyRegistrationData,hasPlans:!!planData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    const origin = req.headers.get('Origin')
    const headers = getCorsHeaders(origin)
    return new Response(
      JSON.stringify({
        summary: {
          totalUsers,
          paidPlanRate,
          lineConnectionRate,
          autoResponseRate
        },
        registrations: {
          daily: dailyRegistrationData
        },
        plans: {
          distribution: planData,
          counts: planCounts
        },
        messages: {
          total: totalMessages,
          daily: dailyMessageData,
          statusCounts,
          autoResponseRate
        },
        reservations: {
          total: totalReservations,
          daily: dailyReservationData,
          statusCounts: reservationStatusCounts,
          registrationTypeCounts
        },
        lineConnections: {
          totalStores,
          connectedStoresCount,
          connectionRate: lineConnectionRate,
          details: connectionDetailsWithUsers
        }
      }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/53798b6c-10bb-4120-910e-ec2e7190d1cf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'get-admin-analytics:catch',message:'Exception caught',data:{errorMessage:message,errorType:error?.constructor?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    console.error('Get admin analytics error:', message)
    const origin = req.headers.get('Origin')
    const headers = getCorsHeaders(origin)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  }
})
