-- Add sync_token to google_calendar_settings for incremental sync
ALTER TABLE google_calendar_settings 
ADD COLUMN IF NOT EXISTS sync_token TEXT;
