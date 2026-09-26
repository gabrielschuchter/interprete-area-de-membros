-- The application performs business-data CRUD through Prisma on the server.
-- Keep the Supabase Data API denied by database grants as well as RLS.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Browser Realtime uses a short-lived authenticated JWT to subscribe only to
-- the current member's notifications. RLS on "Notification" remains the
-- row-level enforcement layer; SELECT is the only table privilege it needs.
GRANT SELECT ON TABLE public."Notification" TO authenticated;
