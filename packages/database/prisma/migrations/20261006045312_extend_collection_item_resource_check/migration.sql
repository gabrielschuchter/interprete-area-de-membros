BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "ContentCollectionItem"
  DROP CONSTRAINT "ContentCollectionItem_one_resource_check";

ALTER TABLE "ContentCollectionItem"
  ADD CONSTRAINT "ContentCollectionItem_one_resource_check"
  CHECK (
    (
      "itemType" = 'LESSON'
      AND "lessonId" IS NOT NULL
      AND "courseId" IS NULL
      AND "exerciseListId" IS NULL
      AND "assetId" IS NULL
      AND "recordingId" IS NULL
      AND "libraryItemId" IS NULL
    )
    OR (
      "itemType" = 'COURSE'
      AND "lessonId" IS NULL
      AND "courseId" IS NOT NULL
      AND "exerciseListId" IS NULL
      AND "assetId" IS NULL
      AND "recordingId" IS NULL
      AND "libraryItemId" IS NULL
    )
    OR (
      "itemType" = 'EXERCISE_LIST'
      AND "lessonId" IS NULL
      AND "courseId" IS NULL
      AND "exerciseListId" IS NOT NULL
      AND "assetId" IS NULL
      AND "recordingId" IS NULL
      AND "libraryItemId" IS NULL
    )
    OR (
      "itemType" = 'RECORDING'
      AND "lessonId" IS NULL
      AND "courseId" IS NULL
      AND "exerciseListId" IS NULL
      AND "libraryItemId" IS NULL
      AND (
        ("recordingId" IS NOT NULL AND "assetId" IS NULL)
        OR ("recordingId" IS NULL AND "assetId" IS NOT NULL)
      )
    )
    OR (
      "itemType" = 'LIBRARY_ITEM'
      AND "lessonId" IS NULL
      AND "courseId" IS NULL
      AND "exerciseListId" IS NULL
      AND "assetId" IS NULL
      AND "recordingId" IS NULL
      AND "libraryItemId" IS NOT NULL
    )
  );

COMMIT;
