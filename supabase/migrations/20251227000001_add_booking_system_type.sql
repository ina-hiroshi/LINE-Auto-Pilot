-- Add booking_system_type to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS booking_system_type text DEFAULT 'generic'; -- generic, salon, restaurant
