-- First-party retention measurement: one row per user and active day, no third-party tracker.

create table if not exists public.user_activity (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  primary key (user_id, day)
);
create index if not exists user_activity_day_idx on public.user_activity (day);

alter table public.user_activity enable row level security;
create policy "Users can record their own activity" on public.user_activity
  for insert with check (auth.uid() = user_id);

-- Active users and retention of people who signed up since measuring began, for administrators only.
-- A user counts toward day N only once N days have passed since signing up.
create or replace function public.retention_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  started date;
  result jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'administrador') then
    raise exception 'not authorized';
  end if;

  select min(day) into started from user_activity;

  with cohort as (
    select id, (created_at at time zone 'utc')::date as signup
    from profiles
    where started is not null and (created_at at time zone 'utc')::date >= started
  ),
  retention as (
    select n,
      count(*) filter (where c.signup + n <= today) as eligible,
      count(*) filter (where c.signup + n <= today and exists (
        select 1 from user_activity a where a.user_id = c.id and a.day = c.signup + n
      )) as retained
    from unnest(array[1, 7, 30]) as n cross join cohort c
    group by n
  )
  select jsonb_build_object(
    'since', started,
    'totalUsers', (select count(*) from profiles),
    'newUsers30d', (select count(*) from profiles where created_at >= now() - interval '30 days'),
    'dau', (select count(*) from user_activity where day = today),
    'wau', (select count(distinct user_id) from user_activity where day > today - 7),
    'mau', (select count(distinct user_id) from user_activity where day > today - 30),
    'retention', coalesce((select jsonb_object_agg('d' || n, jsonb_build_object('eligible', eligible, 'retained', retained)) from retention), '{}'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.retention_metrics() from public, anon;
grant execute on function public.retention_metrics() to authenticated;
