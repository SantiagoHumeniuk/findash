-- Updated plan prices and increased Plus/Premium usage limits.

create or replace function public.plan_limit(p_kind text, p_role text)
returns integer
language sql
immutable
as $$
  select case p_kind
    when 'watchlist' then case p_role when 'plus' then 150 when 'premium' then 500 when 'administrador' then 100000 else 5 end
    when 'api_calls' then case p_role when 'plus' then 150 when 'premium' then 500 when 'administrador' then 100000 else 5 end
    when 'portfolios' then case p_role when 'plus' then 10 when 'premium' then 30 when 'administrador' then 10000 else 1 end
    when 'alerts' then case p_role when 'plus' then 50 when 'premium' then 250 when 'administrador' then 10000 else 3 end
    when 'portfolio_assets' then case p_role when 'plus' then 10 when 'premium' then 25 when 'administrador' then 50 else 3 end
    else 0
  end;
$$;
