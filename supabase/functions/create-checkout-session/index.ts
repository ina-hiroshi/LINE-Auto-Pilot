// Using Deno.serve instead of @std/http/server
import { createClient } from '@supabase/supabase-js'
import { stripe } from '../_shared/stripe-client.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeErrorResponse } from '../_shared/error-utils.ts'

// プレリリースモード: 2ヶ月無料トライアル
// 正式リリース時は false に変更するか、トライアル日数を調整
const IS_PRE_RELEASE_MODE = false
const TRIAL_DAYS = IS_PRE_RELEASE_MODE ? 60 : 30 // プレリリース: 60日、正式リリース: 30日

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
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
    } else {
      // Verify that the customer exists in Stripe
      let customerExists = false
      try {
        const retrievedCustomer = await stripe.customers.retrieve(customerId)
        // Check if customer was deleted (deleted customers return an object with deleted: true)
        customerExists = !(retrievedCustomer && typeof retrievedCustomer === 'object' && 'deleted' in retrievedCustomer && retrievedCustomer.deleted)
      } catch (error: unknown) {
        // If customer doesn't exist, mark as not existing
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.log(`Customer ${customerId} not found in Stripe (${errorMessage})`)
        customerExists = false
      }

      if (!customerExists) {
        // Create a new customer
        console.log(`Creating new customer to replace invalid customer ID: ${customerId}`)
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            supabase_user_id: user.id,
          },
        })
        customerId = customer.id

        // Update profile with new stripe_customer_id
        await supabaseClient
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id)
      }
    }

    // トライアル設定: 過去にトライアルを利用していない場合のみ適用
    const subscriptionData: {
      trial_period_days?: number
      trial_settings?: { end_behavior: { missing_payment_method: string } }
    } = {}

    console.log(`Trial check: hasUsedTrial=${hasUsedTrial}, IS_PRE_RELEASE_MODE=${IS_PRE_RELEASE_MODE}, TRIAL_DAYS=${TRIAL_DAYS}`)

    if (!hasUsedTrial) {
      subscriptionData.trial_period_days = TRIAL_DAYS
      subscriptionData.trial_settings = {
        end_behavior: {
          missing_payment_method: 'cancel', // 支払い方法がない場合はキャンセル
        },
      }
      console.log(`Trial period set: ${TRIAL_DAYS} days`)
    } else {
      console.log('Trial period not applied: user has already used trial')
    }

    // Create checkout session with retry logic for customer errors
    let session
    try {
      console.log(`Creating checkout session with subscription_data:`, subscriptionData)
      session = await stripe.checkout.sessions.create({
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
      console.log(`Checkout session created: ${session.id}`)
    } catch (checkoutError: unknown) {
      const errorMessage = checkoutError instanceof Error ? checkoutError.message : String(checkoutError)
      
      // If error is related to customer not found, create a new customer and retry
      if (errorMessage.includes('No such customer') || errorMessage.includes('customer')) {
        console.log(`Checkout session creation failed due to customer error: ${errorMessage}, creating new customer and retrying`)
        
        // Create new customer
        const newCustomer = await stripe.customers.create({
          email: user.email,
          metadata: {
            supabase_user_id: user.id,
          },
        })
        customerId = newCustomer.id

        // Update profile with new stripe_customer_id
        await supabaseClient
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id)

        // Retry checkout session creation with new customer
        console.log(`Retrying checkout session creation with subscription_data:`, subscriptionData)
        session = await stripe.checkout.sessions.create({
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
      } else {
        // Re-throw if it's not a customer-related error
        throw checkoutError
      }
    }

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: unknown) {
    return safeErrorResponse(error, corsHeaders, 400, '決済処理に失敗しました。再度お試しください。')
  }
})
