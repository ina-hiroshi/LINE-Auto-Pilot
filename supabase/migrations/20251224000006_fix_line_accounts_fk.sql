-- Add store_id column if it doesn't exist
ALTER TABLE "public"."line_accounts" 
ADD COLUMN IF NOT EXISTS "store_id" uuid;

-- Ensure store_id is a foreign key to stores(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'line_accounts_store_id_fkey'
    ) THEN
        ALTER TABLE "public"."line_accounts" 
        ADD CONSTRAINT "line_accounts_store_id_fkey" 
        FOREIGN KEY ("store_id") 
        REFERENCES "public"."stores" ("id") 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Force schema cache reload
NOTIFY pgrst, 'reload config';
