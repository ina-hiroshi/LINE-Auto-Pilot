CREATE OR REPLACE FUNCTION get_store_plan(p_store_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id UUID;
  v_plan TEXT;
BEGIN
  SELECT owner_id INTO v_owner_id FROM public.stores WHERE id = p_store_id;
  IF v_owner_id IS NULL THEN
    RETURN 'free';
  END IF;
  
  SELECT plan INTO v_plan FROM public.profiles WHERE id = v_owner_id;
  RETURN COALESCE(v_plan, 'free');
END;
$$;

GRANT EXECUTE ON FUNCTION get_store_plan(UUID) TO anon, authenticated, service_role;
