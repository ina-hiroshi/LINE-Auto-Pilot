import type { SupabaseClientType } from '../../_shared/types.ts'
import { ClientVisibleError, toErrorMessage } from '../../_shared/error-utils.ts'
import type { CorsHeaders } from './types.ts'
import { isValidUUID } from './utils.ts'

export type StoreInfoParams = {
  store_id?: string
}

/**
 * Booking.tsx / MemberCardLIFF.tsx（LIFFの公開画面）が使う店舗の公開設定。
 *
 * stores は anon に `USING (true)` の SELECT ポリシーがあり、店舗を絞る条件が
 * 無かったため、公開されている anon キーだけで全店舗の名前・リッチメニュー設定・
 * 会員証設定などを列挙できてしまっていた（実際に確認済み）。
 *
 * このハンドラは store_id を指定すればその店舗だけを、省略した場合は
 * 「システム全体で店舗が1件しか無いときだけ」その1件を返す
 * （store_id 無しでの起動を許す既存の単一テナント向けフォールバックを
 * サービスロール側で安全に判定する。以前はこの判定のためにクライアントが
 * 直接 anon で最大2件の他店舗データを取得しており、それ自体が小さな漏えいだった）。
 */
const PUBLIC_STORE_COLUMNS =
  'id, name, liff_template_id, liff_theme_color, liff_logo_url, booking_system_type, ' +
  'slot_interval_minutes, capacity_per_slot, max_booking_days, business_hours, ' +
  'booking_enable_party_size, booking_enable_staff, booking_enable_menu, ' +
  'membership_card_title, membership_card_color, membership_card_logo_url, ' +
  'membership_card_template_id, membership_card_settings, membership_rank_settings'

export async function handleGetStorePublicInfo(
  supabaseClient: SupabaseClientType,
  params: StoreInfoParams,
  corsHeaders: CorsHeaders
): Promise<Response> {
  const { store_id } = params

  if (store_id) {
    if (!isValidUUID(store_id)) throw new ClientVisibleError('Invalid store_id format')

    const { data, error } = await supabaseClient
      .from('stores')
      .select(PUBLIC_STORE_COLUMNS)
      .eq('id', store_id)
      .maybeSingle()

    if (error) throw new ClientVisibleError(toErrorMessage(error))
    return new Response(JSON.stringify({ store: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // store_id 未指定: 店舗が全体でちょうど1件のときだけそれを使う
  // （複数店舗があるのに「最初の1件」を採ると、別テナントの予約ページを出してしまう）
  const { data, error } = await supabaseClient
    .from('stores')
    .select(PUBLIC_STORE_COLUMNS)
    .limit(2)

  if (error) throw new ClientVisibleError(toErrorMessage(error))

  const store = data?.length === 1 ? data[0] : null
  return new Response(JSON.stringify({ store }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
