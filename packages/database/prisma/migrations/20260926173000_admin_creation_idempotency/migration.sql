ALTER TABLE "Activity"
    ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Activity_createdBy_idempotencyKey_key"
    ON "Activity"("createdBy", "idempotencyKey");

ALTER TABLE "Meeting"
    ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Meeting_teacherId_idempotencyKey_key"
    ON "Meeting"("teacherId", "idempotencyKey");

ALTER TABLE "LibraryItem"
    ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "LibraryItem_createdBy_idempotencyKey_key"
    ON "LibraryItem"("createdBy", "idempotencyKey");
