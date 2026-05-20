-- 予約売上管理: 見込み金額・決済金額・決済完了ステータス
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS quoted_amount integer,
  ADD COLUMN IF NOT EXISTS paid_amount integer,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

COMMENT ON COLUMN public.reservations.quoted_amount IS '予約時見込み金額（税込・円）';
COMMENT ON COLUMN public.reservations.paid_amount IS '決済確定金額（税込・円）';
COMMENT ON COLUMN public.reservations.paid_at IS '決済完了日時';
COMMENT ON COLUMN public.reservations.status IS 'confirmed: 未決済, paid: 決済完了, cancelled: キャンセル, temporary: 仮押さえ';

CREATE INDEX IF NOT EXISTS idx_reservations_store_sales
  ON public.reservations (store_id, status, paid_at)
  WHERE status = 'paid';
