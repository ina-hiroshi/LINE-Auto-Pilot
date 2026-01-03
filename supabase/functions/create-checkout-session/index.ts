// Using Deno.serve instead of @std/http/server
import { createClient } from '@supabase/supabase-js'
import { stripe } from '../_shared/stripe-client.ts'
import { corsHeaders } from '../_shared/cors.ts'

// プレリリースモード: 2ヶ月無料トライアル
// 正式リリース時は false に変更するか、トライアル日数を調整
const IS_PRE_RELEASE_MODE = true
const TRIAL_DAYS = IS_PRE_RELEASE_MODE ? 60 : 30 // プレリリース: 60日、正式リリース: 30日

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

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('User not found')
    }

    const { price_id, return_url } = await req.json()

    // Get profile to check for existing stripe_customer_id and trial usage
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id, email, has_used_trial')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id
    const hasUsedTrial = profile?.has_used_trial || false

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id

      // Update profile with stripe_customer_id
      await supabaseClient
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // トライアル設定: 過去にトライアルを利用していない場合のみ適用
    const subscriptionData: {
      trial_period_days?: number
      trial_settings?: { end_behavior: { missing_payment_method: string } }
    } = {}

    if (!hasUsedTrial) {
      subscriptionData.trial_period_days = TRIAL_DAYS
      subscriptionData.trial_settings = {
        end_behavior: {
          missing_payment_method: 'cancel', // 支払い方法がない場合はキャンセル
        },
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: user.id,
      line_items: [
        {
          price: price_id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${return_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${return_url}`,
      subscription_data: Object.keys(subscriptionData).length > 0 ? subscriptionData : undefined,
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
