// Using Deno.serve instead of @std/http/server
import { createClient } from "@supabase/supabase-js"
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeErrorResponse } from '../_shared/error-utils.ts'
import { requireStoreAccess } from '../_shared/store-access.ts'
import { purgeGeneratedRichMenuImages } from '../_shared/rich-menu-assets.ts'
import { buildRichMenuAreas, getRichMenuSize } from '../_shared/rich-menu-areas.ts'

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

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

    // 無認証だと store_id を知っているだけで他店舗の LINE 公式アカウントの
    // リッチメニューを任意の画像に差し替えられてしまう。
    const access = await requireStoreAccess(req, store_id, supabaseClient, corsHeaders)
    if (!access.ok) return access.response

    // 1. Fetch Store Settings
    const { data: store, error: storeError } = await supabaseClient
      .from('stores')
      .select('*')
      .eq('id', store_id)
      .single()

    if (storeError || !store) {
      throw new Error('Store not found')
    }

    // 1.5 Check Plan
    let isPro = false
    if (store.owner_id) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('plan')
        .eq('id', store.owner_id)
        .single()
      isPro = profile?.plan === 'pro'
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
    let layoutId = store.rich_menu_layout_id || 'large_4'

    // Enforce Free Plan Limits
    if (!isPro && layoutId !== 'large_4') {
      console.log('Downgrading layout to large_4 for Free plan')
      layoutId = 'large_4'
    }

    const actions = store.rich_menu_actions || {}
    const liffId = liff_id || Deno.env.get('LIFF_ID')
    console.log('Using LIFF ID:', liffId)
    
    // 3-4. Define Areas based on Layout and store settings
    const { width, height } = getRichMenuSize(layoutId)
    const finalAreas = buildRichMenuAreas(layoutId, actions, {
      storeId: store_id,
      liffId,
      botId,
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
    console.log('Created rich menu:', richMenuId)

    // 7. Upload Image
    // Use custom image or placeholder
    let imageUrl = generated_image_url || store.rich_menu_custom_image_url
    console.log('Image URL to use:', imageUrl)
    
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
        case 'luxury':
          bgColor = '1c1917' // Stone 900
          textColor = 'fef3c7' // Amber 100
          break
        case 'natural':
          bgColor = 'fef3c7' // Amber 100
          textColor = '451a03' // Amber 950
          break
        case 'simple':
        default:
          bgColor = 'eeeeee'
          textColor = 'aaaaaa'
          break
      }

      imageUrl = `https://placehold.co/${width}x${height}/${bgColor}/${textColor}.png?text=Menu`
      console.log('Using placeholder image:', imageUrl)
    }

    console.log('Fetching image from:', imageUrl)
    const imageRes = await fetch(imageUrl)
    
    if (!imageRes.ok) {
      throw new Error(`Failed to fetch image: ${imageRes.status} ${imageRes.statusText}`)
    }
    
    const imageBlob = await imageRes.blob()
    console.log('Image blob size:', imageBlob.size, 'type:', imageBlob.type)

    // 1MBを超える場合はエラー
    if (imageBlob.size > 1024 * 1024) {
      throw new Error(`Image size ${Math.round(imageBlob.size / 1024)}KB exceeds LINE API limit (1MB)`)
    }

    console.log('Uploading image to LINE API...')
    const uploadRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channelAccessToken}`,
        'Content-Type': imageBlob.type || 'image/png' // 動的に判定
      },
      body: imageBlob
    })

    if (!uploadRes.ok) {
      const errText = await uploadRes.text()
      console.error('Upload error response:', uploadRes.status, errText)
      throw new Error(`Failed to upload rich menu image: ${errText}`)
    }
    console.log('Image upload successful')

    // LINE が画像の実体を取り込んだので、生成した合成画像はもう誰も参照しない。
    // 適用のたびに残すと Storage が際限なく膨らむため、過去分ごとここで消す。
    await purgeGeneratedRichMenuImages(supabaseClient.storage, store_id)

    // 8. Set as Default
    console.log('Setting as default rich menu...')
    const defaultRes = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channelAccessToken}`
      }
    })

    if (!defaultRes.ok) {
      const errText = await defaultRes.text()
      console.error('Default setting error:', defaultRes.status, errText)
      throw new Error(`Failed to set default rich menu: ${errText}`)
    }
    console.log('Default rich menu set successfully')

    return new Response(
      JSON.stringify({ success: true, richMenuId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    return safeErrorResponse(error, corsHeaders, 400, 'Internal server error')
  }
})
