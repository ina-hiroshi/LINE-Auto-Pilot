-- 予約変更時: 旧予約を容量チェックから除外する
DROP FUNCTION IF EXISTS public.create_reservation_atomic(
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
);

CREATE OR REPLACE FUNCTION create_reservation_atomic(
  p_store_id UUID,
  p_line_account_id UUID,
  p_line_user_id TEXT,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_staff_id UUID DEFAULT NULL,
  p_menu_id UUID DEFAULT NULL,
  p_memo TEXT DEFAULT '',
  p_registration_type TEXT DEFAULT 'line',
  p_quoted_amount INTEGER DEFAULT NULL,
  p_exclude_reservation_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  lock_key BIGINT;
  v_count INT;
  v_reservation_id UUID;
  v_capacity_limit INT;
  v_store_settings RECORD;
BEGIN
  lock_key := hashtext(p_store_id::text || p_start_time::text);
  PERFORM pg_advisory_xact_lock(lock_key);

  SELECT slot_interval_minutes, capacity_per_slot, max_booking_days
  INTO v_store_settings
  FROM stores
  WHERE id = p_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Store not found';
  END IF;

  IF p_staff_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM reservations
    WHERE store_id = p_store_id
      AND staff_id = p_staff_id
      AND status != 'cancelled'
      AND status != 'temporary'
      AND start_time < p_end_time
      AND end_time > p_start_time
      AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id);

    SELECT v_count + COUNT(*) INTO v_count
    FROM temporary_holds
    WHERE store_id = p_store_id
      AND staff_id = p_staff_id
      AND expires_at > NOW()
      AND start_time < p_end_time
      AND end_time > p_start_time;

    IF v_count >= 1 THEN
      RAISE EXCEPTION 'この時間帯の予約枠が埋まっています';
    END IF;
  ELSE
    SELECT COUNT(*) INTO v_count
    FROM reservations
    WHERE store_id = p_store_id
      AND status != 'cancelled'
      AND status != 'temporary'
      AND start_time < p_end_time
      AND end_time > p_start_time
      AND staff_id IS NULL
      AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id);

    SELECT v_count + COUNT(*) INTO v_count
    FROM temporary_holds
    WHERE store_id = p_store_id
      AND expires_at > NOW()
      AND start_time < p_end_time
      AND end_time > p_start_time
      AND staff_id IS NULL;

    v_capacity_limit := COALESCE(v_store_settings.capacity_per_slot, 10);
    IF v_count >= v_capacity_limit THEN
      RAISE EXCEPTION 'この時間帯の予約枠が埋まっています';
    END IF;
  END IF;

  INSERT INTO reservations (
    store_id,
    line_account_id,
    line_user_id,
    reservation_datetime,
    start_time,
    end_time,
    status,
    memo,
    staff_id,
    menu_id,
    registration_type,
    quoted_amount
  ) VALUES (
    p_store_id,
    p_line_account_id,
    p_line_user_id,
    p_start_time,
    p_start_time,
    p_end_time,
    'confirmed',
    p_memo,
    p_staff_id,
    p_menu_id,
    p_registration_type,
    p_quoted_amount
  ) RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  integer,
  uuid
) IS '予約作成のアトミック関数。line_account_id は手動登録時に NULL 可。予約変更時は p_exclude_reservation_id で旧予約を容量チェックから除外。';
