-- モニター申込と設定代行注文をつなぐ。
--
-- 背景: monitor_applications は「登録前の見込み客」、setup_service_orders は
-- 「登録済みユーザーの決済済み注文」で、user_id が NOT NULL のため両者が分断していた。
-- 管理者がモニター申込を見ても、初期設定依頼タブに作業対象として現れず、
-- 代行作業に着手できなかった。
--
-- 対応: 注文側に申込へのリンクを持たせ、管理者が申込者本人の代わりに
-- 注文を作成できるようにする（モニター特典なので amount は 0）。

ALTER TABLE setup_service_orders
  ADD COLUMN IF NOT EXISTS monitor_application_id UUID
  REFERENCES monitor_applications(id) ON DELETE SET NULL;

COMMENT ON COLUMN setup_service_orders.monitor_application_id IS
  'モニター特典としてこの注文を発生させた申込。通常の有料注文では NULL。';

-- 1つの申込から注文が二重に作られるのを防ぐ。
CREATE UNIQUE INDEX IF NOT EXISTS idx_setup_orders_monitor_application
  ON setup_service_orders(monitor_application_id)
  WHERE monitor_application_id IS NOT NULL;

-- 管理者は他人の注文を作成できる必要がある。
-- 既存の "Users can create own orders" は auth.uid() = user_id を要求するため、
-- 管理者がモニター申込者の代わりに作成できなかった。
DROP POLICY IF EXISTS "Admins can create orders for any user" ON setup_service_orders;
CREATE POLICY "Admins can create orders for any user" ON setup_service_orders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
