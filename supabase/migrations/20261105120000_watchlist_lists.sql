-- Watchlist items belong to a named list so users can group what they follow.

alter table public.watchlist
  add column if not exists list_name text not null default 'General'
  check (char_length(btrim(list_name)) between 1 and 40);
