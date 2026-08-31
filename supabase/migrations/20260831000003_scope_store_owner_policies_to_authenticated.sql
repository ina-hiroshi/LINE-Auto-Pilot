-- 店舗オーナー向けの RLS ポリシーを authenticated ロールに限定する
--
-- 背景
--   20260831000002 で stores の列権限を anon から絞った結果、予約ページ（anon）から
--     GET /rest/v1/booking_menus?store_id=eq.<uuid>
--   が 42501 "permission denied for table stores" で失敗するようになった。
--
--   原因は RLS ポリシーの評価にある。下記のオーナー向けポリシーは
--     store_id in (select id from stores where owner_id = auth.uid())
--   という形で stores を副問い合わせしており、TO 句が無いため role = public、
--   つまり anon にも適用される。ポリシー式は呼び出し元のロールの権限で評価されるので、
--   anon が owner_id の SELECT 権限を持たない今、式を評価した時点で権限エラーになる。
--
--   同じ形のポリシーでも booking_special_dates が壊れなかったのは、
--   併存する公開ポリシーが USING (true) で、プランナが OR を畳んで
--   stores の副問い合わせごと消せたため。booking_menus / staff_members は
--   公開ポリシーが USING (is_active = true) で畳めず、副問い合わせが残っていた。
--
--   実害は予約 LIFF。useStoreResources が staff_members と booking_menus を
--   anon で読むが、エラーを握り潰して空配列のままにするため、
--   スタッフ選択・メニュー選択に何も出ず予約が進められなくなっていた。
--
-- 方針
--   auth.uid() は anon では常に null なので、これらのポリシーが anon で真になることはない。
--   TO authenticated を明示して anon の実行計画から stores の参照を外す。
--   認証済み利用者から見た挙動は変わらない（service_role は RLS を迂回する）。

alter policy "Users can view their own store ai settings" on public.ai_settings to authenticated;
alter policy "Users can insert their own store ai settings" on public.ai_settings to authenticated;
alter policy "Users can update their own store ai settings" on public.ai_settings to authenticated;
alter policy "Users can delete their own store ai settings" on public.ai_settings to authenticated;

alter policy "Users can view their own store's auto responses" on public.auto_responses to authenticated;
alter policy "Users can insert their own store's auto responses" on public.auto_responses to authenticated;
alter policy "Users can update their own store's auto responses" on public.auto_responses to authenticated;
alter policy "Users can delete their own store's auto responses" on public.auto_responses to authenticated;

alter policy "Users can manage their own store menus" on public.booking_menus to authenticated;

alter policy "Store owners can manage special dates" on public.booking_special_dates to authenticated;

alter policy "Users can view their own store's logs" on public.customer_logs to authenticated;
alter policy "Users can update their own store's logs" on public.customer_logs to authenticated;

alter policy "Users can view their store treatment notes" on public.customer_treatment_notes to authenticated;
alter policy "Users can insert their store treatment notes" on public.customer_treatment_notes to authenticated;
alter policy "Users can update their store treatment notes" on public.customer_treatment_notes to authenticated;
alter policy "Users can delete their store treatment notes" on public.customer_treatment_notes to authenticated;

alter policy "Users can view their own store's customers" on public.customers to authenticated;
alter policy "Users can insert their own store's customers" on public.customers to authenticated;
alter policy "Users can update their own store's customers" on public.customers to authenticated;

alter policy "Users can view their own store knowledge base" on public.knowledge_base to authenticated;
alter policy "Users can insert their own store knowledge base" on public.knowledge_base to authenticated;
alter policy "Users can update their own store knowledge base" on public.knowledge_base to authenticated;
alter policy "Users can delete their own store knowledge base" on public.knowledge_base to authenticated;

alter policy "Users can manage their own line accounts" on public.line_accounts to authenticated;

alter policy "Users can view their own store's points" on public.points to authenticated;
alter policy "Users can insert their own store's points" on public.points to authenticated;
alter policy "Users can update their own store's points" on public.points to authenticated;

alter policy "Users can view their own store's reservations" on public.reservations to authenticated;
alter policy "Users can insert their own store's reservations" on public.reservations to authenticated;
alter policy "Users can update their own store's reservations" on public.reservations to authenticated;
alter policy "Users can delete their own store's reservations" on public.reservations to authenticated;

alter policy "Users can manage their own store staff" on public.staff_members to authenticated;

alter policy "Store owners can manage staff special schedules" on public.staff_special_schedules to authenticated;
alter policy "Store owners can manage staff work patterns" on public.staff_work_patterns to authenticated;

-- temporary_holds は line_user_id = auth.jwt() ->> 'sub' との OR だが、
-- anon キーの JWT に sub は無く、仮押さえは booking Edge Function が
-- サービスロールで行うため anon から直接使う経路は無い。
alter policy "Users can manage their own holds" on public.temporary_holds to authenticated;
