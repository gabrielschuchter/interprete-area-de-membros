CREATE TYPE "public"."LessonAssetUploadStatus" AS ENUM (
    'PENDING',
    'READY',
    'COMPLETED',
    'CANCELLED',
    'EXPIRED',
    'FAILED'
);

CREATE TABLE "public"."LessonAssetUpload" (
    "id" TEXT NOT NULL,
    "actorId" VARCHAR(128) NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "lessonId" TEXT NOT NULL,
    "expectedAssetId" TEXT,
    "expectedAssetUpdatedAt" TIMESTAMP(3),
    "assetId" TEXT,
    "storagePath" TEXT NOT NULL,
    "originalFileName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(128) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "status" "public"."LessonAssetUploadStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "storageDeletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LessonAssetUpload_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LessonAssetUpload_lessonId_fkey"
        FOREIGN KEY ("lessonId") REFERENCES "public"."Lesson"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LessonAssetUpload_assetId_fkey"
        FOREIGN KEY ("assetId") REFERENCES "public"."LessonAsset"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LessonAssetUpload_storagePath_key"
    ON "public"."LessonAssetUpload"("storagePath");
CREATE UNIQUE INDEX "LessonAssetUpload_actorId_idempotencyKey_key"
    ON "public"."LessonAssetUpload"("actorId", "idempotencyKey");
CREATE INDEX "LessonAssetUpload_lessonId_status_createdAt_idx"
    ON "public"."LessonAssetUpload"("lessonId", "status", "createdAt");
CREATE INDEX "LessonAssetUpload_actorId_status_createdAt_idx"
    ON "public"."LessonAssetUpload"("actorId", "status", "createdAt");
CREATE INDEX "LessonAssetUpload_assetId_idx"
    ON "public"."LessonAssetUpload"("assetId");
CREATE INDEX "LessonAssetUpload_storageDeletedAt_status_expiresAt_idx"
    ON "public"."LessonAssetUpload"("storageDeletedAt", "status", "expiresAt");

ALTER TABLE "public"."LessonAssetUpload" ENABLE ROW LEVEL SECURITY;
