-- Presença agregada por hora para a meta coletiva (aditiva).
-- Rollback: DROP TABLE IF EXISTS "MemberPresenceHour";
CREATE TABLE IF NOT EXISTS "MemberPresenceHour" (
    "memberId" TEXT NOT NULL,
    "hourStart" TIMESTAMPTZ(6) NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "lastBeatAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "MemberPresenceHour_pkey" PRIMARY KEY ("memberId","hourStart")
);
CREATE INDEX IF NOT EXISTS "MemberPresenceHour_hourStart_idx" ON "MemberPresenceHour"("hourStart");
DO $$ BEGIN
  ALTER TABLE "MemberPresenceHour" ADD CONSTRAINT "MemberPresenceHour_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "MemberPresenceHour" ENABLE ROW LEVEL SECURITY;
