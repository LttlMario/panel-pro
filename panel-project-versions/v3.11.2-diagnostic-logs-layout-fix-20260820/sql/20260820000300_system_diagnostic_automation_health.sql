-- Expune doar starea booleana necesara diagnosticului; valorile secrete nu sunt returnate.
CREATE OR REPLACE FUNCTION public.get_panel_automation_health()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron, vault, pg_temp
AS $$
  SELECT jsonb_build_object(
    'jobs', jsonb_build_object(
      'weekly_shift_report', EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'invoke-weekly-shift-report'
      ),
      'status_live', EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'invoke-status-live-sync'
      ),
      'organization_expiration', EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'invoke-organization-expiry-notifications'
      )
    ),
    'vault', jsonb_build_object(
      'project_url', EXISTS (
        SELECT 1 FROM vault.decrypted_secrets WHERE name = 'project_url' AND NULLIF(decrypted_secret, '') IS NOT NULL
      ),
      'publishable_key', EXISTS (
        SELECT 1 FROM vault.decrypted_secrets WHERE name = 'publishable_key' AND NULLIF(decrypted_secret, '') IS NOT NULL
      ),
      'cron_secret', EXISTS (
        SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret' AND NULLIF(decrypted_secret, '') IS NOT NULL
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_panel_automation_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_panel_automation_health() TO service_role;
