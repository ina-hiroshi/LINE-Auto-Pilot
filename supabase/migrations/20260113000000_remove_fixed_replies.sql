-- Remove fixed_replies column from ai_settings table
-- This feature was never fully implemented and is being removed

ALTER TABLE public.ai_settings DROP COLUMN IF EXISTS fixed_replies;
