-- Expand existing content references without rewriting published content.
ALTER TYPE "LearningAssignmentTargetType" ADD VALUE IF NOT EXISTS 'RECORDING';
ALTER TYPE "CollectionItemType" ADD VALUE IF NOT EXISTS 'COURSE';
ALTER TYPE "CollectionItemType" ADD VALUE IF NOT EXISTS 'EXERCISE_LIST';

ALTER TABLE "ContentCollectionItem"
  ADD COLUMN "courseId" TEXT,
  ADD COLUMN "exerciseListId" TEXT;

ALTER TABLE "ContentCollectionItem"
  ADD CONSTRAINT "ContentCollectionItem_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ContentCollectionItem_exerciseListId_fkey"
    FOREIGN KEY ("exerciseListId") REFERENCES "ExerciseList"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ContentCollectionItem_collectionId_itemType_courseId_key"
  ON "ContentCollectionItem"("collectionId", "itemType", "courseId");
CREATE UNIQUE INDEX "ContentCollectionItem_collectionId_itemType_exerciseListId_key"
  ON "ContentCollectionItem"("collectionId", "itemType", "exerciseListId");
CREATE INDEX "ContentCollectionItem_itemType_courseId_idx"
  ON "ContentCollectionItem"("itemType", "courseId");
CREATE INDEX "ContentCollectionItem_itemType_exerciseListId_idx"
  ON "ContentCollectionItem"("itemType", "exerciseListId");

-- Freeze the answer interaction type with every immutable question version.
ALTER TABLE "ExerciseQuestionVersion"
  ADD COLUMN "type" "ExerciseQuestionType";

UPDATE "ExerciseQuestionVersion" AS version
SET "type" = question."type"
FROM "ExerciseQuestion" AS question
WHERE question."id" = version."questionId";

ALTER TABLE "ExerciseQuestionVersion"
  ALTER COLUMN "type" SET NOT NULL;
