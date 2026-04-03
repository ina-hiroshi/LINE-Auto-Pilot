import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeErrorResponse } from '../_shared/error-utils.ts'
import { isAdminUser } from '../_shared/admin-check.ts'

const ALLOWED_PLANS = ['free', 'pro', 'executive'] as const
type AllowedPlan = (typeof ALLOWED_PLANS)[number]

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = await isAdminUser(supabaseClient, user.id, user.email)
    if (!admin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let body: { userId?: unknown; plan?: unknown }
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
    const planRaw = typeof body.plan === 'string' ? body.plan.trim().toLowerCase() : ''

    if (!userId || !isUuid(userId)) {
      return new Response(JSON.stringify({ error: 'Invalid userId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!ALLOWED_PLANS.includes(planRaw as AllowedPlan)) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const plan = planRaw as AllowedPlan

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    )

    const { data: target, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('id, subscription_id, stripe_customer_id, subscription_status')
      .eq('id', userId)
      .maybeSingle()

    if (fetchErr) throw fetchErr
    if (!target) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: updateErr } = await supabaseAdmin.from('profiles').update({ plan }).eq('id', userId)

    if (updateErr) throw updateErr

    console.log(
      JSON.stringify({
        event: 'admin_update_user_plan',
        admin_user_id: user.id,
        target_user_id: userId,
        plan,
        had_stripe_subscription_id: Boolean(target.subscription_id),
      }),
    )

    const subStatus = String(target.subscription_status ?? '')
    const stripeSubscriptionTerminal = ['canceled', 'incomplete_expired'].includes(subStatus)
    const hasRelevantStripe = Boolean(target.subscription_id) && !stripeSubscriptionTerminal

    return new Response(
      JSON.stringify({
        ok: true,
        ...(hasRelevantStripe
          ? {
              warning:
                'このユーザーには Stripe のサブスクリプションがあります。DB のプランは更新しましたが、次回の請求・Webhook で Stripe 側の内容に合わせて上書きされる可能性があります。恒久的な変更は Stripe ダッシュボードと併用してください。',
            }
          : {}),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    return safeErrorResponse(error, corsHeaders, 500, 'Internal server error')
  }
})
