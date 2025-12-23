DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name = 'line_accounts' and column_name = 'channel_token')
  THEN
      ALTER TABLE "public"."line_accounts" RENAME COLUMN "channel_token" TO "channel_access_token";
  END IF;
END $$;

ALTER TABLE "public"."line_accounts" ADD COLUMN IF NOT EXISTS "channel_access_token" text;
