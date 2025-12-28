-- Enable Realtime for points table
alter publication supabase_realtime add table points;

-- Allow public read access to points (for LIFF)
create policy "Public read access to points"
    on public.points for select
    to anon
    using (true);
