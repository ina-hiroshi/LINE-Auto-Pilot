-- 決済完了ステータス paid を CHECK 制約に追加
ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_status_check;
