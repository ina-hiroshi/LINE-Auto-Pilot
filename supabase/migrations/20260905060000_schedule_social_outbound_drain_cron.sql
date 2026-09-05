-- social-outbound-drain を毎分起動する。自動応答（キーワードルール）は
-- social-dm-poll がキューに積むだけで、実際の送信はここが担う。
-- 24h ウィンドウが送信直前に閉じる可能性があるため、社内向けの実配信は
-- ポーリング間隔（5分）より短い周期でドレインする。
select cron.schedule(
  'social-outbound-drain-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://puzmemsawziykgzmbvyh.supabase.co/functions/v1/social-outbound-drain',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
