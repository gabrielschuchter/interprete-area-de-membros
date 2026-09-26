-- Complete the member-area product domains without touching existing content.
CREATE TYPE "MeetingKind" AS ENUM ('INDIVIDUAL', 'LESSON', 'GROUP', 'WORKSHOP', 'FEEDBACK', 'OTHER');

ALTER TABLE "ActivitySubmission"
  ADD COLUMN "attachmentPath" TEXT,
  ADD COLUMN "attachmentName" TEXT,
  ADD COLUMN "attachmentMimeType" TEXT,
  ADD COLUMN "attachmentSizeBytes" BIGINT;

ALTER TABLE "Meeting"
  ADD COLUMN "kind" "MeetingKind" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "demoKey" TEXT,
  ADD COLUMN "relatedActivityId" TEXT,
  ADD COLUMN "relatedLibraryItemId" TEXT;

ALTER TABLE "LibraryItem"
  ADD COLUMN "authors" TEXT,
  ADD COLUMN "year" INTEGER,
  ADD COLUMN "doi" TEXT,
  ADD COLUMN "storagePath" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "sizeBytes" BIGINT;

CREATE TABLE "ActivityAssignment" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3),
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivityAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LibraryBookmark" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LibraryBookmark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Meeting_demoKey_key" ON "Meeting"("demoKey");
CREATE INDEX "Meeting_relatedActivityId_idx" ON "Meeting"("relatedActivityId");
CREATE INDEX "Meeting_relatedLibraryItemId_idx" ON "Meeting"("relatedLibraryItemId");

CREATE INDEX "ActivityAssignment_memberId_dueAt_idx" ON "ActivityAssignment"("memberId", "dueAt");
CREATE INDEX "ActivityAssignment_activityId_dueAt_idx" ON "ActivityAssignment"("activityId", "dueAt");
CREATE UNIQUE INDEX "ActivityAssignment_activityId_memberId_key" ON "ActivityAssignment"("activityId", "memberId");

CREATE UNIQUE INDEX "LibraryBookmark_itemId_memberId_key" ON "LibraryBookmark"("itemId", "memberId");
CREATE INDEX "LibraryBookmark_memberId_createdAt_idx" ON "LibraryBookmark"("memberId", "createdAt");

ALTER TABLE "ActivityAssignment"
  ADD CONSTRAINT "ActivityAssignment_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ActivityAssignment_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LibraryBookmark"
  ADD CONSTRAINT "LibraryBookmark_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "LibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LibraryBookmark_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Meeting"
  ADD CONSTRAINT "Meeting_relatedActivityId_fkey"
  FOREIGN KEY ("relatedActivityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Meeting_relatedLibraryItemId_fkey"
  FOREIGN KEY ("relatedLibraryItemId") REFERENCES "LibraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
