-- Enable Realtime for reservations table
alter publication supabase_realtime add table reservations;

-- Update existing pending reservations to confirmed
update reservations set status = 'confirmed' where status = 'pending';
