-- staff_members / booking_menus / booking_special_dates は anon に
-- 店舗を絞らない SELECT ポリシー（staff_members/booking_menus は
-- is_active=true のみの条件、booking_special_dates は USING (true)）が
-- 付いており、公開されている anon キーだけで全店舗ぶんのスタッフ名・
-- メニュー価格・定休日が読み出せていた。
--
-- これらを読む唯一の匿名利用箇所は LIFF の公開予約画面（Booking.tsx）で、
-- 直前のコミットで booking Edge Function の get_booking_resources
-- アクション（store_id 必須・サービスロールで店舗ごとに絞って返す）経由に
-- 切り替え済み。Edge Function のデプロイとフロントの本番反映を確認した
-- 上でこの移行を適用する。
--
-- 店舗管理画面（authenticated）向けのポリシーはそのまま残す。

drop policy if exists "Public read access to active staff" on public.staff_members;
drop policy if exists "Public read access to active menus" on public.booking_menus;
drop policy if exists "Public read special dates" on public.booking_special_dates;
