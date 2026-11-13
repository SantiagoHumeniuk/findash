-- Assets per portfolio (mirrors config.dashboard.maxTickersToCompare) checked in the database,
-- so CSV imports and direct inserts respect the plan too. Holdings already above the limit stay;
-- only new symbols are refused. Also lets the Edge Function give back a request that failed.

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
    when 'portfolio_assets' then case p_role when 'plus' then 5 when 'premium' then 10 when 'administrador' then 20 else 3 end
    else 0
  end;
$$;

-- Runs as the caller: users see their own transactions and profile.
create or replace function public.enforce_portfolio_assets_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  user_role text;
  allowed integer;
  held integer;
begin
  if current_user not in ('anon', 'authenticated') or new.transaction_type <> 'buy' then
    return new;
  end if;
  if exists (
    select 1 from transactions
    where user_id = new.user_id and portfolio_id is not distinct from new.portfolio_id and symbol = new.symbol
  ) then
    return new;
  end if;
  select coalesce(role, 'basico') into user_role from profiles where id = new.user_id;
  allowed := public.plan_limit('portfolio_assets', coalesce(user_role, 'basico'));
  select count(distinct symbol) into held from transactions
  where user_id = new.user_id and portfolio_id is not distinct from new.portfolio_id;
  if held >= allowed then
    raise exception 'Llegaste al límite de tu plan: % activos por portafolio.', allowed using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_portfolio_assets_limit on public.transactions;
create trigger enforce_portfolio_assets_limit before insert on public.transactions
  for each row execute function public.enforce_portfolio_assets_limit();

-- Gives back today's request when the rebuild it paid for failed.
create or replace function public.refund_api_call(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles
  set api_calls_made = greatest(coalesce(api_calls_made, 0) - 1, 0)
  where id = p_user and last_api_call_date = (now() at time zone 'utc')::date;
$$;
revoke all on function public.refund_api_call(uuid) from public, anon, authenticated;
grant execute on function public.refund_api_call(uuid) to service_role;
