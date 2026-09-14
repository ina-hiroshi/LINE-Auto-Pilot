-- sync-line-friend-count を毎日 07:00 JST (22:00 UTC 前日) に起動する。
-- LINEのInsight APIは「前日時点」のJST日付でしか確定値を返さないため、
-- 日付が変わってから数時間の余裕を見て叩く。
--
-- x-cron-secret は social_cron_secret（20260903120736 で Vault に格納済み）を
-- そのまま使い回す。新しいシークレットを増やさない（meta-token-refresh と同じ方針）。
select cron.schedule(
  'sync-line-friend-count-daily',
  '0 22 * * *', -- 07:00 JST
  $$
  select net.http_post(
    url := 'https://puzmemsawziykgzmbvyh.supabase.co/functions/v1/sync-line-friend-count',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
