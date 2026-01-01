-- Remove subscription_status column from profiles table
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS subscription_status;
