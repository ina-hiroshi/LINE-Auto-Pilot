-- Add updated_at column to stores table
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Reload schema cache just in case
NOTIFY pgrst, 'reload config';
