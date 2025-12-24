-- Google Calendar Settings Table
CREATE TABLE IF NOT EXISTS google_calendar_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  calendar_id TEXT NOT NULL, -- The ID of the calendar to sync (e.g., 'primary')
  refresh_token TEXT NOT NULL, -- OAuth refresh token for offline access
  resource_id TEXT, -- Watch channel resource ID
  channel_id TEXT, -- Watch channel ID
  expiration BIGINT, -- Watch channel expiration timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add Google Calendar fields to reservations table
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS google_event_id TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'line' CHECK (source IN ('line', 'google', 'hotpepper', 'minimo', 'other'));

-- Enable RLS
ALTER TABLE google_calendar_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own calendar settings" ON google_calendar_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar settings" ON google_calendar_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar settings" ON google_calendar_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar settings" ON google_calendar_settings
  FOR DELETE USING (auth.uid() = user_id);
