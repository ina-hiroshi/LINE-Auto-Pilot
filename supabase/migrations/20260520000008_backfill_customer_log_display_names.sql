-- メッセージログの表示名を顧客マスタの本名に揃える（既存行のバックフィル）
UPDATE public.customer_logs cl
SET display_name = trim(c.real_name)
FROM public.customers c
WHERE cl.store_id = c.store_id
  AND c.real_name IS NOT NULL
  AND trim(c.real_name) <> ''
  AND (
    cl.line_user_id = c.line_user_id
    OR (cl.display_name IS NOT NULL AND cl.display_name = c.display_name)
    OR (cl.display_name IS NOT NULL AND cl.display_name = trim(c.real_name))
  )
  AND cl.display_name IS DISTINCT FROM trim(c.real_name);
