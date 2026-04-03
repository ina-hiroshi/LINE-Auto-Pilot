-- 同一 store_id の重複を解消し、店舗あたり1行に制限する
-- canonical 行: store_id ごとに id 昇順で先頭（DISTINCT ON）

UPDATE public.reservations r
SET line_account_id = canon.keep_id
FROM public.line_accounts la
JOIN (
  SELECT DISTINCT ON (store_id) id AS keep_id, store_id
  FROM public.line_accounts
  ORDER BY store_id, id ASC
) canon ON canon.store_id = la.store_id
WHERE r.line_account_id = la.id
  AND la.id IS DISTINCT FROM canon.keep_id;

DELETE FROM public.line_accounts a
WHERE a.id NOT IN (
  SELECT keep_id
  FROM (
    SELECT DISTINCT ON (store_id) id AS keep_id
    FROM public.line_accounts
    ORDER BY store_id, id ASC
  ) sub
);

ALTER TABLE public.line_accounts
  ADD CONSTRAINT line_accounts_store_id_key UNIQUE (store_id);
