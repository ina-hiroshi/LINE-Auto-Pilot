-- Add unique constraint to google_event_id in reservations table
-- First, handle potential duplicates if any (optional, but good practice)
-- For now, we assume no duplicates or we just add the constraint.

ALTER TABLE reservations 
ADD CONSTRAINT reservations_google_event_id_key UNIQUE (google_event_id);
