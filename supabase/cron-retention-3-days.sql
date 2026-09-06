-- Panel Pro: păstrează istoricul pg_cron doar 3 zile.
-- Execută în Supabase SQL Editor.
-- Nu șterge joburile programate și nu modifică datele din schema public.

BEGIN;

DELETE FROM cron.job_run_details
WHERE start_time < now() - interval '3 days';

DO $schedule$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname IN ('panel-cron-retention-7-days', 'panel-cron-retention-3-days')
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'panel-cron-retention-3-days',
    '15 4 * * *',
    $cleanup$
      DELETE FROM cron.job_run_details
      WHERE start_time < now() - interval '3 days';
    $cleanup$
  );
END
$schedule$;

COMMIT;

SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'panel-cron-retention-3-days';
