-- setup_service_orders の "Users can create own orders" ポリシーは
-- WITH CHECK (auth.uid() = user_id) だけで、status / amount / paid_at には
-- 何の制約も無かった。つまり認証済みユーザーなら誰でも、自分の user_id で
-- status='paid'（または 'in_progress'）・amount=0・paid_at=now() を
-- 直接 INSERT するだけで、実際には一切支払わずに「決済済みの初期設定代行
-- 注文」を作れてしまっていた。
--
-- 実際に RLS を authenticated ロールでシミュレートして INSERT が通ることを
-- 確認した（トランザクションは rollback 済み、本番データへの影響なし）。
--
-- この注文は運営が人手で初期設定を代行するためのキューであり、
-- status='paid'/'in_progress' の注文は無償で¥9,980相当の作業が
-- 行われてしまう。正規のフロー（create-setup-checkout Edge Function）は
-- 必ず status='pending' で作成し、'paid' への更新は stripe-webhook
-- （サービスロール、RLSを迂回）だけが行う。
--
-- 非管理者の自己作成は status='pending' のときだけ許可するよう絞る。
-- 管理者向けの "Admins can create orders for any user" ポリシー
-- （is_admin のみを見る、status 制限なし）は、検証用の即時付与フロー
-- （Onboarding.tsx の handleSkipPayment、管理者が自分の user_id に
-- status='in_progress' で登録する）を含め、そのまま維持する。

drop policy if exists "Users can create own orders" on public.setup_service_orders;

create policy "Users can create own pending orders"
  on public.setup_service_orders
  for insert
  to public
  with check (auth.uid() = user_id and status = 'pending');
