import type { SupabaseClientType } from '../../_shared/types.ts'
import { ClientVisibleError, toErrorMessage } from '../../_shared/error-utils.ts'
import type { CorsHeaders } from './types.ts'
import { isValidUUID } from './utils.ts'

export type ResourcesParams = {
  store_id?: string
}

/**
 * LIFF の公開予約画面が使う、スタッフ・メニュー・特定日設定の読み取り専用スナップショット。
 *
 * これらは以前 staff_members / booking_menus / booking_special_dates への
 * anon SELECT ポリシーで直接読ませていたが、そのポリシーは店舗を絞る条件が無く、
 * 公開されている anon キーだけで全店舗ぶんのスタッフ名・メニュー価格・定休日が
 * 読み出せてしまっていた。
 *
 * このハンドラは store_id を必須にし、公開画面が実際に必要とする列と
 * is_active な行だけを返す。認可は不要（元々 anon に公開していた情報と同じ範囲）。
 */
export async function handleGetBookingResources(
  supabaseClient: SupabaseClientType,
  params: ResourcesParams,
  corsHeaders: CorsHeaders
): Promise<Response> {
  const { store_id } = params

  if (!store_id) throw new ClientVisibleError('store_id is required')
  if (!isValidUUID(store_id)) throw new ClientVisibleError('Invalid store_id format')

  const [staffResult, menuResult, specialDatesResult] = await Promise.all([
    supabaseClient
      .from('staff_members')
      .select('id, name, role, image_url, is_active')
      .eq('store_id', store_id)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabaseClient
      .from('booking_menus')
      .select('id, name, description, price, duration_minutes, capacity_per_slot, is_active')
      .eq('store_id', store_id)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabaseClient
      .from('booking_special_dates')
      .select('date, is_closed, override_hours')
      .eq('store_id', store_id),
  ])

  if (staffResult.error) throw new ClientVisibleError(toErrorMessage(staffResult.error))
  if (menuResult.error) throw new ClientVisibleError(toErrorMessage(menuResult.error))
  if (specialDatesResult.error) throw new ClientVisibleError(toErrorMessage(specialDatesResult.error))

  return new Response(
    JSON.stringify({
      staffList: staffResult.data ?? [],
      menuList: menuResult.data ?? [],
      specialDates: specialDatesResult.data ?? [],
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}
