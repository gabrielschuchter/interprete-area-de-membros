-- Live-first domain layer. This migration is additive and preserves every
-- legacy course, lesson, asset, storage path and migration record.
CREATE TYPE "CourseExperience" AS ENUM ('ASYNC', 'RECORDING_ARCHIVE');
CREATE TYPE "ImportedRecordingGroupAssignmentAction" AS ENUM ('ASSIGNED', 'REASSIGNED', 'REVOKED');
CREATE TYPE "CollectionItemType" AS ENUM ('LESSON', 'RECORDING', 'LIBRARY_ITEM');
CREATE TYPE "HomeBlockType" AS ENUM ('NEXT_MEETING', 'PREPARATION', 'CONTINUE_WATCHING', 'PENDING_ACTIVITY', 'FEEDBACK', 'ASYNC_LEARNING', 'COMMUNITY', 'COLLECTION');

ALTER TABLE "Course"
  ADD COLUMN "experience" "CourseExperience" NOT NULL DEFAULT 'ASYNC';

CREATE TABLE "ImportedRecordingGroup" (
  "id" TEXT NOT NULL,
  "sourcePlatform" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "legacyStudentName" TEXT NOT NULL,
  "legacyStudentId" TEXT,
  "legacyModuleId" TEXT NOT NULL,
  "memberId" TEXT,
  "assignedAt" TIMESTAMP(3),
  "assignedByMemberId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportedRecordingGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportedRecording" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "legacyLessonId" TEXT NOT NULL,
  "sourcePlatform" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "originalTitle" TEXT,
  "meetingDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportedRecording_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportedRecordingGroupAssignment" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "previousMemberId" TEXT,
  "memberId" TEXT,
  "changedByMemberId" TEXT NOT NULL,
  "action" "ImportedRecordingGroupAssignmentAction" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportedRecordingGroupAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlaybackProgress" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "positionSeconds" INTEGER NOT NULL DEFAULT 0,
  "durationSeconds" INTEGER,
  "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedPlaybackAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlaybackProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductSetting" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedByMemberId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentCollection" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdByMemberId" TEXT,
  "updatedByMemberId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentCollection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentCollectionItem" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "itemType" "CollectionItemType" NOT NULL,
  "lessonId" TEXT,
  "assetId" TEXT,
  "libraryItemId" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentCollectionItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeBlockConfiguration" (
  "id" TEXT NOT NULL,
  "type" "HomeBlockType" NOT NULL,
  "title" TEXT,
  "subtitle" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "itemCount" INTEGER NOT NULL DEFAULT 4,
  "collectionId" TEXT,
  "createdByMemberId" TEXT,
  "updatedByMemberId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomeBlockConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportedRecordingGroup_sourcePlatform_sourceId_key"
  ON "ImportedRecordingGroup"("sourcePlatform", "sourceId");
CREATE UNIQUE INDEX "ImportedRecordingGroup_legacyModuleId_key"
  ON "ImportedRecordingGroup"("legacyModuleId");
CREATE INDEX "ImportedRecordingGroup_memberId_updatedAt_idx"
  ON "ImportedRecordingGroup"("memberId", "updatedAt");
CREATE INDEX "ImportedRecordingGroup_legacyStudentId_idx"
  ON "ImportedRecordingGroup"("legacyStudentId");

CREATE UNIQUE INDEX "ImportedRecording_assetId_key"
  ON "ImportedRecording"("assetId");
CREATE UNIQUE INDEX "ImportedRecording_sourcePlatform_sourceId_key"
  ON "ImportedRecording"("sourcePlatform", "sourceId");
CREATE INDEX "ImportedRecording_groupId_meetingDate_idx"
  ON "ImportedRecording"("groupId", "meetingDate");
CREATE INDEX "ImportedRecording_legacyLessonId_idx"
  ON "ImportedRecording"("legacyLessonId");

CREATE INDEX "ImportedRecordingGroupAssignment_groupId_createdAt_idx"
  ON "ImportedRecordingGroupAssignment"("groupId", "createdAt");
CREATE INDEX "ImportedRecordingGroupAssignment_memberId_createdAt_idx"
  ON "ImportedRecordingGroupAssignment"("memberId", "createdAt");

CREATE UNIQUE INDEX "PlaybackProgress_memberId_assetId_key"
  ON "PlaybackProgress"("memberId", "assetId");
CREATE INDEX "PlaybackProgress_memberId_lastViewedAt_idx"
  ON "PlaybackProgress"("memberId", "lastViewedAt");
CREATE INDEX "PlaybackProgress_assetId_lastViewedAt_idx"
  ON "PlaybackProgress"("assetId", "lastViewedAt");

CREATE UNIQUE INDEX "ProductSetting_key_key" ON "ProductSetting"("key");
CREATE INDEX "ProductSetting_updatedByMemberId_idx" ON "ProductSetting"("updatedByMemberId");

CREATE UNIQUE INDEX "ContentCollection_slug_key" ON "ContentCollection"("slug");
CREATE INDEX "ContentCollection_status_position_idx" ON "ContentCollection"("status", "position");
CREATE UNIQUE INDEX "ContentCollectionItem_collectionId_position_key" ON "ContentCollectionItem"("collectionId", "position");
CREATE INDEX "ContentCollectionItem_itemType_lessonId_idx" ON "ContentCollectionItem"("itemType", "lessonId");
CREATE INDEX "ContentCollectionItem_itemType_assetId_idx" ON "ContentCollectionItem"("itemType", "assetId");
CREATE INDEX "ContentCollectionItem_itemType_libraryItemId_idx" ON "ContentCollectionItem"("itemType", "libraryItemId");

CREATE UNIQUE INDEX "HomeBlockConfiguration_type_key" ON "HomeBlockConfiguration"("type");
CREATE INDEX "HomeBlockConfiguration_enabled_position_idx" ON "HomeBlockConfiguration"("enabled", "position");

ALTER TABLE "ImportedRecordingGroup"
  ADD CONSTRAINT "ImportedRecordingGroup_legacyStudentId_fkey"
    FOREIGN KEY ("legacyStudentId") REFERENCES "MigrationStudent"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ImportedRecordingGroup_legacyModuleId_fkey"
    FOREIGN KEY ("legacyModuleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ImportedRecordingGroup_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ImportedRecordingGroup_assignedByMemberId_fkey"
    FOREIGN KEY ("assignedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImportedRecording"
  ADD CONSTRAINT "ImportedRecording_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "ImportedRecordingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ImportedRecording_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "LessonAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ImportedRecording_legacyLessonId_fkey"
    FOREIGN KEY ("legacyLessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ImportedRecordingGroupAssignment"
  ADD CONSTRAINT "ImportedRecordingGroupAssignment_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "ImportedRecordingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ImportedRecordingGroupAssignment_previousMemberId_fkey"
    FOREIGN KEY ("previousMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ImportedRecordingGroupAssignment_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ImportedRecordingGroupAssignment_changedByMemberId_fkey"
    FOREIGN KEY ("changedByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlaybackProgress"
  ADD CONSTRAINT "PlaybackProgress_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PlaybackProgress_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "LessonAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductSetting"
  ADD CONSTRAINT "ProductSetting_updatedByMemberId_fkey"
    FOREIGN KEY ("updatedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContentCollection"
  ADD CONSTRAINT "ContentCollection_createdByMemberId_fkey"
    FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentCollection_updatedByMemberId_fkey"
    FOREIGN KEY ("updatedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContentCollectionItem"
  ADD CONSTRAINT "ContentCollectionItem_collectionId_fkey"
    FOREIGN KEY ("collectionId") REFERENCES "ContentCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentCollectionItem_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentCollectionItem_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "LessonAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentCollectionItem_libraryItemId_fkey"
    FOREIGN KEY ("libraryItemId") REFERENCES "LibraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HomeBlockConfiguration"
  ADD CONSTRAINT "HomeBlockConfiguration_collectionId_fkey"
    FOREIGN KEY ("collectionId") REFERENCES "ContentCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "HomeBlockConfiguration_createdByMemberId_fkey"
    FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "HomeBlockConfiguration_updatedByMemberId_fkey"
    FOREIGN KEY ("updatedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContentCollectionItem"
  ADD CONSTRAINT "ContentCollectionItem_one_resource_check"
  CHECK (
    ("itemType" = 'LESSON' AND "lessonId" IS NOT NULL AND "assetId" IS NULL AND "libraryItemId" IS NULL)
    OR ("itemType" = 'RECORDING' AND "lessonId" IS NULL AND "assetId" IS NOT NULL AND "libraryItemId" IS NULL)
    OR ("itemType" = 'LIBRARY_ITEM' AND "lessonId" IS NULL AND "assetId" IS NULL AND "libraryItemId" IS NOT NULL)
  );

-- Mark imported Kiwify courses as historical recording archives using the
-- existing source-of-truth MigrationRecord, never by title or fuzzy matching.
UPDATE "Course" AS course
SET "experience" = 'RECORDING_ARCHIVE'
WHERE EXISTS (
  SELECT 1
  FROM "MigrationRecord" AS migration
  WHERE migration."sourcePlatform" = 'KIWIFY'
    AND migration."entityType" = 'COURSE'
    AND migration."targetId" = course."id"
);

-- Build a deterministic semantic index over the current legacy hierarchy. No
-- ownership is inferred: all groups start unlinked and can only be assigned
-- through the authenticated admin workflow.
INSERT INTO "ImportedRecordingGroup" (
  "id", "sourcePlatform", "sourceId", "legacyStudentName", "legacyStudentId",
  "legacyModuleId", "createdAt", "updatedAt"
)
SELECT
  'kiwify-group-' || substr(md5(migration."sourcePlatform" || ':' || migration."sourceId"), 1, 24),
  migration."sourcePlatform",
  migration."sourceId",
  COALESCE(student."displayName", module."title"),
  student."id",
  module."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "MigrationRecord" AS migration
JOIN "Module" AS module ON module."id" = migration."targetId"
LEFT JOIN "MigrationStudent" AS student
  ON student."sourcePlatform" = migration."sourcePlatform"
 AND student."sourceId" = migration."metadata"->>'studentSourceId'
WHERE migration."sourcePlatform" = 'KIWIFY'
  AND migration."entityType" = 'MODULE'
ON CONFLICT ("sourcePlatform", "sourceId") DO UPDATE
SET "legacyStudentName" = EXCLUDED."legacyStudentName",
    "legacyStudentId" = EXCLUDED."legacyStudentId",
    "legacyModuleId" = EXCLUDED."legacyModuleId",
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ImportedRecording" (
  "id", "groupId", "assetId", "legacyLessonId", "sourcePlatform", "sourceId",
  "originalTitle", "createdAt", "updatedAt"
)
SELECT
  'kiwify-recording-' || substr(md5(asset."id"), 1, 24),
  group_recording."id",
  asset."id",
  asset."lessonId",
  asset."sourcePlatform",
  asset."sourceId",
  asset."originalTitle",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "LessonAsset" AS asset
JOIN "ImportedRecordingGroup" AS group_recording
  ON group_recording."legacyModuleId" = (
    SELECT lesson."moduleId" FROM "Lesson" AS lesson WHERE lesson."id" = asset."lessonId"
  )
WHERE asset."sourcePlatform" = 'KIWIFY'
  AND asset."sourceId" IS NOT NULL
ON CONFLICT ("assetId") DO UPDATE
SET "groupId" = EXCLUDED."groupId",
    "legacyLessonId" = EXCLUDED."legacyLessonId",
    "sourcePlatform" = EXCLUDED."sourcePlatform",
    "sourceId" = EXCLUDED."sourceId",
    "originalTitle" = EXCLUDED."originalTitle",
    "updatedAt" = CURRENT_TIMESTAMP;

ALTER TABLE "ImportedRecordingGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImportedRecording" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImportedRecordingGroupAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlaybackProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContentCollection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContentCollectionItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HomeBlockConfiguration" ENABLE ROW LEVEL SECURITY;
