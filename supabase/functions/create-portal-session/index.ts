// Using Deno.serve instead of @std/http/server
import { createClient } from '@supabase/supabase-js'
import { stripe } from '../_shared/stripe-client.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeErrorResponse } from '../_shared/error-utils.ts'

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

    // stripe_customer_id は本人にも書かせない列なので、保存はサービスロールで行う。
    // 利用者が自分で書けると、他人の Stripe 顧客IDを自分の行に入れて
    // 請求ポータルから他人の契約を操作できてしまう。
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('User not found')
    }

    const { return_url } = await req.json()

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      // Create new Stripe customer if none exists
      const customer = await stripe.customers.create({
        email: user.email || profile?.email,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id

      // Update profile with stripe_customer_id
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    } else {
      // Verify that the customer exists in Stripe
      try {
        await stripe.customers.retrieve(customerId)
      } catch (error: unknown) {
        // If customer doesn't exist, create a new one
        console.log(`Customer ${customerId} not found in Stripe, creating new customer`)
        const customer = await stripe.customers.create({
          email: user.email || profile?.email,
          metadata: {
            supabase_user_id: user.id,
          },
        })
        customerId = customer.id

        // Update profile with new stripe_customer_id
        await supabaseAdmin
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id)
      }
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: return_url,
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: unknown) {
    return safeErrorResponse(error, corsHeaders, 400, 'Internal server error')
  }
})
