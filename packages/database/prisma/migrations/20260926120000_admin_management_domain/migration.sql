-- Additive admin-management fields and relationships. Existing content remains intact.
CREATE TYPE "ActivityDeliveryKind" AS ENUM ('TEXT', 'FILE', 'TEXT_AND_FILE');

ALTER TABLE "Course"
  ADD COLUMN "subtitle" TEXT,
  ADD COLUMN "format" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "level" TEXT,
  ADD COLUMN "durationMinutes" INTEGER,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "teacherId" TEXT;

ALTER TABLE "Module"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "objectives" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Lesson"
  ADD COLUMN "objectives" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Activity"
  ADD COLUMN "deliveryKind" "ActivityDeliveryKind" NOT NULL DEFAULT 'TEXT',
  ADD COLUMN "relatedLibraryItemId" TEXT;

ALTER TABLE "Meeting"
  ADD COLUMN "recurrenceRule" TEXT;

ALTER TABLE "LibraryItem"
  ADD COLUMN "pmid" TEXT,
  ADD COLUMN "lessonId" TEXT;

ALTER TABLE "CommunitySpace"
  ADD COLUMN "commentsClosed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CommunityPost"
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "featuredAt" TIMESTAMP(3);

CREATE TABLE "MeetingParticipant" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MeetingParticipant_meetingId_memberId_key"
  ON "MeetingParticipant"("meetingId", "memberId");
CREATE INDEX "MeetingParticipant_memberId_meetingId_idx"
  ON "MeetingParticipant"("memberId", "meetingId");

ALTER TABLE "MeetingParticipant"
  ADD CONSTRAINT "MeetingParticipant_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MeetingParticipant_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivitySubmission"
  ADD CONSTRAINT "ActivitySubmission_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CommunityPost_isFeatured_status_createdAt_idx"
  ON "CommunityPost"("isFeatured", "status", "createdAt");

CREATE INDEX "Activity_relatedLibraryItemId_idx"
  ON "Activity"("relatedLibraryItemId");
CREATE INDEX "LibraryItem_lessonId_idx"
  ON "LibraryItem"("lessonId");

ALTER TABLE "Activity"
  ADD CONSTRAINT "Activity_relatedLibraryItemId_fkey"
  FOREIGN KEY ("relatedLibraryItemId") REFERENCES "LibraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LibraryItem"
  ADD CONSTRAINT "LibraryItem_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
