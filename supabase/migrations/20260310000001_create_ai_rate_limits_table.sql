-- AI応答のレート制限テーブル
-- ユーザー単位のクールダウンと店舗単位の時間あたり上限を管理
CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  line_user_id text NOT NULL,
  message_hash text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_rate_limits_user_lookup
  ON public.ai_rate_limits (store_id, line_user_id, created_at DESC);

CREATE INDEX idx_ai_rate_limits_store_hourly
  ON public.ai_rate_limits (store_id, created_at DESC);

-- 古いレコードを自動削除するため、24時間以上前のレコードを掃除する関数
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits() RETURNS void AS $$
BEGIN
  DELETE FROM public.ai_rate_limits
  WHERE created_at < now() - interval '2 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS: Edge Function は service_role_key で操作するため不要だが念のため
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on ai_rate_limits"
  ON public.ai_rate_limits
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.ai_rate_limits IS 'AI応答のレート制限。連投対策としてユーザー/店舗単位のスロットリングに使用';
