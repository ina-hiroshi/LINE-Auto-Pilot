-- pg_cron の実行ログ（cron.job_run_details）を7日分だけ残して毎日削除する。
--
-- pg_cron はログを自動で消さない。毎分のジョブ（cleanup-expired-holds、
-- social-outbound-drain-every-minute）が加わってから1日あたり数千行ずつ増え、
-- 2026-09-26 時点で約42万行・85MB と DB 容量の半分以上を占めていた。
-- 無料プランは 500MB に達すると止まるため、上限に向かって増え続けないようにする。
--
-- net._http_response は pg_net が pg_net.ttl（6時間）で自動削除するので対象外。
-- どちらも所有者が supabase_admin のため VACUUM FULL はできない。削除した分の
-- 領域はOSには返らず、autovacuum 後に新しいログで再利用される。
select cron.schedule(
  'cleanup-cron-job-run-details-daily',
  '30 18 * * *', -- 03:30 JST（DBバックアップの 03:00 JST と時間をずらす）
  $$
  delete from cron.job_run_details
  where start_time < now() - interval '7 days';
  $$
);
