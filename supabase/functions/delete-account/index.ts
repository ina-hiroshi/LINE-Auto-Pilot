// アカウント削除（退会）
//
// 実行順序が重要:
//   1. Stripe のサブスクリプションを即時解約（トライアル中を含む）
//   2. Google 連携トークンの失効
//   3. Storage のファイル削除
//   4. DB レコードの削除
//   5. auth.users の削除
// 課金の停止を最優先で確定させ、以降が失敗しても請求が続かないようにする。
// 1 が失敗した場合は何も削除せずに中断する（解約は冪等なのでリトライ可能）。
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { stripe } from '../_shared/stripe-client.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeErrorResponse } from '../_shared/error-utils.ts'
import { isAdminUser } from '../_shared/admin-check.ts'

/** Stripe 側で既に終了しており、解約 API を呼ぶ必要がないステータス */
const TERMINAL_SUBSCRIPTION_STATUSES = ['canceled', 'incomplete_expired']

/** テーブルが存在しない場合の PostgREST / Postgres エラーコード */
const MISSING_TABLE_CODES = ['42P01', 'PGRST205']

/** 店舗配下のファイルを置いている Storage バケット */
const STORE_PREFIXED_BUCKETS = ['store-assets', 'knowledge_docs']

type Json = Record<string, unknown>

function jsonResponse(body: Json, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * 削除を実行する。テーブル自体が存在しない場合（旧環境など）は無視する。
 * 対象が 0 件でもエラーにはならない（冪等）。
 */
async function deleteWhereIn(
  admin: SupabaseClient,
  table: string,
  column: string,
  values: string[],
): Promise<void> {
  if (values.length === 0) return

  const { error } = await admin.from(table).delete().in(column, values)
  if (!error) return
  if (MISSING_TABLE_CODES.includes(error.code ?? '')) {
    console.log(`[delete-account] skip missing table: ${table}`)
    return
  }
  throw new Error(`Failed to delete ${table}.${column}: ${error.message}`)
}

/** Stripe のサブスクリプションを即時解約し、支払い方法を切り離す */
async function cancelStripe(customerId: string, userId: string): Promise<string[]> {
  const canceled: string[] = []

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
  })

  for (const subscription of subscriptions.data) {
    if (TERMINAL_SUBSCRIPTION_STATUSES.includes(subscription.status)) continue

    // trialing / past_due / cancel_at_period_end のものも含めて即時解約する。
    // prorate: false で日割り返金を発生させない（利用規約の記載に合わせる）。
    await stripe.subscriptions.cancel(subscription.id, { invoice_now: false, prorate: false })
    canceled.push(subscription.id)
  }

  // カード情報を残さない。請求書・入金履歴は Customer 側に残るため会計記録は失われない。
  try {
    const paymentMethods = await stripe.paymentMethods.list({ customer: customerId, limit: 100 })
    for (const paymentMethod of paymentMethods.data) {
      await stripe.paymentMethods.detach(paymentMethod.id)
    }
  } catch (error) {
    console.error('[delete-account] failed to detach payment methods (ignoring):', error)
  }

  try {
    await stripe.customers.update(customerId, {
      metadata: {
        supabase_user_id: userId,
        account_deleted_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[delete-account] failed to mark customer as deleted (ignoring):', error)
  }

  return canceled
}

/** Google カレンダーの watch を停止し、リフレッシュトークンを失効させる */
async function revokeGoogle(settings: {
  refresh_token: string | null
  channel_id: string | null
  resource_id: string | null
}): Promise<void> {
  if (!settings.refresh_token) return

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

  if (clientId && clientSecret && settings.channel_id && settings.resource_id) {
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: settings.refresh_token,
          grant_type: 'refresh_token',
        }),
      })
      const tokenData = await tokenResponse.json()
      if (tokenData.access_token) {
        await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: settings.channel_id, resourceId: settings.resource_id }),
        })
      }
    } catch (error) {
      console.error('[delete-account] failed to stop google watch (ignoring):', error)
    }
  }

  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: settings.refresh_token }),
    })
  } catch (error) {
    console.error('[delete-account] failed to revoke google token (ignoring):', error)
  }
}

/** 店舗に紐づく Storage 上のファイルを削除する */
async function purgeStorage(admin: SupabaseClient, storeIds: string[]): Promise<void> {
  if (storeIds.length === 0) return

  for (const storeId of storeIds) {
    for (const bucket of STORE_PREFIXED_BUCKETS) {
      try {
        const { data, error } = await admin.storage.from(bucket).list(storeId, { limit: 1000 })
        if (error || !data?.length) continue
        await admin.storage.from(bucket).remove(data.map((file) => `${storeId}/${file.name}`))
      } catch (error) {
        console.error(`[delete-account] failed to purge ${bucket}/${storeId} (ignoring):`, error)
      }
    }
  }

  // rich_menus はフォルダを切らず rich-menu-{storeId}-{timestamp}.png で保存しているため、
  // バケット直下を一度だけ列挙して該当店舗のファイルを拾う。
  try {
    const { data, error } = await admin.storage.from('rich_menus').list('', { limit: 1000 })
    if (error || !data?.length) return
    const paths = data
      .filter((file) => storeIds.some((storeId) => file.name.startsWith(`rich-menu-${storeId}-`)))
      .map((file) => file.name)
    if (paths.length > 0) await admin.storage.from('rich_menus').remove(paths)
  } catch (error) {
    console.error('[delete-account] failed to purge rich_menus (ignoring):', error)
  }
}

