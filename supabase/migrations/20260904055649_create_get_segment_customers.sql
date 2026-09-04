-- 配信対象セグメントの解決。
--
-- 人数プレビューと実際の送信対象抽出の両方がこの関数を通る。フロントと
-- バックエンドで条件を書き分けると「プレビューは 40 名だったのに 52 名に
-- 届いた」といったズレが起きるため、判定はここに一本化する。
--
-- 「来店」の基準は顧客一覧（frontend/src/pages/Customers.tsx）の最終来店日
-- 算出と揃える: 過去の予約で、キャンセル済みを除いたもの。
-- ただし仮押さえ（status = 'temporary'）は除外する。仮押さえは LIFF の予約
-- フロー中に作られる一時レコードで、期限切れで放置された行が過去日付として
-- 残りうる。これを来店に数えると、実際には一度も来ていない相手に
-- 「ご来店ありがとうございました」を送ってしまう。
create or replace function public.get_segment_customers(
  p_store_id uuid,
  p_segment_type text,
  p_params jsonb default '{}'::jsonb
)
returns table (
  customer_id uuid,
  line_user_id text,
  display_name text,
  last_visit timestamptz,
  visit_count integer,
  total_paid bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with visits as (
    select
      r.line_user_id,
      r.start_time,
      r.menu_id,
      r.staff_id
    from public.reservations r
    where r.store_id = p_store_id
      and r.line_user_id is not null
      and r.start_time < now()
      -- status が NULL の行も除外される（NOT IN が NULL を返すため）。
      -- Customers.tsx の .neq('status','cancelled') と同じ挙動。
      and r.status not in ('cancelled', 'temporary')
  ),
  paid as (
    select
      r.line_user_id,
      sum(r.paid_amount)::bigint as total_paid
    from public.reservations r
    where r.store_id = p_store_id
      and r.line_user_id is not null
      and r.status = 'paid'
      and r.paid_amount is not null
    group by r.line_user_id
  ),
  agg as (
    select
      c.id as customer_id,
      c.line_user_id,
      coalesce(nullif(trim(c.real_name), ''), c.display_name) as display_name,
      max(v.start_time) as last_visit,
      count(v.start_time)::integer as visit_count,
      max(p.total_paid) as total_paid
    from public.customers c
    left join visits v on v.line_user_id = c.line_user_id
    left join paid p on p.line_user_id = c.line_user_id
    where c.store_id = p_store_id
      -- LINE の userId は必ず U で始まる。手動登録などで別形式の値が紛れ込むと、
      -- multicast は 400 を返し、同じバッチに入った最大 500 件が巻き添えで失敗する。
      and c.line_user_id like 'U%'
    group by c.id, c.line_user_id, c.real_name, c.display_name
  ),
  ranked as (
    select
      a.customer_id,
      row_number() over (order by a.total_paid desc) as spend_rank
    from agg a
    where a.total_paid is not null
      and a.total_paid > 0
  )
  select
    a.customer_id,
    a.line_user_id,
    a.display_name,
    a.last_visit,
    a.visit_count,
    a.total_paid
  from agg a
  left join ranked rk on rk.customer_id = a.customer_id
  where case p_segment_type
    when 'all' then true

    when 'visited' then a.visit_count > 0

    -- 初回来店前のお客様: 友だち登録済みだが来店実績なし
    when 'prospective' then a.visit_count = 0

    when 'dormant' then
      a.visit_count > 0
      and a.last_visit < now() - make_interval(days => coalesce((p_params->>'dormant_days')::integer, 60))

    when 'recent' then
      a.visit_count > 0
      and a.last_visit >= now() - make_interval(days => coalesce((p_params->>'recent_days')::integer, 30))

    -- 来店回数で絞る。max を渡せば「ちょうど1回（初回来店のみ）」も表現できる。
    when 'repeat' then
      a.visit_count >= coalesce((p_params->>'min_visit_count')::integer, 2)
      and a.visit_count <= coalesce((p_params->>'max_visit_count')::integer, 2147483647)

    when 'menu' then exists (
      select 1 from visits v
      where v.line_user_id = a.line_user_id
        and v.menu_id = (p_params->>'menu_id')::uuid
    )

    when 'staff' then exists (
      select 1 from visits v
      where v.line_user_id = a.line_user_id
        and v.staff_id = (p_params->>'staff_id')::uuid
    )

    when 'high_spender' then
      rk.spend_rank is not null
      and rk.spend_rank <= coalesce((p_params->>'top_n')::integer, 20)

    -- 個別選択。agg が store_id で絞られているので、他店舗の顧客 ID を
    -- 混ぜて渡されても対象にならない。
    when 'manual' then a.customer_id in (
      select value::uuid
      from jsonb_array_elements_text(coalesce(p_params->'customer_ids', '[]'::jsonb))
    )

    else false
  end
  order by a.last_visit desc nulls last;
end;
$$;

-- 呼び出し元の店舗所有権チェックは Edge Function 側で行う。この関数自体は
-- p_store_id を無条件に信用するため、認証済みユーザーから直接呼べてはならない。
revoke all on function public.get_segment_customers(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.get_segment_customers(uuid, text, jsonb) to service_role;
