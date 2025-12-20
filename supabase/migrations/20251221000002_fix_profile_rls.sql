-- Allow users to insert their own profile (needed for upsert if profile is missing)
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
