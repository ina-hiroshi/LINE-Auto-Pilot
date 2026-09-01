-- google-calendar-webhook は x-goog-channel-id ヘッダだけを頼りに
-- どの店舗のGoogleカレンダーを再同期するか決めていた。channel_id は
-- crypto.randomUUID() でクライアントに一切露出しないため実害は限定的
-- だが、Googleの公式ドキュメントも channel の token を設定し
-- X-Goog-Channel-Token を検証することを推奨しており、この検証が
-- 一切なかった（誰でもヘッダを詐称してリクエストを送れる状態）。
--
-- watch 開始時にサーバー側で乱数トークンを発行してこの列に保存し、
-- Webhook側で X-Goog-Channel-Token と一致するかを検証できるようにする。

alter table public.google_calendar_settings
  add column channel_token text;
