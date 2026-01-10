-- LINE BotのアイコンURLをキャッシュするためのカラムを追加
ALTER TABLE public.line_accounts 
ADD COLUMN IF NOT EXISTS bot_picture_url text;
