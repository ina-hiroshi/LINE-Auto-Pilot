-- InboxPage の Realtime 購読用。CREATE TABLE と同一トランザクションにしない
-- （message_campaigns の前例踏襲）。
alter publication supabase_realtime add table public.social_messages;
alter publication supabase_realtime add table public.social_conversations;
