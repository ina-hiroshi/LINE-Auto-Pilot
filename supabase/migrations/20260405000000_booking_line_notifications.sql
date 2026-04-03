-- LINE 予約完了・リマインド通知の店舗設定とリマインド送信済みフラグ

alter table public.stores
  add column if not exists booking_send_completion_message boolean not null default true,
  add column if not exists booking_send_reminder boolean not null default false,
  add column if not exists booking_reminder_days_before integer not null default 1,
  add column if not exists booking_reminder_time text not null default '18:00';

comment on column public.stores.booking_send_completion_message is '予約作成・変更確定時に LINE プッシュで完了通知を送る';
comment on column public.stores.booking_send_reminder is 'リマインド通知を送る';
comment on column public.stores.booking_reminder_days_before is '予約日(JST)の何日前に送るか。0=当日';
comment on column public.stores.booking_reminder_time is '送信時刻 HH:mm (JST)';

alter table public.reservations
  add column if not exists reminder_sent_at timestamptz;

comment on column public.reservations.reminder_sent_at is 'リマインド LINE 送信済み時刻';
