-- 前の migration で INSERT 経由の「自己申告で paid にする」穴は塞いだが、
-- "Users can update own orders" (USING/WITH CHECK: auth.uid() = user_id のみ、
-- status に制約なし) が残っており、同じ抜け道が UPDATE 経由でまだ開いていた。
-- 実際に RLS をシミュレートし、pending で作成した自分の注文を
-- status='paid', amount=0 に直接 UPDATE できることを確認した
-- （トランザクションは rollback 済み、本番データへの影響なし）。
--
-- 非管理者がこのポリシー経由で行う正当な更新は、create-setup-checkout
-- Edge Function が Stripe Checkout Session 作成後に行う
-- stripe_checkout_session_id の設定だけで、このとき注文はまだ pending。
-- 'paid' への更新は stripe-webhook（サービスロール、RLSを迂回）だけが行う。
--
-- 対象行・更新後の行の両方を「自分の・pending の」注文に限定することで、
-- stripe_checkout_session_id の更新は許可したまま、status/amount/paid_at の
-- 自己申告での書き換えを防ぐ。
-- 管理者向けの "Admins can update all orders" ポリシー（is_admin のみを見る）
-- はそのまま維持する。

drop policy if exists "Users can update own orders" on public.setup_service_orders;

create policy "Users can update own pending orders"
  on public.setup_service_orders
  for update
  to public
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'pending');
