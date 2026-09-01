-- send-verification-code は同一メールアドレスへの連投は60秒クールダウンで
-- 防いでいたが、宛先メールアドレスを変えながら連投されると際限なく
-- Resend経由でメールを送りつけられてしまう（コスト濫用・スパム踏み台）。
-- 送信元IPアドレスも記録し、同一IPからの単位時間あたりの送信数を
-- 制限できるようにする。

alter table public.verification_codes
  add column request_ip text;

create index if not exists idx_verification_codes_request_ip_created_at
  on public.verification_codes (request_ip, created_at);
