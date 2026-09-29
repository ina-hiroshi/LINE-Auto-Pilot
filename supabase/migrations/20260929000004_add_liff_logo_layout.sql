-- 予約ページ上部のロゴ配置を店舗ごとに選べるようにする
--
--   center : ロゴを中央に置き、下に「予約フォーム」を小さく添える（新規店舗の初期値）
--   inline : 左にロゴ、右に店名と「予約フォーム」を横並び
--   banner : 横長ロゴを幅いっぱいに見せる（従来の全幅表示に近い）
--
-- 既にロゴを登録している店舗は、これまで全幅で表示されていたため banner にそろえる。
-- ただし新しい banner は最大高さ 112px で拡大もしないので、旧表示（幅いっぱいに拡大、
-- 最大 24rem）と全く同じにはならない。大きなロゴは以前より小さく表示される。
--
-- anon への列 GRANT は追加しない。予約ページは booking Edge Function
-- （get_store_public_info、service_role）経由で読むため、直接のテーブル参照は不要。

alter table public.stores
  add column if not exists liff_logo_layout text not null default 'center';

alter table public.stores
  drop constraint if exists stores_liff_logo_layout_check;

alter table public.stores
  add constraint stores_liff_logo_layout_check
  check (liff_logo_layout in ('center', 'inline', 'banner'));

update public.stores
   set liff_logo_layout = 'banner'
 where liff_logo_layout = 'center'
   and liff_logo_url is not null
   and liff_logo_url <> '';
