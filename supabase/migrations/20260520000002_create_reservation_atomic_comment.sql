-- 旧シグネチャ（p_quoted_amount なし）を削除
DROP FUNCTION IF EXISTS public.create_reservation_atomic(
  uuid,
  uuid,
  text,
  timestamptz,
  timestamptz,
  uuid,
  uuid,
  text,
  text
);
