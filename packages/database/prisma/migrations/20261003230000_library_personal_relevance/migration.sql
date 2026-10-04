CREATE TYPE "LibraryBookmarkTargetType" AS ENUM ('LIBRARY_ITEM', 'COURSE', 'MODULE', 'LESSON', 'ASSET');

ALTER TABLE "LibraryItem"
ADD COLUMN "coverUrl" TEXT;

ALTER TABLE "LibraryBookmark"
ALTER COLUMN "itemId" DROP NOT NULL,
ADD COLUMN "targetType" "LibraryBookmarkTargetType" NOT NULL DEFAULT 'LIBRARY_ITEM',
ADD COLUMN "courseId" TEXT,
ADD COLUMN "moduleId" TEXT,
ADD COLUMN "lessonId" TEXT,
ADD COLUMN "assetId" TEXT;

ALTER TABLE "LibraryBookmark"
ADD CONSTRAINT "LibraryBookmark_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "LibraryBookmark_moduleId_fkey"
FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "LibraryBookmark_lessonId_fkey"
FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "LibraryBookmark_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "LessonAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "LibraryBookmark_exactly_one_target_check"
CHECK (
  ("targetType" = 'LIBRARY_ITEM' AND "itemId" IS NOT NULL AND "courseId" IS NULL AND "moduleId" IS NULL AND "lessonId" IS NULL AND "assetId" IS NULL) OR
  ("targetType" = 'COURSE' AND "itemId" IS NULL AND "courseId" IS NOT NULL AND "moduleId" IS NULL AND "lessonId" IS NULL AND "assetId" IS NULL) OR
  ("targetType" = 'MODULE' AND "itemId" IS NULL AND "courseId" IS NULL AND "moduleId" IS NOT NULL AND "lessonId" IS NULL AND "assetId" IS NULL) OR
  ("targetType" = 'LESSON' AND "itemId" IS NULL AND "courseId" IS NULL AND "moduleId" IS NULL AND "lessonId" IS NOT NULL AND "assetId" IS NULL) OR
  ("targetType" = 'ASSET' AND "itemId" IS NULL AND "courseId" IS NULL AND "moduleId" IS NULL AND "lessonId" IS NULL AND "assetId" IS NOT NULL)
);

CREATE UNIQUE INDEX "LibraryBookmark_courseId_memberId_key" ON "LibraryBookmark"("courseId", "memberId");
CREATE UNIQUE INDEX "LibraryBookmark_moduleId_memberId_key" ON "LibraryBookmark"("moduleId", "memberId");
CREATE UNIQUE INDEX "LibraryBookmark_lessonId_memberId_key" ON "LibraryBookmark"("lessonId", "memberId");
CREATE UNIQUE INDEX "LibraryBookmark_assetId_memberId_key" ON "LibraryBookmark"("assetId", "memberId");
CREATE INDEX "LibraryBookmark_targetType_createdAt_idx" ON "LibraryBookmark"("targetType", "createdAt");

CREATE TABLE "LibraryItemView" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "openCount" INTEGER NOT NULL DEFAULT 1,
  "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LibraryItemView_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LibraryItemView_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LibraryItemView_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LibraryItemView_itemId_memberId_key" ON "LibraryItemView"("itemId", "memberId");
CREATE INDEX "LibraryItemView_itemId_lastViewedAt_idx" ON "LibraryItemView"("itemId", "lastViewedAt");
CREATE INDEX "LibraryItemView_memberId_lastViewedAt_idx" ON "LibraryItemView"("memberId", "lastViewedAt");

ALTER TABLE "LibraryItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LibraryBookmark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LibraryItemView" ENABLE ROW LEVEL SECURITY;
