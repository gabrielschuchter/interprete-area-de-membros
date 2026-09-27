ALTER TABLE "ImportedRecording"
  ADD COLUMN "thumbnailPath" TEXT,
  ADD COLUMN "thumbnailMimeType" TEXT,
  ADD COLUMN "thumbnailSizeBytes" INTEGER,
  ADD COLUMN "thumbnailWidth" INTEGER,
  ADD COLUMN "thumbnailHeight" INTEGER;
