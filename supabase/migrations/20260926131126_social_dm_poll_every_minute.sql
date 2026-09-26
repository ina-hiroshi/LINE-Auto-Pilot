-- 投稿のCTAを「『モニター』とDM」にしたため、キーワード自動返信の待ち時間を縮める。
-- 5分間隔だと outbound-drain（毎分）と合わせて最大6分待たせるので、毎分に上げて
-- 最大2分程度にする。1回の実行で叩くのは IG/FB の /conversations 各1回
-- （会話が50件を超えない限り）なので、毎分でも Graph API の上限には十分余裕がある。
-- 数秒で返すには webhook（Metaアプリ審査が必要）への移行が要る。
select cron.unschedule('social-dm-poll-every-5-min');

select cron.schedule(
  'social-dm-poll-every-minute',
  '* * * * *',
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
