CREATE TYPE "ExerciseQuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE');
CREATE TYPE "ExerciseSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

CREATE TABLE "ExerciseBank" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByMemberId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExerciseBank_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExerciseBank_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExerciseBank_slug_key" ON "ExerciseBank"("slug");
CREATE INDEX "ExerciseBank_status_title_idx" ON "ExerciseBank"("status", "title");

CREATE TABLE "ExerciseCategory" (
  "id" TEXT NOT NULL,
  "bankId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExerciseCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExerciseCategory_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "ExerciseBank"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExerciseCategory_bankId_slug_key" ON "ExerciseCategory"("bankId", "slug");
CREATE INDEX "ExerciseCategory_bankId_position_idx" ON "ExerciseCategory"("bankId", "position");

CREATE TABLE "ExerciseQuestion" (
  "id" TEXT NOT NULL,
  "bankId" TEXT NOT NULL,
  "categoryId" TEXT,
  "slug" TEXT NOT NULL,
  "type" "ExerciseQuestionType" NOT NULL,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "latestVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExerciseQuestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExerciseQuestion_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "ExerciseBank"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExerciseQuestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExerciseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ExerciseQuestion_latestVersion_positive_check" CHECK ("latestVersion" > 0)
);
CREATE UNIQUE INDEX "ExerciseQuestion_bankId_slug_key" ON "ExerciseQuestion"("bankId", "slug");
CREATE INDEX "ExerciseQuestion_bankId_status_categoryId_idx" ON "ExerciseQuestion"("bankId", "status", "categoryId");
CREATE INDEX "ExerciseQuestion_status_updatedAt_idx" ON "ExerciseQuestion"("status", "updatedAt");

CREATE TABLE "ExerciseQuestionVersion" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "statement" TEXT NOT NULL,
  "explanation" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExerciseQuestionVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExerciseQuestionVersion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExerciseQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExerciseQuestionVersion_version_positive_check" CHECK ("version" > 0)
);
CREATE UNIQUE INDEX "ExerciseQuestionVersion_questionId_version_key" ON "ExerciseQuestionVersion"("questionId", "version");
CREATE INDEX "ExerciseQuestionVersion_questionId_createdAt_idx" ON "ExerciseQuestionVersion"("questionId", "createdAt");

CREATE TABLE "ExerciseOption" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ExerciseOption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExerciseOption_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ExerciseQuestionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExerciseOption_versionId_label_key" ON "ExerciseOption"("versionId", "label");
CREATE UNIQUE INDEX "ExerciseOption_versionId_position_key" ON "ExerciseOption"("versionId", "position");
CREATE INDEX "ExerciseOption_versionId_isCorrect_idx" ON "ExerciseOption"("versionId", "isCorrect");

CREATE TABLE "ExerciseList" (
  "id" TEXT NOT NULL,
  "bankId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "coverUrl" TEXT,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdByMemberId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExerciseList_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExerciseList_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "ExerciseBank"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExerciseList_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExerciseList_slug_key" ON "ExerciseList"("slug");
CREATE INDEX "ExerciseList_status_position_publishedAt_idx" ON "ExerciseList"("status", "position", "publishedAt");
CREATE INDEX "ExerciseList_bankId_status_position_idx" ON "ExerciseList"("bankId", "status", "position");

CREATE TABLE "ExerciseListItem" (
  "id" TEXT NOT NULL,
  "listId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "questionVersionId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExerciseListItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExerciseListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ExerciseList"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExerciseListItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExerciseQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExerciseListItem_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "ExerciseQuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExerciseListItem_listId_position_key" ON "ExerciseListItem"("listId", "position");
CREATE UNIQUE INDEX "ExerciseListItem_listId_questionId_key" ON "ExerciseListItem"("listId", "questionId");
CREATE INDEX "ExerciseListItem_questionVersionId_idx" ON "ExerciseListItem"("questionVersionId");

CREATE TABLE "ExerciseSession" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "listId" TEXT NOT NULL,
  "status" "ExerciseSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "currentPosition" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExerciseSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExerciseSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExerciseSession_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ExerciseList"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExerciseSession_currentPosition_nonnegative_check" CHECK ("currentPosition" >= 0)
);
CREATE INDEX "ExerciseSession_memberId_status_updatedAt_idx" ON "ExerciseSession"("memberId", "status", "updatedAt");
CREATE INDEX "ExerciseSession_listId_status_idx" ON "ExerciseSession"("listId", "status");

CREATE TABLE "ExerciseSessionQuestion" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "questionVersionId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "ExerciseSessionQuestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExerciseSessionQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExerciseSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExerciseSessionQuestion_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "ExerciseQuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExerciseSessionQuestion_position_nonnegative_check" CHECK ("position" >= 0)
);
CREATE UNIQUE INDEX "ExerciseSessionQuestion_sessionId_position_key" ON "ExerciseSessionQuestion"("sessionId", "position");
CREATE UNIQUE INDEX "ExerciseSessionQuestion_sessionId_questionVersionId_key" ON "ExerciseSessionQuestion"("sessionId", "questionVersionId");
CREATE INDEX "ExerciseSessionQuestion_questionVersionId_idx" ON "ExerciseSessionQuestion"("questionVersionId");

CREATE TABLE "ExerciseAnswer" (
  "id" TEXT NOT NULL,
  "sessionQuestionId" TEXT NOT NULL,
  "selectedOptionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isCorrect" BOOLEAN NOT NULL,
  "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExerciseAnswer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExerciseAnswer_sessionQuestionId_fkey" FOREIGN KEY ("sessionQuestionId") REFERENCES "ExerciseSessionQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExerciseAnswer_sessionQuestionId_key" ON "ExerciseAnswer"("sessionQuestionId");

CREATE TABLE "ExerciseQuestionBookmark" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExerciseQuestionBookmark_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExerciseQuestionBookmark_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExerciseQuestionBookmark_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExerciseQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExerciseQuestionBookmark_memberId_questionId_key" ON "ExerciseQuestionBookmark"("memberId", "questionId");
CREATE INDEX "ExerciseQuestionBookmark_memberId_createdAt_idx" ON "ExerciseQuestionBookmark"("memberId", "createdAt");

ALTER TABLE "ExerciseBank" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExerciseCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExerciseQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExerciseQuestionVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExerciseOption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExerciseList" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExerciseListItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExerciseSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExerciseSessionQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExerciseAnswer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExerciseQuestionBookmark" ENABLE ROW LEVEL SECURITY;
