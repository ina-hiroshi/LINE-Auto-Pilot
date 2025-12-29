-- Add 'resolved' to message_log_status enum
alter type public.message_log_status add value if not exists 'resolved';
