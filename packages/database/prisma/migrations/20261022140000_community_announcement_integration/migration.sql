ALTER TYPE "AnnouncementAudience" ADD VALUE IF NOT EXISTS 'COHORT';

ALTER TABLE "Announcement"
  ADD COLUMN IF NOT EXISTS "isImportant" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "AnnouncementCohort" (
  "announcementId" TEXT NOT NULL,
  "cohortId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnnouncementCohort_pkey" PRIMARY KEY ("announcementId", "cohortId"),
  CONSTRAINT "AnnouncementCohort_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AnnouncementCohort_cohortId_fkey"
    FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AnnouncementCohort_cohortId_announcementId_idx"
  ON "AnnouncementCohort"("cohortId", "announcementId");

CREATE TABLE IF NOT EXISTS "AnnouncementDismissal" (
  "announcementId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "announcementVersion" INTEGER NOT NULL,
  "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnnouncementDismissal_pkey"
    PRIMARY KEY ("announcementId", "memberId", "announcementVersion"),
  CONSTRAINT "AnnouncementDismissal_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AnnouncementDismissal_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AnnouncementDismissal_version_check" CHECK ("announcementVersion" > 0)
);

CREATE INDEX IF NOT EXISTS "AnnouncementDismissal_memberId_dismissedAt_idx"
  ON "AnnouncementDismissal"("memberId", "dismissedAt");

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "announcementId" TEXT,
  ADD COLUMN IF NOT EXISTS "announcementVersion" INTEGER;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Notification_announcement_version_check"
    CHECK ("announcementVersion" IS NULL OR "announcementVersion" > 0);

CREATE INDEX IF NOT EXISTS "Notification_announcementId_announcementVersion_memberId_idx"
  ON "Notification"("announcementId", "announcementVersion", "memberId");

ALTER TABLE "AnnouncementCohort" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnnouncementDismissal" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."AnnouncementCohort" FROM anon, authenticated;
REVOKE ALL ON TABLE public."AnnouncementDismissal" FROM anon, authenticated;
