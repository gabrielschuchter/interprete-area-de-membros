-- Supabase defaults normally grant Data API roles broad privileges on new
-- public objects. Prisma migrations are created as the postgres role, so make
-- least privilege the default for every future table/function/sequence.
-- Any browser-facing object must be explicitly granted and protected by RLS.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
