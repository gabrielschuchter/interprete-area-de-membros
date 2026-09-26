-- Realtime must enforce the recipient policy when the notification table is
-- exposed to Supabase. Prisma continues to use the database connection for
-- trusted server-side writes.
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
