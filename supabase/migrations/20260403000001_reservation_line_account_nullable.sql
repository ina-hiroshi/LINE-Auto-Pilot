-- 手動予約で line_accounts が無い店舗でも登録できるよう NULL を許可
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND column_name = 'line_account_id'
  ) THEN
    ALTER TABLE public.reservations ALTER COLUMN line_account_id DROP NOT NULL;
  END IF;
END $$;
