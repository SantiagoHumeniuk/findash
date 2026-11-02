-- Schedules the market-alerts function. Run once, after deploying the function, with the same
-- value as its CRON_SECRET secret saved in Vault:
--   select vault.create_secret('<CRON_SECRET>', 'market_alerts_cron_secret');

select cron.schedule(
  'market-alerts-check',
  '*/10 * * * 1-5',
  $$
  select net.http_post(
    url := 'https://itgwuzzqcreoqjksegop.supabase.co/functions/v1/market-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'market_alerts_cron_secret')
    ),
    body := '{"job":"alerts"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- 08:00 to 09:45 in Argentina (UTC-3). Each run handles a batch; users already served are skipped.
select cron.schedule(
  'market-alerts-digest',
  '*/15 11-12 * * 1-5',
  $$
  select net.http_post(
    url := 'https://itgwuzzqcreoqjksegop.supabase.co/functions/v1/market-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'market_alerts_cron_secret')
    ),
    body := '{"job":"digest"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
