-- line-webhook は body の destination（= Bot User ID）で line_accounts を引いて店舗を特定する。
-- 同じ公式アカウントが2店舗に登録されると maybeSingle が複数行エラーになり、
-- どちらの店舗のメッセージも処理できなくなるため、一意にする。
-- （NULL は接続前の状態なので重複を許す）
create unique index if not exists line_accounts_line_user_id_unique
  on public.line_accounts (line_user_id)
  where line_user_id is not null;
