-- The event-trigger helper is used by PostgreSQL internally and must not be
-- callable by application-facing roles.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
