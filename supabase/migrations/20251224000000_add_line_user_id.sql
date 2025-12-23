alter table line_accounts 
add column if not exists line_user_id text;

-- Add index for faster lookup by line_user_id (used in webhook)
create index if not exists idx_line_accounts_line_user_id on line_accounts(line_user_id);
