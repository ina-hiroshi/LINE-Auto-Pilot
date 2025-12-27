-- Add max_booking_days to stores table
ALTER TABLE stores ADD COLUMN max_booking_days INTEGER DEFAULT 60;
