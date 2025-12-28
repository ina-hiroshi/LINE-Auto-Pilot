
-- Enable RLS on line_accounts
ALTER TABLE public.line_accounts ENABLE ROW LEVEL SECURITY;

-- Drop potentially insecure or outdated policies
DROP POLICY IF EXISTS "Users can view their own line accounts" ON public.line_accounts;
DROP POLICY IF EXISTS "Users can update their own line accounts" ON public.line_accounts;
DROP POLICY IF EXISTS "Users can insert their own line accounts" ON public.line_accounts;
DROP POLICY IF EXISTS "Users can delete their own line accounts" ON public.line_accounts;
DROP POLICY IF EXISTS "Public read access to line_accounts" ON public.line_accounts;

-- Create secure policy based on store ownership
-- Assuming line_accounts is linked to stores via store_id
CREATE POLICY "Users can manage their own line accounts" ON public.line_accounts
  USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
    )
  );
