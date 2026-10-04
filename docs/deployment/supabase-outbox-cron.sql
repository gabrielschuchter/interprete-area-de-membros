-- Manual Supabase SQL Editor setup for the durable notification outbox.
-- References: https://supabase.com/docs/guides/database/extensions/pg_net
--             https://supabase.com/docs/guides/database/vault
-- First enable pg_cron and pg_net, then add these Vault secrets in the
-- Supabase Dashboard without putting their values in this repository:
--   interprete_member_outbox_url    = https://<api-production-host>/cron/outbox
--   interprete_member_outbox_secret = the API project's CRON_SECRET
-- The API endpoint validates this value as an exact Bearer secret.

DO $setup$
DECLARE
  outbox_url TEXT;
  outbox_secret TEXT;
  existing_job_id BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'Enable pg_cron before installing the outbox schedule.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'Enable pg_net before installing the outbox schedule.';
  END IF;

  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE EXCEPTION 'Enable Supabase Vault and create the two outbox secrets.';
  END IF;

  SELECT decrypted_secret
  INTO outbox_url
  FROM vault.decrypted_secrets
  WHERE name = 'interprete_member_outbox_url'
  LIMIT 1;

  SELECT decrypted_secret
  INTO outbox_secret
  FROM vault.decrypted_secrets
  WHERE name = 'interprete_member_outbox_secret'
  LIMIT 1;

  IF outbox_url IS NULL OR outbox_url !~ '^https://[^[:space:]]+/cron/outbox$' THEN
    RAISE EXCEPTION 'Set the Vault outbox URL to the HTTPS production /cron/outbox endpoint.';
  END IF;

  IF outbox_secret IS NULL OR length(outbox_secret) < 32 THEN
    RAISE EXCEPTION 'Set the Vault outbox secret to the API CRON_SECRET (at least 32 characters).';
  END IF;

  FOR existing_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'interprete-member-outbox'
  LOOP
    PERFORM cron.unschedule(existing_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'interprete-member-outbox',
    '* * * * *',
    $job$
      SELECT net.http_post(
        url := (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'interprete_member_outbox_url'
        ),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'interprete_member_outbox_secret'
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 10000
      );
    $job$
  );
END
$setup$;

SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'interprete-member-outbox';
