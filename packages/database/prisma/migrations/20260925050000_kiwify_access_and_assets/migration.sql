CREATE TYPE "LessonAssetKind" AS ENUM ('VIDEO', 'PDF', 'IMAGE', 'AUDIO', 'FILE', 'OTHER');

CREATE TYPE "LessonAssetScope" AS ENUM ('GENERAL', 'INDIVIDUAL');

CREATE TYPE "AccessResourceType" AS ENUM ('COURSE', 'MODULE', 'LESSON', 'ASSET');

CREATE TYPE "AccessPermission" AS ENUM ('VIEW');

CREATE TYPE "MigrationEntityType" AS ENUM ('COURSE', 'MODULE', 'LESSON', 'ASSET', 'STUDENT');

CREATE TYPE "MigrationStatus" AS ENUM ('DISCOVERED', 'IMPORTED', 'AMBIGUOUS', 'FAILED');

CREATE TYPE "MigrationStudentMatchStatus" AS ENUM ('UNMATCHED', 'EXACT', 'AMBIGUOUS');

CREATE TABLE "LessonAsset" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "LessonAssetKind" NOT NULL,
    "scope" "LessonAssetScope" NOT NULL DEFAULT 'GENERAL',
    "storagePath" TEXT,
    "externalUrl" TEXT,
    "mimeType" TEXT,
    "sizeBytes" BIGINT,
    "durationSeconds" INTEGER,
    "checksum" TEXT,
    "sourcePlatform" TEXT,
    "sourceId" TEXT,
    "originalTitle" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "ownerMemberId" TEXT,
    "lessonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessGrant" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "resourceType" "AccessResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "permission" "AccessPermission" NOT NULL DEFAULT 'VIEW',
    "sourcePlatform" TEXT,
    "sourceId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MigrationRecord" (
    "id" TEXT NOT NULL,
    "sourcePlatform" TEXT NOT NULL,
    "entityType" "MigrationEntityType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT,
    "status" "MigrationStatus" NOT NULL DEFAULT 'DISCOVERED',
    "checksum" TEXT,
    "metadata" JSONB,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MigrationStudent" (
    "id" TEXT NOT NULL,
    "sourcePlatform" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "memberId" TEXT,
    "matchStatus" "MigrationStudentMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationStudent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LessonAsset_lessonId_position_key" ON "LessonAsset"("lessonId", "position");
CREATE INDEX "LessonAsset_lessonId_kind_position_idx" ON "LessonAsset"("lessonId", "kind", "position");
CREATE INDEX "LessonAsset_ownerMemberId_scope_idx" ON "LessonAsset"("ownerMemberId", "scope");
CREATE INDEX "LessonAsset_sourcePlatform_sourceId_idx" ON "LessonAsset"("sourcePlatform", "sourceId");

CREATE UNIQUE INDEX "AccessGrant_memberId_resourceType_resourceId_key" ON "AccessGrant"("memberId", "resourceType", "resourceId");
CREATE INDEX "AccessGrant_resourceType_resourceId_idx" ON "AccessGrant"("resourceType", "resourceId");
CREATE INDEX "AccessGrant_memberId_expiresAt_idx" ON "AccessGrant"("memberId", "expiresAt");

CREATE UNIQUE INDEX "MigrationRecord_sourcePlatform_entityType_sourceId_key" ON "MigrationRecord"("sourcePlatform", "entityType", "sourceId");
CREATE INDEX "MigrationRecord_status_sourcePlatform_idx" ON "MigrationRecord"("status", "sourcePlatform");
CREATE INDEX "MigrationRecord_targetId_idx" ON "MigrationRecord"("targetId");

CREATE UNIQUE INDEX "MigrationStudent_sourcePlatform_sourceId_key" ON "MigrationStudent"("sourcePlatform", "sourceId");
CREATE INDEX "MigrationStudent_email_idx" ON "MigrationStudent"("email");
CREATE INDEX "MigrationStudent_memberId_idx" ON "MigrationStudent"("memberId");
CREATE INDEX "MigrationStudent_matchStatus_idx" ON "MigrationStudent"("matchStatus");

ALTER TABLE "LessonAsset"
    ADD CONSTRAINT "LessonAsset_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LessonAsset"
    ADD CONSTRAINT "LessonAsset_ownerMemberId_fkey"
    FOREIGN KEY ("ownerMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccessGrant"
    ADD CONSTRAINT "AccessGrant_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MigrationStudent"
    ADD CONSTRAINT "MigrationStudent_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LessonAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccessGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MigrationRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MigrationStudent" ENABLE ROW LEVEL SECURITY;
