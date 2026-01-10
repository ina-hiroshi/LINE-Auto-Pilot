-- 予約作成のためのアトミック関数（レースコンディション対策）
-- PostgreSQL ADVISORY LOCKを使用して排他制御を実現

CREATE OR REPLACE FUNCTION create_reservation_atomic(
  p_store_id UUID,
  p_line_account_id UUID,
  p_line_user_id TEXT,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_staff_id UUID DEFAULT NULL,
  p_menu_id UUID DEFAULT NULL,
  p_memo TEXT DEFAULT '',
  p_registration_type TEXT DEFAULT 'line'
) RETURNS UUID AS $$
DECLARE
  lock_key BIGINT;
  v_count INT;
  v_reservation_id UUID;
  v_capacity_limit INT;
  v_store_settings RECORD;
BEGIN
  -- ロックキー生成（店舗ID + 開始時刻のハッシュ）
  -- 同じ時間帯の予約を排他的に処理するため
  lock_key := hashtext(p_store_id::text || p_start_time::text);
  PERFORM pg_advisory_xact_lock(lock_key);
  
  -- 店舗設定を取得
  SELECT slot_interval_minutes, capacity_per_slot, max_booking_days
  INTO v_store_settings
  FROM stores
  WHERE id = p_store_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Store not found';
  END IF;
  
  -- 容量制限の決定とチェック
  -- 注意: 担当者なしの場合の複雑なロジック（出勤スタッフ数、Googleカレンダー解析）は
  -- TypeScript側で事前にチェック済みであることを前提とする
  -- この関数では基本的な重複チェックと排他制御に焦点を当てる
  
  IF p_staff_id IS NOT NULL THEN
    -- 担当者指定あり → その担当者の予約数をチェック
    SELECT COUNT(*) INTO v_count
    FROM reservations
    WHERE store_id = p_store_id
      AND staff_id = p_staff_id
      AND status != 'cancelled'
      AND status != 'temporary'
      AND start_time < p_end_time
      AND end_time > p_start_time;
    
    -- 仮押さえもチェック
    SELECT v_count + COUNT(*) INTO v_count
    FROM temporary_holds
    WHERE store_id = p_store_id
      AND staff_id = p_staff_id
      AND expires_at > NOW()
      AND start_time < p_end_time
      AND end_time > p_start_time;
    
    -- 担当者指定の場合は1人まで
    IF v_count >= 1 THEN
      RAISE EXCEPTION 'この時間帯の予約枠が埋まっています';
    END IF;
  ELSE
    -- 担当者指定なし → TypeScript側で既に容量チェック済み
    -- ここでは基本的な重複チェックのみ（レースコンディション対策）
    -- 注意: このチェックは簡易的なもので、完全な容量チェックはTypeScript側で実施
    SELECT COUNT(*) INTO v_count
    FROM reservations
    WHERE store_id = p_store_id
      AND status != 'cancelled'
      AND status != 'temporary'
      AND start_time < p_end_time
      AND end_time > p_start_time
      AND staff_id IS NULL;
    
    -- 仮押さえもチェック
    SELECT v_count + COUNT(*) INTO v_count
    FROM temporary_holds
    WHERE store_id = p_store_id
      AND expires_at > NOW()
      AND start_time < p_end_time
      AND end_time > p_start_time
      AND staff_id IS NULL;
    
    -- 簡易的な上限チェック（TypeScript側でより詳細なチェック済み）
    v_capacity_limit := COALESCE(v_store_settings.capacity_per_slot, 10);
    IF v_count >= v_capacity_limit THEN
      RAISE EXCEPTION 'この時間帯の予約枠が埋まっています';
    END IF;
  END IF;
  
  -- 予約作成
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
    registration_type
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
    p_registration_type
  ) RETURNING id INTO v_reservation_id;
  
  RETURN v_reservation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- コメント
COMMENT ON FUNCTION create_reservation_atomic IS '予約作成のためのアトミック関数。レースコンディションを防ぐため、PostgreSQL ADVISORY LOCKを使用して排他制御を実現';
