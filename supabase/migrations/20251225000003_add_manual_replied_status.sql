
-- Add 'manual_replied' to message_log_status enum
ALTER TYPE public.message_log_status ADD VALUE IF NOT EXISTS 'manual_replied';
