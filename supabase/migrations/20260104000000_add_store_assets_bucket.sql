-- Create storage bucket for store assets (logos, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload to their store folder
CREATE POLICY "Allow authenticated uploads to store-assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'store-assets');

-- Policy to allow public read for store assets
CREATE POLICY "Allow public read store-assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'store-assets');

-- Policy to allow authenticated users to update their files
CREATE POLICY "Allow authenticated update store-assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'store-assets');

-- Policy to allow authenticated users to delete their files
CREATE POLICY "Allow authenticated delete store-assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'store-assets');
