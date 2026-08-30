-- profiles: 課金・権限に関わる列をクライアントから書けないようにする
--
-- 背景
--   RLS の UPDATE ポリシー "Users can update their own profile" は
--   USING (auth.uid() = id) だけで、WITH CHECK も列の制限も無かった。
--   さらに authenticated / anon ロールが profiles の全列に UPDATE 権限を
--   持っていたため、ログインした利用者が
--     PATCH /rest/v1/profiles?id=eq.<自分のid>  {"is_admin": true}
--   を送るだけで管理者に昇格できた。
--   管理者になると line_accounts の "Admins can manage all line accounts"
--   ポリシーが効き、全店舗の channel_access_token / channel_secret を
--   読めてしまう。あわせて plan を自分で 'pro' に書き換えて課金も回避できた。
--
-- 方針
--   行の制限は RLS に任せたまま、列の制限を GRANT で加える。
--   本人が編集してよいプロフィール項目だけを authenticated に許可し、
--   課金・権限に関わる列は service_role（Stripe Webhook と管理用
--   Edge Function）だけが書ける状態にする。

revoke insert, update on public.profiles from anon, authenticated;

-- Onboarding / InitialSetup は upsert（INSERT ... ON CONFLICT DO UPDATE）で
-- プロフィールを保存するため、同じ列に INSERT と UPDATE の双方が必要になる。
-- id を含むのはそのため。RLS の WITH CHECK が auth.uid() = id を強制するので、
-- 他人の id を指す行に書き換えることはできない。
grant insert (id, email, full_name, full_name_kana, phone_number, updated_at)
  on public.profiles to authenticated;

grant update (id, email, full_name, full_name_kana, phone_number, updated_at)
  on public.profiles to authenticated;

-- 意図的に authenticated へ渡さない列:
--   is_admin            管理者権限。付与は Supabase 側で直接行う
--   plan                プラン。stripe-webhook と admin-update-user-plan のみ
--   subscription_status / subscription_id / price_id / current_period_end
--                       Stripe の状態。stripe-webhook のみ
--   has_used_trial      トライアル再利用の防止。stripe-webhook のみ
--   stripe_customer_id  他人の顧客IDを指すと請求ポータルを乗っ取れる。
--                       create-checkout-session / create-portal-session が
--                       サービスロールで書く
--   created_at          作成時刻
