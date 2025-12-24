-- AI設定をstoresに追加
alter table public.stores add column if not exists is_ai_enabled boolean default false;

-- ログステータスの型定義
do $$ begin
    create type public.message_log_status as enum ('auto_replied', 'ai_replied', 'manual_reply_needed');
exception
    when duplicate_object then null;
end $$;

-- ログテーブル作成
create table if not exists public.customer_logs (
    id uuid not null default gen_random_uuid(),
    store_id uuid not null references public.stores(id) on delete cascade,
    line_user_id text not null, -- 顧客のLINE User ID
    display_name text, -- 顧客の表示名（取得できた場合）
    message_content text not null,
    reply_content text,
    status public.message_log_status not null default 'manual_reply_needed',
    created_at timestamptz default now(),
    primary key (id)
);

-- RLS設定
alter table public.customer_logs enable row level security;

create policy "Users can view their own store's logs"
    on public.customer_logs for select
    using (
        store_id in (
            select id from public.stores
            where owner_id = auth.uid()
        )
    );
