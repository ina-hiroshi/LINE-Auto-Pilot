-- 画面ごとの操作チュートリアル（スポットライト）の既読管理
--
-- 背景
--   各画面に「操作方法」ツアーを付け、初めて開いたときだけ自動で開始する。
--   既読をブラウザに持たせると、ログアウト時の localStorage.clear() で消えて
--   ログインのたびに再表示されてしまうため、profiles に持つ。
--
-- 形式
--   tutorial_progress = { "<tour_id>": <表示した版>, ... }
--   例: {"dashboard": 1, "reservations": 1}
--   ツアーの内容を大きく変えたときは版を上げ、もう一度自動表示させる。
--
-- 書き込み
--   profiles の列 GRANT は本人が編集してよい項目に絞ってある
--   (20260830000001_restrict_profiles_column_privileges.sql)。
--   この列もクライアントから直接は書かせず、RPC 経由だけにする。
--   RPC は自分の行の tutorial_progress に 1 キーだけ足す。

alter table public.profiles
  add column if not exists tutorial_progress jsonb not null default '{}'::jsonb;

create or replace function public.mark_tutorial_seen(p_tour_id text, p_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_tour_id is null or p_tour_id !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'invalid tour id' using errcode = '22023';
  end if;

  if p_version is null or p_version < 1 or p_version > 1000 then
    raise exception 'invalid version' using errcode = '22023';
  end if;

  -- 版は下げない（古いクライアントが新しい既読を巻き戻さないように）
  update public.profiles
     set tutorial_progress = tutorial_progress
       || jsonb_build_object(
            p_tour_id,
            greatest(p_version, coalesce((tutorial_progress ->> p_tour_id)::integer, 0))
          )
   where id = auth.uid();
end;
$$;

revoke all on function public.mark_tutorial_seen(text, integer) from public, anon;
grant execute on function public.mark_tutorial_seen(text, integer) to authenticated;
