import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeErrorResponse } from '../_shared/error-utils.ts'

// モニター施策の上限。DB側の enforce_monitor_application_cap トリガー
// （20260914060000_monitor_applications_capacity_cap.sql）と同じ値を使うこと。
const CAPACITY = 10

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // monitor_applications はRLSで admin か本人の行しか読めないため、
    // 残り枠数（集計値のみ）を返す公開エンドポイントをservice roleで用意する。
    // 行の中身は一切返さない。
    const { count, error } = await admin
      .from('monitor_applications')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'rejected')

    if (error) {
      console.error('[get-monitor-capacity] DB error:', error)
      return new Response(JSON.stringify({ error: 'Failed to load capacity' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const taken = count ?? 0
    const remaining = Math.max(CAPACITY - taken, 0)

    return new Response(
      JSON.stringify({ capacity: CAPACITY, taken, remaining, isFull: remaining <= 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    return safeErrorResponse(error, corsHeaders)
  }
})
