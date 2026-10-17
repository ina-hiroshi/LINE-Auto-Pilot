-- Supabase 無料枠の Egress とログの超過を抑えるため5分に戻す。
-- キーワード自動返信の待ちは最大で約6分（5分＋outbound-drain の1分）になる。
select cron.unschedule('social-dm-poll-every-minute');

select cron.schedule(
  'social-dm-poll-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://puzmemsawziykgzmbvyh.supabase.co/functions/v1/social-dm-poll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
