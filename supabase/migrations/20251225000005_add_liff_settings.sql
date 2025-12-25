-- Add LIFF settings to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS liff_template_id text DEFAULT 'simple',
ADD COLUMN IF NOT EXISTS liff_theme_color text,
ADD COLUMN IF NOT EXISTS liff_logo_url text;
