-- marketing-ads の sync_now を毎日 04:00 JST (19:00 UTC) に起動する。
-- ads_read スコープが未取得の間は関数側が {skipped:true} を返すだけで
-- 何もしない（計画 Phase 2）。再認可が済み次第、コードを触らずそのまま
-- 実データの取り込みが始まる。
select cron.schedule(
  'marketing-ads-sync-daily',
  '0 19 * * *', -- 04:00 JST
  $$
  select net.http_post(
    url := 'https://puzmemsawziykgzmbvyh.supabase.co/functions/v1/marketing-ads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')
    ),
    body := '{"action":"sync_now"}'::jsonb
  );
  $$
);
