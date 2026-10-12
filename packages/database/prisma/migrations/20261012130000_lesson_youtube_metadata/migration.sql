-- Additive metadata for the Gestión YouTube lesson editor.
-- Existing LessonAsset rows are preserved and remain unverified until checked.
ALTER TABLE "LessonAsset"
  ADD COLUMN "youtubeSourceUrl" TEXT,
  ADD COLUMN "youtubeVideoTitle" TEXT,
  ADD COLUMN "youtubeThumbnailUrl" TEXT,
  ADD COLUMN "youtubePrivacyStatus" VARCHAR(16),
  ADD COLUMN "youtubeEmbeddable" BOOLEAN,
  ADD COLUMN "youtubeCaptionsAvailable" BOOLEAN,
  ADD COLUMN "youtubeVerificationStatus" VARCHAR(32),
  ADD COLUMN "youtubeCheckedAt" TIMESTAMP(3),
  ADD COLUMN "youtubeStartAtSeconds" INTEGER,
  ADD COLUMN "youtubeEndAtSeconds" INTEGER;
