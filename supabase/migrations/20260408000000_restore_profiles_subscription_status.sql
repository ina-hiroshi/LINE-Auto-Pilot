-- profiles.subscription_status は 20251231000001 で削除されたが、
-- PlanSettings・stripe-webhook 等が引き続き参照しているため列を復元する。
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free';

COMMENT ON COLUMN public.profiles.subscription_status IS
  'Stripe のサブスクリプション状態 (active, trialing, canceled 等)。Webhook で更新。';
