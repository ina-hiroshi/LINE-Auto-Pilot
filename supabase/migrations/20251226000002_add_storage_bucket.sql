-- Create storage bucket for rich menus
INSERT INTO storage.buckets (id, name, public)
VALUES ('rich_menus', 'rich_menus', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rich_menus');

-- Policy to allow public read
CREATE POLICY "Allow public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'rich_menus');

-- Policy to allow users to update/delete their own files (optional, simplified for now)
CREATE POLICY "Allow individual update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'rich_menus');
