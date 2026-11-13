-- CEDEAR ratios kept up to date from market prices. Each day the ratio implied by
-- (US price × CCL ÷ CEDEAR price in pesos) is averaged; it confirms the stored ratio, fills in
-- CEDEARs that had none, and replaces a ratio after a change (a split or a new program).

-- One row per symbol: keep the most recent if the original load repeated any.
delete from public.cedear_ratios a
using public.cedear_ratios b
where a.symbol = b.symbol and a.id < b.id;

alter table public.cedear_ratios
  add column if not exists source text not null default 'manual' check (source in ('manual', 'mercado')),
  add column if not exists implied_ratio real,
  add column if not exists implied_samples integer not null default 0,
  add column if not exists checked_at timestamptz,
  add column if not exists previous_ratio real,
  add column if not exists changed_at timestamptz;

create unique index if not exists cedear_ratios_symbol_key on public.cedear_ratios (symbol);

-- Ratios loaded by hand with the dividing direction inverted (0.2 instead of 5).
comment on column public.cedear_ratios.ratio is 'CEDEARs per underlying share (MELI 120 = 120 CEDEARs per share).';
comment on column public.cedear_ratios.source is 'manual: loaded from the issuer list; mercado: deduced from prices by cedear-ratios-sync.';

-- Daily after the local close (21:30 UTC = 18:30 in Buenos Aires), Monday to Friday.
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'cedear-ratios-sync';
  perform cron.schedule(
    'cedear-ratios-sync',
    '30 21 * * 1-5',
    $cron$
      select net.http_post(
        url := 'https://itgwuzzqcreoqjksegop.supabase.co/functions/v1/cedear-ratios-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'market_alerts_cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
    $cron$
  );
end $$;
