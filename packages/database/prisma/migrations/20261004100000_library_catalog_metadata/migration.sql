CREATE TYPE "LibraryItemDifficulty" AS ENUM ('INTRODUCTORY', 'INTERMEDIATE', 'ADVANCED');

CREATE TYPE "LibraryItemAccessType" AS ENUM ('OPEN_ACCESS', 'FREE_TO_READ', 'FREE_TOOL');

ALTER TABLE "LibraryItem"
ADD COLUMN "catalogKey" TEXT,
ADD COLUMN "language" TEXT,
ADD COLUMN "difficulty" "LibraryItemDifficulty",
ADD COLUMN "accessType" "LibraryItemAccessType",
ADD COLUMN "accessNote" TEXT,
ADD COLUMN "version" TEXT,
ADD COLUMN "linkCheckedAt" TIMESTAMPTZ(6);

CREATE INDEX "LibraryItem_status_language_difficulty_idx"
ON "LibraryItem"("status", "language", "difficulty");

CREATE UNIQUE INDEX "LibraryItem_catalogKey_key"
ON "LibraryItem"("catalogKey");