/**
 * 店舗配下のデータを外部キーの依存順（子 → 親）に削除する。
 * 多くは stores への ON DELETE CASCADE が張られているが、
 * ダッシュボード上で作成されたテーブルは制約が確認できないため明示的に削除する。
 */
async function deleteStoreData(admin: SupabaseClient, storeIds: string[]): Promise<void> {
  if (storeIds.length === 0) return

  const { data: staff } = await admin.from('staff_members').select('id').in('store_id', storeIds)
  const staffIds = (staff ?? []).map((row: { id: string }) => row.id)

  await deleteWhereIn(admin, 'customer_treatment_notes', 'store_id', storeIds)
  await deleteWhereIn(admin, 'customer_logs', 'store_id', storeIds)
  await deleteWhereIn(admin, 'points', 'store_id', storeIds)
  await deleteWhereIn(admin, 'temporary_holds', 'store_id', storeIds)
  await deleteWhereIn(admin, 'ai_rate_limits', 'store_id', storeIds)
  await deleteWhereIn(admin, 'ai_settings', 'store_id', storeIds)
  await deleteWhereIn(admin, 'knowledge_base', 'store_id', storeIds)
  await deleteWhereIn(admin, 'auto_responses', 'store_id', storeIds)
  await deleteWhereIn(admin, 'booking_special_dates', 'store_id', storeIds)
  await deleteWhereIn(admin, 'reservations', 'store_id', storeIds)
  await deleteWhereIn(admin, 'staff_special_schedules', 'staff_id', staffIds)
  await deleteWhereIn(admin, 'staff_work_patterns', 'staff_id', staffIds)
  await deleteWhereIn(admin, 'staff_members', 'store_id', storeIds)
  await deleteWhereIn(admin, 'booking_menus', 'store_id', storeIds)
  await deleteWhereIn(admin, 'customers', 'store_id', storeIds)
  await deleteWhereIn(admin, 'line_messaging_link_tokens', 'store_id', storeIds)
  await deleteWhereIn(admin, 'line_accounts', 'store_id', storeIds)
  await deleteWhereIn(admin, 'setup_service_orders', 'store_id', storeIds)
  await deleteWhereIn(admin, 'stores', 'id', storeIds)
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders)
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
      return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders)
    }

    // 誤操作防止: 本人のメールアドレスの入力を必須にする
    let body: { confirmation?: unknown }
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, corsHeaders)
    }

    const confirmation = typeof body.confirmation === 'string' ? body.confirmation.trim() : ''
    if (!user.email || confirmation.toLowerCase() !== user.email.toLowerCase()) {
      return jsonResponse({ error: 'メールアドレスが一致しません。' }, 400, corsHeaders)
    }

    // 運用者アカウントを画面操作で消せないようにする（管理ダッシュボードごと失われるため）
    if (await isAdminUser(supabaseClient, user.id, user.email)) {
      return jsonResponse(
        { error: '管理者アカウントはこの画面からは削除できません。' },
        403,
        corsHeaders,
      )
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    const { data: stores } = await admin.from('stores').select('id').eq('owner_id', user.id)
    const storeIds = (stores ?? []).map((row: { id: string }) => row.id)

    // 1. 課金の停止を最優先で確定させる。失敗した場合は何も削除しない。
    let canceledSubscriptionIds: string[] = []
    if (profile?.stripe_customer_id) {
      try {
        canceledSubscriptionIds = await cancelStripe(profile.stripe_customer_id, user.id)
      } catch (error) {
        console.error('[delete-account] stripe cancellation failed:', error)
        return jsonResponse(
          {
            error:
              'ご契約の解約処理に失敗したため、アカウントの削除を中断しました。時間をおいて再度お試しいただくか、サポートまでご連絡ください。',
          },
          502,
          corsHeaders,
        )
      }
    }

    // 2. Google 連携の失効（ベストエフォート）
    const { data: googleSettings } = await admin
      .from('google_calendar_settings')
      .select('refresh_token, channel_id, resource_id')
      .eq('user_id', user.id)
    for (const settings of googleSettings ?? []) {
      await revokeGoogle(settings)
    }

    // 3. Storage の削除（ベストエフォート）
    await purgeStorage(admin, storeIds)

    // 4. DB レコードの削除
    await deleteStoreData(admin, storeIds)
    await deleteWhereIn(admin, 'google_calendar_settings', 'user_id', [user.id])
    await deleteWhereIn(admin, 'user_features', 'user_id', [user.id])
    await deleteWhereIn(admin, 'setup_service_orders', 'user_id', [user.id])
    await deleteWhereIn(admin, 'monitor_applications', 'user_id', [user.id])
    if (user.email) {
      await deleteWhereIn(admin, 'verification_codes', 'email', [user.email])
    }
    await deleteWhereIn(admin, 'profiles', 'id', [user.id])

    // 5. 認証ユーザーの削除
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id)
    if (authDeleteError) throw authDeleteError

    // 個人情報を残さないため、監査ログにはメールアドレスを含めない。
    console.log(
      JSON.stringify({
        event: 'account_deleted',
        user_id: user.id,
        store_count: storeIds.length,
        canceled_subscription_ids: canceledSubscriptionIds,
        deleted_at: new Date().toISOString(),
      }),
    )

    return jsonResponse(
      { ok: true, canceled_subscriptions: canceledSubscriptionIds.length },
      200,
      corsHeaders,
    )
  } catch (error: unknown) {
    return safeErrorResponse(
      error,
      corsHeaders,
      500,
      'アカウントの削除に失敗しました。時間をおいて再度お試しください。',
    )
  }
})
