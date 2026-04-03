-- 予約の LINE 完了通知・リマインド・連携トークン関連を削除（白紙に戻す）

drop table if exists public.line_messaging_link_tokens;

drop index if exists public.customers_store_messaging_uid_unique;

alter table public.customers
  drop column if exists line_messaging_user_id;

alter table public.reservations
  drop column if exists reminder_sent_at;

alter table public.stores
  drop column if exists booking_send_completion_message,
  drop column if exists booking_send_reminder,
  drop column if exists booking_reminder_days_before,
  drop column if exists booking_reminder_time;
