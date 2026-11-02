-- Price alerts, in-app notifications and email preferences.
-- Users manage their own rows; only the market-alerts function (service role) creates notifications.

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol varchar(15) not null check (symbol ~ '^[A-Z0-9.^=-]{1,15}$'),
  condition text not null check (condition in ('above', 'below', 'move')),
  target numeric not null check (target > 0),
  active boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists price_alerts_active_idx on public.price_alerts (symbol) where active;
create index if not exists price_alerts_user_idx on public.price_alerts (user_id);

alter table public.price_alerts enable row level security;
create policy "Users can view their own alerts" on public.price_alerts
  for select using (auth.uid() = user_id);
create policy "Users can create their own alerts" on public.price_alerts
  for insert with check (auth.uid() = user_id);
create policy "Users can update their own alerts" on public.price_alerts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own alerts" on public.price_alerts
  for delete using (auth.uid() = user_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('alert', 'digest')),
  symbol varchar(15),
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "Users can view their own notifications" on public.notifications
  for select using (auth.uid() = user_id);
create policy "Users can update their own notifications" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own notifications" on public.notifications
  for delete using (auth.uid() = user_id);

create table if not exists public.alert_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_alerts boolean not null default true,
  -- The daily email is opt-in: nobody receives it without activating it.
  daily_digest boolean not null default false,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  last_digest_date date,
  updated_at timestamptz not null default now()
);

alter table public.alert_preferences enable row level security;
create policy "Users can view their own alert preferences" on public.alert_preferences
  for select using (auth.uid() = user_id);
create policy "Users can create their own alert preferences" on public.alert_preferences
  for insert with check (auth.uid() = user_id);
create policy "Users can update their own alert preferences" on public.alert_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
