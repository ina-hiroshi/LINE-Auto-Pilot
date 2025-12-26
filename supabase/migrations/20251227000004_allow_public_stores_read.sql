-- Allow public read access to stores table for booking page
CREATE POLICY "Public read access to stores" ON public.stores
  FOR SELECT
  TO anon
  USING (true);

-- Also allow authenticated users (like the owner) to read all stores (or just their own, but for booking page preview we might need it)
-- Actually, the existing policy likely covers owners. But we need to ensure 'anon' (unauthenticated LIFF users) can read.
-- Note: 'anon' role is used when using supabase-js without auth.

-- If there is an existing policy that conflicts or restricts, we might need to adjust.
-- Usually "Enable RLS" means "Deny all unless allowed".
-- So adding this policy should open it up.
