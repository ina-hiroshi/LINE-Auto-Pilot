-- Add slot background images column for rich menu
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS rich_menu_slot_images jsonb DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN stores.rich_menu_slot_images IS 'Per-slot background images for rich menu. Key is slot number, value is image URL.';
