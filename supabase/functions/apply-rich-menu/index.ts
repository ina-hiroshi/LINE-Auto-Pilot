import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log('Request body:', JSON.stringify(body))
    const { store_id, generated_image_url, liff_id } = body

    if (!store_id) {
      throw new Error('store_id is required')
    }

    // 1. Fetch Store Settings
    const { data: store, error: storeError } = await supabaseClient
      .from('stores')
      .select('*')
      .eq('id', store_id)
      .single()

    if (storeError || !store) {
      throw new Error('Store not found')
    }

    // 2. Fetch LINE Account Settings
    const { data: lineAccount, error: lineError } = await supabaseClient
      .from('line_accounts')
      .select('*')
      .eq('store_id', store_id)
      .single()

    if (lineError || !lineAccount || !lineAccount.channel_access_token) {
      throw new Error('LINE Account not found or access token missing')
    }

    const channelAccessToken = lineAccount.channel_access_token
    const botId = lineAccount.bot_id
    const layoutId = store.rich_menu_layout_id || 'large_4'
    const actions = store.rich_menu_actions || {}
    const liffId = liff_id || Deno.env.get('LIFF_ID')
    console.log('Using LIFF ID:', liffId)
    
    // Booking Action: Use LIFF URL if ID is available, otherwise fallback to postback (which needs handling)
    const bookingAction = liffId 
      ? { type: 'uri', uri: `https://liff.line.me/${liffId}?store_id=${store_id}`, label: '予約する' }
      : { type: 'postback', data: 'action=booking', label: '予約する' }
    
    console.log('Generated Booking Action:', JSON.stringify(bookingAction))

    // 3. Define Areas based on Layout
    const width = 2500
    const height = layoutId.startsWith('compact') ? 843 : 1686
    let areas = []

    if (layoutId === 'large_4') {
      // 2x2
      const w = width / 2
      const h = height / 2
      areas = [
        { bounds: { x: 0, y: 0, width: w, height: h }, action: bookingAction }, // Slot 1 (Booking)
        { bounds: { x: w, y: 0, width: w, height: h }, action: { type: 'richmenuswitch', richMenuAliasId: 'keyboard', data: 'action=keyboard' } }, // Slot 2 (Keyboard) - Note: richmenuswitch requires alias, simplifying to message for now or URI
        { bounds: { x: 0, y: h, width: w, height: h }, slot: 3 },
        { bounds: { x: w, y: h, width: w, height: h }, slot: 4 },
      ]
    } else if (layoutId === 'large_6') {
      // 3x2
      const w = width / 3
      const h = height / 2
      areas = [
        { bounds: { x: 0, y: 0, width: w, height: h }, action: bookingAction },
        { bounds: { x: w, y: 0, width: w, height: h }, action: { type: 'richmenuswitch', richMenuAliasId: 'keyboard', data: 'action=keyboard' } },
        { bounds: { x: w * 2, y: 0, width: w, height: h }, slot: 3 },
        { bounds: { x: 0, y: h, width: w, height: h }, slot: 4 },
        { bounds: { x: w, y: h, width: w, height: h }, slot: 5 },
        { bounds: { x: w * 2, y: h, width: w, height: h }, slot: 6 },
      ]
    } else if (layoutId === 'large_3_upper') {
      // Top 1 (Full width), Bottom 2
      const h = height / 2
      const w = width / 2
      areas = [
        { bounds: { x: 0, y: 0, width: width, height: h }, action: bookingAction }, // Slot 1 is huge
        { bounds: { x: 0, y: h, width: w, height: h }, action: { type: 'richmenuswitch', richMenuAliasId: 'keyboard', data: 'action=keyboard' } }, // Slot 2
        { bounds: { x: w, y: h, width: w, height: h }, slot: 3 },
      ]
    } else if (layoutId === 'compact_2') {
      // 2 cols
      const w = width / 2
      areas = [
        { bounds: { x: 0, y: 0, width: w, height: height }, action: bookingAction },
        { bounds: { x: w, y: 0, width: w, height: height }, action: { type: 'richmenuswitch', richMenuAliasId: 'keyboard', data: 'action=keyboard' } },
      ]
    } else if (layoutId === 'compact_3') {
      // 3 cols
      const w = width / 3
      areas = [
        { bounds: { x: 0, y: 0, width: w, height: height }, action: bookingAction },
        { bounds: { x: w, y: 0, width: w, height: height }, action: { type: 'richmenuswitch', richMenuAliasId: 'keyboard', data: 'action=keyboard' } },
        { bounds: { x: w * 2, y: 0, width: w, height: height }, slot: 3 },
      ]
    }

    // 4. Map Actions to Areas
    const mappedAreas = areas.map((area, index) => {
      if (area.action) return { bounds: area.bounds, action: area.action }
      
      const slotNum = area.slot
      const userAction = actions[slotNum]
      
      if (userAction) {
        // Special handling for Member Card
        if (userAction.icon === 'credit-card') {
          if (liffId) {
            return {
              bounds: area.bounds,
              action: {
                type: 'uri',
                uri: `https://liff.line.me/${liffId}?page=member-card&store_id=${store_id}`,
                label: userAction.label || '会員証'
              }
            }
          } else {
            console.warn('LIFF ID not found for Member Card action')
            return {
              bounds: area.bounds,
              action: {
                type: 'message',
                text: '会員証機能は現在準備中です',
                label: userAction.label || '会員証'
              }
            }
          }
        }

        if (userAction.url) {
          return {
            bounds: area.bounds,
            action: {
              type: 'uri',
              uri: userAction.url,
              label: userAction.label || 'Link'
            }
          }
        }
      }
      
      // Default empty action if not set
      return {
        bounds: area.bounds,
        action: {
          type: 'message',
          text: ' ', // Empty message
          label: 'Empty'
        }
      }
    })

    // Fix for "richmenuswitch": Use URI action to open keyboard/input if bot_id is available
    const finalAreas = mappedAreas.map(area => {
      if (area.action.type === 'richmenuswitch') {
         if (botId) {
           // Ensure botId starts with @ if not present (though usually it should be)
           // But actually, the LINE ID in the URL should be the Basic ID (e.g. @12345abc)
           return {
             bounds: area.bounds,
             action: {
               type: 'uri',
               uri: `https://line.me/R/oaMessage/${botId}/`,
               label: '入力'
             }
           }
         } else {
           return {
             bounds: area.bounds,
             action: {
               type: 'message',
               text: '左下のキーボードアイコンをタップして入力してください',
               label: '入力'
             }
           }
         }
      }
      return area
    })


    // 5. Create Rich Menu Object
    const richMenuObject = {
      size: { width, height },
      selected: true,
      name: `Rich Menu ${layoutId}`,
      chatBarText: 'メニュー',
      areas: finalAreas
    }

    // 6. Call LINE API to Create Rich Menu
    const createRes = await fetch('https://api.line.me/v2/bot/richmenu', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channelAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(richMenuObject)
    })

    if (!createRes.ok) {
      const err = await createRes.json()
      throw new Error(`Failed to create rich menu: ${JSON.stringify(err)}`)
    }

    const { richMenuId } = await createRes.json()

    // 7. Upload Image
    // Use custom image or placeholder
    let imageUrl = generated_image_url || store.rich_menu_custom_image_url
    if (!imageUrl) {
      // Fallback to a placeholder service based on theme
      const templateId = store.rich_menu_template_id || 'simple'
      let bgColor = 'eeeeee'
      let textColor = 'aaaaaa'

      switch (templateId) {
        case 'elegant':
          bgColor = 'F5F5F0'
          textColor = '5D4037'
          break
        case 'pop':
          bgColor = '00c3dc' // Primary color
          textColor = 'ffffff'
          break
        case 'dark':
          bgColor = '1e293b' // Slate 800
          textColor = 'ffffff'
          break
        case 'simple':
        default:
          bgColor = 'eeeeee'
          textColor = 'aaaaaa'
          break
      }

      imageUrl = `https://placehold.co/${width}x${height}/${bgColor}/${textColor}.png?text=Menu`
    }

    const imageRes = await fetch(imageUrl)
    const imageBlob = await imageRes.blob()

    const uploadRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channelAccessToken}`,
        'Content-Type': 'image/png' // Assuming PNG
      },
      body: imageBlob
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.json()
      throw new Error(`Failed to upload rich menu image: ${JSON.stringify(err)}`)
    }

    // 8. Set as Default
    const defaultRes = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channelAccessToken}`
      }
    })

    if (!defaultRes.ok) {
      const err = await defaultRes.json()
      throw new Error(`Failed to set default rich menu: ${JSON.stringify(err)}`)
    }

    return new Response(
      JSON.stringify({ success: true, richMenuId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
