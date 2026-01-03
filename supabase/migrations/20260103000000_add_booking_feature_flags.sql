-- Add booking feature flags to stores table
-- These flags control which features are enabled on the booking page

ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS booking_enable_party_size boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS booking_enable_staff boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS booking_enable_menu boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.stores.booking_enable_party_size IS '予約時の人数選択機能の有効/無効';
COMMENT ON COLUMN public.stores.booking_enable_staff IS '予約時の担当者選択機能の有効/無効';
COMMENT ON COLUMN public.stores.booking_enable_menu IS '予約時のメニュー/コース選択機能の有効/無効';
