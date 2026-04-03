# booking-reminders

予約リマインドを LINE プッシュで送る Edge Function。`CRON_SECRET` を `x-cron-secret` ヘッダで渡す。

## スケジュール（Supabase Dashboard）

1. Project Settings → Edge Functions → `booking-reminders` をデプロイ済みにする。
2. [Database → Cron](https://supabase.com/docs/guides/cron) または **Scheduled Functions** で 5 分ごとに HTTP POST を実行:
   - URL: `https://<project-ref>.supabase.co/functions/v1/booking-reminders`
   - Header: `x-cron-secret: <CRON_SECRET>`（`.env` の `CRON_SECRET` と同一）
   - Body: 空で可

ローカル: `supabase functions serve` 後に `curl -X POST http://127.0.0.1:54321/functions/v1/booking-reminders -H "x-cron-secret: ..."`
