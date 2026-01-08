// 設定代行サービスの決済セッション作成
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { stripe } from '../_shared/stripe-client.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('User not found')

    const { 
      contact_email,
      has_line_account,
      line_account_basic_id,
      additional_notes,
      return_url,
      store_id
    } = await req.json()

    // store_idが指定されていない場合、ユーザーの店舗情報を取得
    let finalStoreId = store_id
    if (!finalStoreId) {
      const { data: storeData } = await supabaseClient
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()
      
      if (storeData) {
        finalStoreId = storeData.id
        console.log('Store ID found:', finalStoreId)
      } else {
        console.log('No store found for user, store_id will be null')
      }
    }

    // 設定代行注文を作成
    const { data: order, error: orderError } = await supabaseClient
      .from('setup_service_orders')
      .insert({
        user_id: user.id,
        store_id: finalStoreId || null,
        contact_email,
        has_line_account: has_line_account || false,
        line_account_basic_id,
        additional_notes,
        status: 'pending'
      })
      .select()
      .single()

    if (orderError) throw orderError

    // 価格IDを取得
    const priceId = Deno.env.get('STRIPE_PRICE_ID_SETUP_SERVICE')
    if (!priceId) {
      console.error('STRIPE_PRICE_ID_SETUP_SERVICE is not set')
      throw new Error('価格IDが設定されていません')
    }
    console.log('Using price ID:', priceId)

    // Stripe Checkout Session 作成（一回払い）
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'payment', // サブスクリプションではなく一回払い
      customer_email: contact_email, // 決済ページにメールアドレスを事前入力
      success_url: `${return_url}?setup_order_id=${order.id}`,
      cancel_url: `${return_url}`,
      client_reference_id: order.id, // 注文IDを紐付け
      metadata: {
        order_id: order.id,
        user_id: user.id,
        type: 'setup_service'
      }
    })

    // Checkout Session IDを保存
    await supabaseClient
      .from('setup_service_orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', order.id)

    return new Response(
      JSON.stringify({ url: session.url, order_id: order.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Create setup checkout error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
