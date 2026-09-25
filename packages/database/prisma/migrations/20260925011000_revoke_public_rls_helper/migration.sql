-- PostgreSQL grants EXECUTE to PUBLIC by default for functions. Remove the
-- inherited privilege as well as the application-role privileges.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
