COMMENT ON FUNCTION public.create_reservation_atomic(
  uuid,
  uuid,
  text,
  timestamptz,
  timestamptz,
  uuid,
  uuid,
  text,
  text,
  integer
) IS '予約作成のアトミック関数。quoted_amount は見込み金額（税込）。line_account_id は手動登録時に NULL 可。';
