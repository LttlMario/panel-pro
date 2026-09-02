-- Security boundary hardening for the public client.
-- Sensitive state is accessed through Edge Functions with a validated panel
-- session; it must not be readable or writable directly from a browser.

BEGIN;

REVOKE CREATE ON SCHEMA public FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

REVOKE ALL ON TABLE public.panel_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.organization_vouchers FROM anon, authenticated;
REVOKE ALL ON TABLE public.organization_lifecycle_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_audit_log FROM anon, authenticated;

-- Keep the helper functions callable only by trusted server-side code.
REVOKE ALL ON FUNCTION public.consume_panel_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_panel_rate_limit(text, integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.consume_username_login_attempt(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_username_login_attempt(text, integer, integer) TO service_role;

COMMIT;
