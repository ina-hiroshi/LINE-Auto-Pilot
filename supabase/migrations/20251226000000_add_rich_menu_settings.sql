-- Add Rich Menu settings to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS rich_menu_template_id text DEFAULT 'standard_4',
ADD COLUMN IF NOT EXISTS rich_menu_custom_image_url text,
ADD COLUMN IF NOT EXISTS rich_menu_custom_json text;
