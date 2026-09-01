import { supabase } from './supabase'

export type PublicStoreInfo = {
  id: string
  name: string | null
  liff_template_id: string | null
  liff_theme_color: string | null
  liff_logo_url: string | null
  booking_system_type: string | null
  slot_interval_minutes: number | null
  capacity_per_slot: number | null
  max_booking_days: number | null
  business_hours: Record<string, { start: string; end: string }[]> | null
  booking_enable_party_size: boolean | null
  booking_enable_staff: boolean | null
  booking_enable_menu: boolean | null
  membership_card_title: string | null
  membership_card_color: string | null
  membership_card_logo_url: string | null
  membership_card_template_id: string | null
  membership_card_settings: unknown
  membership_rank_settings: unknown
}

/**
 * LIFF の公開画面（予約・会員証）が使う店舗の公開設定を取得する。
 *
 * stores は以前 anon キーで直接テーブルを読んでおり、店舗を絞る RLS が無く
 * 全店舗の名前・リッチメニュー設定・会員証設定などが読めてしまっていた。
 * booking Edge Function の get_store_public_info（サービスロールで
 * 店舗ごとに絞って返す）経由に寄せることで、anon の直接テーブルアクセスを塞ぐ。
 *
 * storeId を省略すると、システム全体で店舗がちょうど1件のときだけそれを返す
 * （店舗未登録の開発・デモ環境向けの互換動作。判定はサーバー側で行うため、
 * 複数店舗があっても他店舗の設定がクライアントに渡ることはない）。
 */
export async function fetchPublicStoreInfo(storeId?: string | null): Promise<PublicStoreInfo | null> {
  const { data, error } = await supabase.functions.invoke('booking', {
    body: { action: 'get_store_public_info', store_id: storeId || undefined },
  })

  if (error) throw error
  if (data?.error) throw new Error(String(data.error))

  return (data?.store as PublicStoreInfo | null) ?? null
}
