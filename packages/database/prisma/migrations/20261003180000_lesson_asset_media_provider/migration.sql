CREATE TYPE "LessonAssetMediaProvider" AS ENUM (
  'STORAGE',
  'YOUTUBE',
  'EXTERNAL_URL'
);

ALTER TABLE "LessonAsset"
  ADD COLUMN "mediaProvider" "LessonAssetMediaProvider" NOT NULL DEFAULT 'STORAGE',
  ADD COLUMN "mediaExternalId" VARCHAR(64);

-- Preserve existing externally hosted media as generic URLs. Staff can move
-- each asset to YouTube explicitly after verifying its real video identifier.
UPDATE "LessonAsset"
SET "mediaProvider" = 'EXTERNAL_URL'
WHERE "externalUrl" IS NOT NULL AND btrim("externalUrl") <> '';

ALTER TABLE public."LessonAsset" ENABLE ROW LEVEL SECURITY;
