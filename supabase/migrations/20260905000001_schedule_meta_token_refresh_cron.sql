-- meta-token-refresh を毎日 03:00 JST (18:00 UTC) に起動する。
-- Instagram は60日で失効し自動更新が必須、Facebook は debug_token での
-- スコープ・期限監視が必要なため（計画 0-4 節）。
--
-- x-cron-secret は social_cron_secret（20260903120736 で Vault に格納済み）を
-- そのまま使い回す。新しいシークレットを増やさない。
select cron.schedule(
  'meta-token-refresh-daily',
  '0 18 * * *', -- 03:00 JST
  $$
  select net.http_post(
    url := 'https://puzmemsawziykgzmbvyh.supabase.co/functions/v1/meta-token-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
