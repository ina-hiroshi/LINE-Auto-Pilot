-- 既存行を削除・書き換えず、新規作成と更新に入力制約を適用する。
-- 既存の画面から保存された @ 付き ID も許可する。
ALTER TABLE public.setup_service_orders
  ADD CONSTRAINT setup_service_orders_basic_id_format
  CHECK (line_account_basic_id IS NULL OR line_account_basic_id = '' OR
    (length(line_account_basic_id) <= 51 AND line_account_basic_id ~ '^@?[A-Za-z0-9._-]{1,50}$'))
  NOT VALID;
