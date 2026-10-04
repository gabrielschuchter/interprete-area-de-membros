-- Expand-only foundation for durable member-domain events and identity tombstones.
ALTER TABLE "Member"
  ADD COLUMN "deactivatedAt" TIMESTAMP(3);

CREATE TYPE "OutboxJobStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'RETRY',
  'SUCCEEDED',
  'DEAD'
);

CREATE TABLE "DomainEvent" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "actorId" TEXT,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutboxJob" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "consumerKey" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" "OutboxJobStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutboxJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DomainEvent_idempotencyKey_key"
  ON "DomainEvent"("idempotencyKey");
CREATE INDEX "DomainEvent_aggregateType_aggregateId_createdAt_idx"
  ON "DomainEvent"("aggregateType", "aggregateId", "createdAt");
CREATE INDEX "DomainEvent_eventType_createdAt_idx"
  ON "DomainEvent"("eventType", "createdAt");
CREATE UNIQUE INDEX "OutboxJob_idempotencyKey_key"
  ON "OutboxJob"("idempotencyKey");
CREATE UNIQUE INDEX "OutboxJob_eventId_consumerKey_key"
  ON "OutboxJob"("eventId", "consumerKey");
CREATE INDEX "OutboxJob_status_availableAt_createdAt_idx"
  ON "OutboxJob"("status", "availableAt", "createdAt");
CREATE INDEX "OutboxJob_status_leaseExpiresAt_idx"
  ON "OutboxJob"("status", "leaseExpiresAt");

ALTER TABLE "OutboxJob"
  ADD CONSTRAINT "OutboxJob_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "DomainEvent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma is the only application data path. RLS blocks direct client access.
ALTER TABLE "DomainEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OutboxJob" ENABLE ROW LEVEL SECURITY;
