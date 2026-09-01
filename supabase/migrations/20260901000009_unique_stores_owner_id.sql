-- stores.owner_id に一意制約が無く、アプリ側は「1オーナー1店舗」を前提に
-- 至る所で .maybeSingle()/.limit(1) を使っている（Onboarding.tsx の
-- handleSaveBasicInfo は、初回マウント時の非同期フェッチが完了する前に
-- 保存ボタンを押すと storeId が null のままで、既存店舗があっても
-- 新規 INSERT に倒れてしまう。実害は0件確認しているが、レースコンディション
-- そのものは残っている）。
--
-- アプリ側の完全な対策（保存前に必ず再確認する等）は別途検討の余地があるが、
-- ここでは最後の砦としてDB制約で二重作成そのものを防ぐ。
-- 重複が今のところ無いことは確認済みで、この制約は既存データに違反しない。

alter table public.stores
  add constraint stores_owner_id_key unique (owner_id);
