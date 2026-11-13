-- The activity ping never saved a row: the REST API inserts with RETURNING, which also
-- needs a read policy. Users may read their own activity days.

drop policy if exists "Users can view their own activity" on public.user_activity;
create policy "Users can view their own activity" on public.user_activity
  for select using (auth.uid() = user_id);
