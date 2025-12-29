-- Enable users to update their own store's logs
create policy "Users can update their own store's logs"
    on public.customer_logs for update
    using (
        store_id in (
            select id from public.stores
            where owner_id = auth.uid()
        )
    );
