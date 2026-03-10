-- ================================================
-- MIGRATION: Email notification infrastructure
-- Enables pg_cron and pg_net extensions, then
-- schedules the daily digest edge function.
-- ================================================

-- Enable pg_cron extension (allows cron jobs inside PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension (allows outbound HTTP calls from SQL)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ================================================
-- Schedule the daily digest at 8:00 PM Costa Rica time = 02:00 UTC
-- (Costa Rica is UTC-6 and has no DST)
--
-- IMPORTANT: Replace the three placeholder values before running:
--   <YOUR_PROJECT_REF>       -> your Supabase project ref (e.g. abcdefghijklmnop)
--   <YOUR_SERVICE_ROLE_KEY>  -> your project's service_role JWT
--   <YOUR_CRON_SECRET>       -> the same value set as the CRON_SECRET Supabase secret
-- ================================================

SELECT cron.schedule(
  'dimomat-daily-digest',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/daily-digest',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'Authorization',  'Bearer <YOUR_SERVICE_ROLE_KEY>',
      'x-cron-secret',  '<YOUR_CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- To verify the job was registered:
-- SELECT * FROM cron.job;

-- To manually trigger a test run (execute the body directly):
-- SELECT net.http_post(
--   url     := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/daily-digest',
--   headers := jsonb_build_object(
--     'Content-Type',  'application/json',
--     'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>',
--     'x-cron-secret', '<YOUR_CRON_SECRET>'
--   ),
--   body    := '{}'::jsonb
-- );

-- To remove the job if needed:
-- SELECT cron.unschedule('dimomat-daily-digest');
