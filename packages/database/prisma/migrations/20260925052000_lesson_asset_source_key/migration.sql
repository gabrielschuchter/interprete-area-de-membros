DROP INDEX IF EXISTS "LessonAsset_sourcePlatform_sourceId_idx";

CREATE UNIQUE INDEX "LessonAsset_sourcePlatform_sourceId_key"
    ON "LessonAsset"("sourcePlatform", "sourceId");
