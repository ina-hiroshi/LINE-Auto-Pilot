-- Add missing Rich Menu columns to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS rich_menu_layout_id text DEFAULT 'large_4',
ADD COLUMN IF NOT EXISTS rich_menu_actions jsonb DEFAULT '{}'::jsonb;
