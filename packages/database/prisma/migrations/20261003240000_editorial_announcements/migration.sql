CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'STAFF', 'SELECTED');

CREATE TABLE "Announcement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "href" TEXT,
  "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL',
  "recipientIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "createdByMemberId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Announcement_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Announcement_valid_period_check" CHECK ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" > "startsAt")
);

CREATE INDEX "Announcement_status_isPinned_publishedAt_idx" ON "Announcement"("status", "isPinned", "publishedAt");
CREATE INDEX "Announcement_startsAt_endsAt_idx" ON "Announcement"("startsAt", "endsAt");
CREATE INDEX "Announcement_createdByMemberId_createdAt_idx" ON "Announcement"("createdByMemberId", "createdAt");

ALTER TABLE "Announcement" ENABLE ROW LEVEL SECURITY;
