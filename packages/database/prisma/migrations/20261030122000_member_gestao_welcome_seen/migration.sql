-- Additive only. When the member dismissed the welcome message of the Gestão,
-- so it does not come back on another browser or device.
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "gestaoWelcomeSeenAt" TIMESTAMP(3);

-- Rollback (only with explicit approval, after confirming nothing reads it):
-- ALTER TABLE "Member" DROP COLUMN IF EXISTS "gestaoWelcomeSeenAt";
