-- Live-first foundation hardening.
-- This migration is additive: it keeps every imported lesson, asset, source
-- key and Storage path intact while making the new recording relationships
-- explicit and constraining invalid ownership/playback states.

ALTER TABLE "ImportedRecording"
  ADD COLUMN "meetingId" TEXT;

ALTER TABLE "ContentCollectionItem"
  ADD COLUMN "recordingId" TEXT;

-- Existing collection rows from the compatibility model are upgraded to the
-- explicit recording relation when the asset already has an ImportedRecording
-- identity. The asset fallback remains available for old rows that cannot be
-- resolved without guessing.
UPDATE "ContentCollectionItem" AS item
SET
  "recordingId" = recording."id",
  "assetId" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ImportedRecording" AS recording
WHERE item."itemType" = 'RECORDING'
  AND item."assetId" = recording."assetId"
  AND item."recordingId" IS NULL;

ALTER TABLE "ImportedRecording"
  ADD CONSTRAINT "ImportedRecording_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContentCollectionItem"
  ADD CONSTRAINT "ContentCollectionItem_recordingId_fkey"
  FOREIGN KEY ("recordingId") REFERENCES "ImportedRecording"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ImportedRecording_meetingId_meetingDate_idx"
  ON "ImportedRecording"("meetingId", "meetingDate");

CREATE UNIQUE INDEX "ContentCollectionItem_collectionId_itemType_recordingId_key"
  ON "ContentCollectionItem"("collectionId", "itemType", "recordingId");

CREATE INDEX "ContentCollectionItem_itemType_recordingId_idx"
  ON "ContentCollectionItem"("itemType", "recordingId");

ALTER TABLE "ContentCollectionItem"
  DROP CONSTRAINT "ContentCollectionItem_one_resource_check";

ALTER TABLE "ContentCollectionItem"
  ADD CONSTRAINT "ContentCollectionItem_one_resource_check"
  CHECK (
    ("itemType" = 'LESSON' AND "lessonId" IS NOT NULL AND "assetId" IS NULL AND "recordingId" IS NULL AND "libraryItemId" IS NULL)
    OR ("itemType" = 'RECORDING' AND "lessonId" IS NULL AND "libraryItemId" IS NULL AND (("recordingId" IS NOT NULL AND "assetId" IS NULL) OR ("recordingId" IS NULL AND "assetId" IS NOT NULL)))
    OR ("itemType" = 'LIBRARY_ITEM' AND "lessonId" IS NULL AND "assetId" IS NULL AND "recordingId" IS NULL AND "libraryItemId" IS NOT NULL)
  );

ALTER TABLE "ImportedRecordingGroup"
  ADD CONSTRAINT "ImportedRecordingGroup_assignment_state_check"
  CHECK (
    "memberId" IS NULL
    OR ("assignedAt" IS NOT NULL AND "assignedByMemberId" IS NOT NULL)
  );

ALTER TABLE "PlaybackProgress"
  ADD CONSTRAINT "PlaybackProgress_position_bounds_check"
  CHECK (
    "positionSeconds" >= 0
    AND ("durationSeconds" IS NULL OR ("durationSeconds" >= 0 AND "positionSeconds" <= "durationSeconds"))
  );
