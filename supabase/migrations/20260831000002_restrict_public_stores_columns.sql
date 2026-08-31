-- stores: 未ログイン（anon）から見える列を予約ページに必要な範囲へ絞る
--
-- 背景
--   RLS ポリシー "Public read access to stores" は role = anon / USING (true)。
--   予約ページ（/booking）と会員証 LIFF を未ログインで動かすために必要な設定だが、
--   行の制限が無いので anon キーだけで
--     GET /rest/v1/stores?select=*
--   と投げれば、全店舗の owner_id・住所・郵便番号・電話番号を一覧で取得できた。
--   owner_id は auth.users の UUID なので、他テナントの利用者識別子が
--   そのまま外に出ている状態だった。
--
-- 方針
--   行の可視性（USING (true)）は予約ページのために維持し、
--   列の制限を GRANT で加える。profiles に対する
--   20260830000001_restrict_profiles_column_privileges.sql と同じ考え方。
--
-- 影響確認（2026-08-31 時点のフロントエンド）
--   anon で stores を読むのは以下の3経路のみで、いずれも列を明示指定しており
--   下記の許可列に収まる。select('*') を使っている anon 経路は無い。
--     pages/Booking.tsx        id, name, liff_*, booking_*, slot_interval_minutes,
--                              capacity_per_slot, max_booking_days, business_hours
--     pages/MemberCardLIFF.tsx name, membership_card_*, membership_rank_settings
--     rpc get_store_plan       SECURITY DEFINER のため GRANT の影響を受けない
--   authenticated（管理画面）と service_role の権限は変更しない。

revoke select on public.stores from anon;

grant select (
  id,
  name,
  industry,
  is_ai_enabled,
  liff_template_id,
  liff_theme_color,
  liff_logo_url,
  rich_menu_template_id,
  rich_menu_custom_image_url,
  rich_menu_custom_json,
  rich_menu_layout_id,
  rich_menu_actions,
  booking_system_type,
  slot_interval_minutes,
  capacity_per_slot,
  business_hours,
  max_booking_days,
  membership_card_title,
  membership_card_color,
  membership_card_logo_url,
  membership_card_template_id,
  membership_card_settings,
  membership_rank_settings,
  booking_enable_party_size,
  booking_enable_staff,
  booking_enable_menu,
  created_at,
  updated_at
) on public.stores to anon;

-- 意図的に anon へ渡さない列:
--   owner_id      auth.users の UUID。他テナントの利用者識別子
--   postal_code   店舗の所在地情報。予約ページの表示には使っていない
--   address
--   phone_number
--
-- 残る課題（このマイグレーションでは解消しない）
--   行フィルタが無いため、anon は依然として全店舗の id と name を列挙できる。
--   予約ページが store_id 前提である以上 RLS だけでは塞げないので、
--   店舗一覧が秘匿情報になる段階で SECURITY DEFINER 関数か
--   専用ビュー経由の取得に切り替える。
