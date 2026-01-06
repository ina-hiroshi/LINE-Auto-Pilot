import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { storeId } = await req.json()

    if (!storeId) {
      return new Response(
        JSON.stringify({ error: 'storeId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check Pro plan
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('owner_id')
      .eq('id', storeId)
      .single()

    if (storeError || !storeData) {
      return new Response(
        JSON.stringify({ error: 'Store not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', storeData.owner_id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (profile.plan !== 'pro' && profile.plan !== 'executive') {
      return new Response(
        JSON.stringify({ 
          error: 'Pro plan required',
          currentPlan: profile.plan,
          message: `This feature requires Pro plan. Current plan: ${profile.plan}`
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get date range (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Fetch logs
    const { data: logsData, error: logsError } = await supabase
      .from('customer_logs')
      .select('*')
      .eq('store_id', storeId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(500)

    if (logsError) {
      console.error('Error fetching logs:', logsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch logs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch reservations
    const { data: reservationsData, error: reservationsError } = await supabase
      .from('reservations')
      .select('id, line_user_id, status, start_time, menu_id, staff_id')
      .eq('store_id', storeId)
      .gte('start_time', thirtyDaysAgo.toISOString())
      .neq('status', 'cancelled')

    if (reservationsError) {
      console.error('Error fetching reservations:', reservationsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch reservations' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch menus
    const { data: menusData, error: menusError } = await supabase
      .from('booking_menus')
      .select('id, name, price, duration')
      .eq('store_id', storeId)

    if (menusError) {
      console.error('Error fetching menus:', menusError)
    }

    // Fetch staff members
    const { data: staffMembersData, error: staffError } = await supabase
      .from('staff_members')
      .select('id, name')
      .eq('store_id', storeId)

    if (staffError) {
      console.error('Error fetching staff:', staffError)
    }

    const logs = logsData || []
    const reservations = reservationsData || []
    const menus = menusData || []
    const staffMembers = staffMembersData || []

    // Aggregate data
    const statusCounts = {
      auto_replied: 0,
      ai_replied: 0,
      manual_reply_needed: 0,
      manual_replied: 0,
      resolved: 0
    }

    logs.forEach(log => {
      if (log.status in statusCounts) {
        statusCounts[log.status as keyof typeof statusCounts]++
      }
    })

    const totalMessages = logs.length
    const autoReplyRate = totalMessages > 0 ? Math.round((statusCounts.auto_replied / totalMessages) * 100) : 0
    const aiReplyRate = totalMessages > 0 ? Math.round((statusCounts.ai_replied / totalMessages) * 100) : 0
    const manualNeededRate = totalMessages > 0 ? Math.round((statusCounts.manual_reply_needed / totalMessages) * 100) : 0

    // Weekday distribution
    const weekdayCounts: Record<string, number> = {
      '日': 0, '月': 0, '火': 0, '水': 0, '木': 0, '金': 0, '土': 0
    }
    logs.forEach(log => {
      const day = new Date(log.created_at).getDay()
      const dayNames = ['日', '月', '火', '水', '木', '金', '土']
      weekdayCounts[dayNames[day]]++
    })

    // Reservation statistics
    const totalReservations = reservations.length
    const activeReservations = reservations.filter(r => r.status === 'confirmed' || r.status === 'pending').length
    const cancelledReservations = reservations.filter(r => r.status === 'cancelled').length
    const cancelRate = totalReservations > 0 ? Math.round((cancelledReservations / (totalReservations + cancelledReservations)) * 100) : 0

    // Reservation source (simplified - assuming all are from LINE for now)
    const sourceCounts: Record<string, number> = {
      'LINE': totalReservations,
      'Google': 0,
      '手動登録': 0
    }

    // Reservation weekday distribution
    const reservationWeekdayCounts: Record<string, number> = {
      '日': 0, '月': 0, '火': 0, '水': 0, '木': 0, '金': 0, '土': 0
    }
    reservations.forEach(res => {
      if (res.start_time) {
        const day = new Date(res.start_time).getDay()
        const dayNames = ['日', '月', '火', '水', '木', '金', '土']
        reservationWeekdayCounts[dayNames[day]]++
      }
    })

    // Peak reservation hours
    const hourCounts: Record<number, number> = {}
    reservations.forEach(res => {
      if (res.start_time) {
        const hour = new Date(res.start_time).getHours()
        hourCounts[hour] = (hourCounts[hour] || 0) + 1
      }
    })
    const peakHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => `${hour}時`)
    const peakReservationHours = peakHours.length > 0 ? peakHours.join('、') : 'なし'

    // Customer message counts
    const customerMessageCounts: Record<string, number> = {}
    logs.forEach(log => {
      customerMessageCounts[log.line_user_id] = (customerMessageCounts[log.line_user_id] || 0) + 1
    })

    // Customer reservation counts
    const customerReservationCounts: Record<string, number> = {}
    reservations.forEach(res => {
      if (res.line_user_id) {
        customerReservationCounts[res.line_user_id] = (customerReservationCounts[res.line_user_id] || 0) + 1
      }
    })

    // Get customer names
    const allCustomerIds = new Set([
      ...Object.keys(customerMessageCounts),
      ...Object.keys(customerReservationCounts)
    ])

    const customerNames: Record<string, string> = {}
    
    // Get names from logs
    logs.forEach(log => {
      if (log.display_name && log.line_user_id) {
        customerNames[log.line_user_id] = log.display_name
      }
    })

    // Get names from customers table for missing ones
    if (allCustomerIds.size > 0) {
      const { data: customersData } = await supabase
        .from('customers')
        .select('line_user_id, display_name')
        .in('line_user_id', Array.from(allCustomerIds))
        .eq('store_id', storeId)

      if (customersData) {
        customersData.forEach(customer => {
          if (customer.line_user_id && customer.display_name && !customerNames[customer.line_user_id]) {
            customerNames[customer.line_user_id] = customer.display_name
          }
        })
      }
    }

    // Top customers by messages
    const topCustomersByMessages = Object.entries(customerMessageCounts)
      .map(([lineUserId, count]) => ({
        name: customerNames[lineUserId] || 'ゲスト',
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Top customers by reservations
    const topCustomersByReservations = Object.entries(customerReservationCounts)
      .map(([lineUserId, count]) => ({
        name: customerNames[lineUserId] || 'ゲスト',
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Menu counts
    const menuMap = new Map(menus.map(m => [m.id, m.name]))
    const menuCounts: Record<string, number> = {}
    reservations.forEach(res => {
      if (res.menu_id) {
        const menuName = menuMap.get(res.menu_id) || '未設定'
        menuCounts[menuName] = (menuCounts[menuName] || 0) + 1
      }
    })

    const topMenus = Object.entries(menuCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Staff counts
    const staffMap = new Map(staffMembers.map(s => [s.id, s.name]))
    const staffCounts: Record<string, number> = {}
    reservations.forEach(res => {
      if (res.staff_id) {
        const staffName = staffMap.get(res.staff_id) || '未設定'
        staffCounts[staffName] = (staffCounts[staffName] || 0) + 1
      }
    })

    const topStaff = Object.entries(staffCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Calculate revenue and duration
    const menuPriceMap = new Map(menus.map(m => [m.id, m.price || 0]))
    const menuDurationMap = new Map(menus.map(m => [m.id, m.duration || 0]))
    
    let totalRevenue = 0
    let totalDuration = 0
    let reservationWithMenu = 0

    reservations.forEach(res => {
      if (res.menu_id) {
        const price = menuPriceMap.get(res.menu_id) || 0
        const duration = menuDurationMap.get(res.menu_id) || 0
        totalRevenue += price
        totalDuration += duration
        reservationWithMenu++
      }
    })

    const averageDuration = reservationWithMenu > 0 ? totalDuration / reservationWithMenu : 0

    const popularMenusText = topMenus.length > 0
      ? topMenus.map((m, i) => `${i + 1}. ${m.name}: ${m.count}件`).join('\n')
      : 'データなし'

    const staffStatsText = topStaff.length > 0
      ? topStaff.map((s, i) => `${i + 1}. ${s.name}: ${s.count}件`).join('\n')
      : 'データなし'

    // Sample messages
    const messageSamples = logs
      .slice(0, 10)
      .map(log => `- ${log.message_content}`)
      .join('\n')

    // Construct AI prompt
    const analysisPrompt = `あなたはLINE公式アカウントの運用コンサルタントです。\n以下のメッセージログデータと予約データを分析し、店舗運営者に役立つインサイトを提供してください。\n\n【統計データ】\n- 総メッセージ数: ${totalMessages}件\n- 自動応答: ${statusCounts.auto_replied}件 (${autoReplyRate}%)\n- AI応答: ${statusCounts.ai_replied}件 (${aiReplyRate}%)\n- 要対応（未対応）: ${statusCounts.manual_reply_needed}件 (${manualNeededRate}%)\n- 手動返信済: ${statusCounts.manual_replied}件\n- 対応済: ${statusCounts.resolved}件\n\n【曜日別メッセージ分布】\n${Object.entries(weekdayCounts).map(([day, count]) => `${day}曜日: ${count}件`).join(', ')}\n\n【予約統計】\n- 総予約数: ${totalReservations}件\n- 有効予約: ${activeReservations}件\n- キャンセル率: ${cancelRate}%\n- 予約ソース別: ${Object.entries(sourceCounts).map(([source, count]) => `${source}: ${count}件`).join(', ')}\n- 曜日別予約分布: ${Object.entries(reservationWeekdayCounts).map(([day, count]) => `${day}曜日: ${count}件`).join(', ')}\n- 予約が多い時間帯: ${peakReservationHours}\n\n【人気メニュー】\n${popularMenusText}\n\n【担当者別予約数】\n${staffStatsText}\n\n【予約の売上・時間】\n- 予約売上合計（見込み）: ${totalRevenue.toLocaleString()}円\n- 平均施術時間: ${averageDuration.toFixed(0)}分\n\n【メッセージサンプル】\n${messageSamples}\n\n以下の形式でJSON形式で回答してください:\n{\n  "summary": "3-4文程度の今月の傾向サマリー。具体的な数字を含めて記述。",\n  "insights": ["気づき1（具体的なデータに基づいた発見）", "気づき2", "気づき3"],\n  "improvements": ["改善提案1（具体的なアクションを提案）", "改善提案2"],\n  "reservationAnalysis": "予約状況に関する詳細な分析（3-4文程度）。キャンセル率、人気メニュー、担当者、ピーク時間などを含める。",\n  "questionCategories": [\n    {"category": "カテゴリ名1", "count": 件数, "examples": ["質問例1", "質問例2"]},\n    {"category": "カテゴリ名2", "count": 件数, "examples": ["質問例1", "質問例2"]}\n  ],\n  "topCustomersByMessages": ${JSON.stringify(topCustomersByMessages)},\n  "topCustomersByReservations": ${JSON.stringify(topCustomersByReservations)},\n  "popularMenus": ${JSON.stringify(topMenus)},\n  "staffStats": ${JSON.stringify(topStaff)}\n}\n\n注意：\n- 日本語で回答\n- 具体的な数字や割合を活用\n- 実用的な改善提案を行う\n- questionCategoriesは、メッセージサンプルを分析して、よくある質問を5-8個のカテゴリに分類してください。各カテゴリには件数と質問例（2-3個）を含めてください。\n- JSON形式以外の余計なテキストは含めないでください。\n`

    // Call Gemini API
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: analysisPrompt }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.7
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API Error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to generate AI analysis' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Parse JSON from response
    let analysisResult
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || aiResponse.match(/```\s*([\s\S]*?)\s*```/)
      const jsonText = jsonMatch ? jsonMatch[1] : aiResponse
      analysisResult = JSON.parse(jsonText.trim())
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      console.error('AI Response:', aiResponse)
      // Fallback: return structured data with error message
      analysisResult = {
        summary: 'AI分析の解析に失敗しました。',
        insights: [],
        improvements: [],
        reservationAnalysis: '',
        questionCategories: [],
        topCustomersByMessages: topCustomersByMessages,
        topCustomersByReservations: topCustomersByReservations,
        popularMenus: topMenus,
        staffStats: topStaff
      }
    }

    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
