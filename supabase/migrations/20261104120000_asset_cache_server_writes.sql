-- The shared cache is written only by Edge Functions (service role). Any signed-in
-- user could previously overwrite what everyone else sees.

drop policy if exists "Enable insert for authenticated users only" on public.asset_data_cache;
drop policy if exists "Enable update for authenticated users only" on public.asset_data_cache;
