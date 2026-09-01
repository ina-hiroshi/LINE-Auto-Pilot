-- MembershipCard.tsx はテーマ（simple以外）・テーマカラー・ロゴ画像を
-- Proプラン限定機能としてUI側（opacity/pointer-events/disabled）でのみ
-- ロックしていた。実際に stores を更新する RLS ポリシーは
-- 「owner_id = auth.uid()」しか見ておらず、プランの確認は一切していない。
--
-- つまりFreeプランのユーザーでも、自分の有効なセッション（publicなanon key +
-- 自分のJWT）で直接 Supabase REST API を叩けば、UIを経由せずに
-- membership_card_template_id / color / logo_url をPro限定の値に
-- 書き換えてPro機能を無償で使える状態だった（決済迂回・課金ロジックの
-- バイパス）。
--
-- Free/未課金プランでの書き込み時は、常にデフォルト値（simpleテーマ・
-- デフォルトカラー・ロゴなし）に強制的にリセットするトリガーを追加し、
-- サーバー側でも paywall を強制する。

create or replace function public.enforce_membership_card_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
begin
  select plan into v_plan from public.profiles where id = new.owner_id;

  if v_plan is distinct from 'pro' and v_plan is distinct from 'executive' then
    new.membership_card_template_id := 'simple';
    new.membership_card_color := '#ffffff';
    new.membership_card_logo_url := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_membership_card_plan_limits on public.stores;
create trigger trg_enforce_membership_card_plan_limits
  before insert or update of membership_card_template_id, membership_card_color, membership_card_logo_url
  on public.stores
  for each row execute function public.enforce_membership_card_plan_limits();
