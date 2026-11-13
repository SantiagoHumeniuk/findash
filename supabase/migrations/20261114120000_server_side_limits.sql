-- Plan expiry, plan limits and the daily request counter enforced by the database, so they no
-- longer depend on the browser; plus a daily cleanup of the shared cache.

-- ---------------------------------------------------------------------------
-- Plan expiry: a plan bought by transfer lasts 30 days from its approval.
-- Plans granted by hand (no approved request) are left alone.
-- ---------------------------------------------------------------------------
create or replace function public.expire_plan_of(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
  last_approved timestamptz;
begin
  select role into user_role from profiles where id = p_user;
  if user_role not in ('plus', 'premium') then
    return false;
  end if;
  select max(reviewed_at) into last_approved
  from subscription_requests
  where user_id = p_user and status = 'approved' and plan = user_role;
  if last_approved is null or last_approved + interval '30 days' > now() then
    return false;
  end if;
  update profiles set role = 'basico' where id = p_user;
  return true;
end;
$$;
revoke all on function public.expire_plan_of(uuid) from public, anon, authenticated;

-- Called by the app when a paid user opens it.
create or replace function public.expire_subscription_if_due()
returns boolean
language sql
security definer
set search_path = public
as $$
  select case when auth.uid() is null then false else public.expire_plan_of(auth.uid()) end;
$$;
revoke all on function public.expire_subscription_if_due() from public, anon;
grant execute on function public.expire_subscription_if_due() to authenticated;

-- Daily sweep, so limits and emails also stop for users who never come back.
create or replace function public.expire_due_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired integer := 0;
  candidate uuid;
begin
  for candidate in select id from profiles where role in ('plus', 'premium') loop
    if public.expire_plan_of(candidate) then
      expired := expired + 1;
    end if;
  end loop;
  return expired;
end;
$$;
revoke all on function public.expire_due_subscriptions() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Payment requests: users create pending requests and may only mark the approval
-- notice as seen; status, plan and review fields belong to administrators.
-- ---------------------------------------------------------------------------
create or replace function public.protect_subscription_requests()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.admin_notes := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.user_notified_at := null;
    return new;
  end if;
  if (to_jsonb(new) - 'user_notified_at' - 'updated_at') is distinct from (to_jsonb(old) - 'user_notified_at' - 'updated_at') then
    raise exception 'Solo un administrador puede modificar una solicitud de pago.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_subscription_requests on public.subscription_requests;
create trigger protect_subscription_requests
  before insert or update on public.subscription_requests
  for each row execute function public.protect_subscription_requests();

-- ---------------------------------------------------------------------------
-- Plan limits (mirror public/config.json → plans).
-- ---------------------------------------------------------------------------
create or replace function public.plan_limit(p_kind text, p_role text)
returns integer
language sql
immutable
as $$
  select case p_kind
    when 'watchlist' then case p_role when 'plus' then 25 when 'premium' then 50 when 'administrador' then 100000 else 5 end
    when 'api_calls' then case p_role when 'plus' then 25 when 'premium' then 50 when 'administrador' then 100000 else 5 end
    when 'portfolios' then case p_role when 'plus' then 5 when 'premium' then 10 when 'administrador' then 10000 else 1 end
    when 'alerts' then case p_role when 'plus' then 20 when 'premium' then 100 when 'administrador' then 10000 else 3 end
    else 0
  end;
$$;

-- Runs as the caller: users see their own rows and profile, which is all it counts.
create or replace function public.enforce_plan_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  kind text := tg_argv[0];
  user_role text;
  used integer;
  allowed integer;
  label text;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  select coalesce(role, 'basico') into user_role from profiles where id = new.user_id;
  allowed := public.plan_limit(kind, coalesce(user_role, 'basico'));
  if kind = 'watchlist' then
    select count(*) into used from watchlist where user_id = new.user_id;
    label := 'activos en tu watchlist';
  elsif kind = 'portfolios' then
    select count(*) into used from portfolios where user_id = new.user_id;
    label := 'portafolios';
  elsif kind = 'alerts' then
    if not coalesce(new.active, true) then
      return new;
    end if;
    select count(*) into used from price_alerts where user_id = new.user_id and active and id is distinct from new.id;
    label := 'alertas activas';
  end if;
  if used >= allowed then
    raise exception 'Llegaste al límite de tu plan: % %.', allowed, label using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_watchlist_limit on public.watchlist;
create trigger enforce_watchlist_limit before insert on public.watchlist
  for each row execute function public.enforce_plan_limit('watchlist');
drop trigger if exists enforce_portfolio_limit on public.portfolios;
create trigger enforce_portfolio_limit before insert on public.portfolios
  for each row execute function public.enforce_plan_limit('portfolios');
drop trigger if exists enforce_alert_limit on public.price_alerts;
create trigger enforce_alert_limit before insert or update of active on public.price_alerts
  for each row execute function public.enforce_plan_limit('alerts');

-- ---------------------------------------------------------------------------
-- Daily request counter: only the Edge Function (service role) spends requests.
-- ---------------------------------------------------------------------------
create or replace function public.consume_api_call(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  allowed integer;
  used integer;
begin
  select public.plan_limit('api_calls', coalesce(role, 'basico')),
         case when last_api_call_date = today then coalesce(api_calls_made, 0) else 0 end
    into allowed, used
  from profiles where id = p_user for update;
  if allowed is null then
    return false;
  end if;
  if used >= allowed then
    return false;
  end if;
  update profiles set api_calls_made = used + 1, last_api_call_date = today where id = p_user;
  return true;
end;
$$;
revoke all on function public.consume_api_call(uuid) from public, anon, authenticated;
grant execute on function public.consume_api_call(uuid) to service_role;

-- Users can no longer reset their own counter.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'basico';
    new.can_upload_blog := false;
    new.api_calls_made := 0;
    return new;
  end if;
  if new.role is distinct from old.role
    or new.can_upload_blog is distinct from old.can_upload_blog
    or new.email is distinct from old.email
    or new.id is distinct from old.id
    or new.api_key is distinct from old.api_key
    or new.api_calls_made is distinct from old.api_calls_made
    or new.last_api_call_date is distinct from old.last_api_call_date
  then
    raise exception 'No podés modificar el plan, los permisos ni el contador de tu cuenta.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cache cleanup: raw Yahoo responses expire within a day, and rows in the format
-- used before the Yahoo migration are no longer read by the app.
-- ---------------------------------------------------------------------------
create or replace function public.clean_asset_cache()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from asset_data_cache
  where (symbol like 'yahoo:%' and last_updated_at < now() - interval '3 days')
     or (symbol not like 'yahoo:%'
         and coalesce(data ->> 'dataSource', '') <> 'Yahoo Finance'
         and jsonb_typeof(data) = 'object'
         and data ? 'profile'
         and last_updated_at < now() - interval '30 days');
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.clean_asset_cache() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('expire-subscriptions', 'clean-asset-cache');
  perform cron.schedule('expire-subscriptions', '15 3 * * *', 'select public.expire_due_subscriptions()');
  perform cron.schedule('clean-asset-cache', '30 3 * * *', 'select public.clean_asset_cache()');
end $$;
