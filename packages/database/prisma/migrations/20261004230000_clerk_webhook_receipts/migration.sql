-- Persist only Svix delivery identifiers so Clerk retries are idempotent.
-- The receipt is inserted in the same transaction as the member sync.
CREATE TABLE "ClerkWebhookReceipt" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClerkWebhookReceipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClerkWebhookReceipt_receivedAt_idx"
  ON "ClerkWebhookReceipt"("receivedAt");

ALTER TABLE "ClerkWebhookReceipt" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ClerkWebhookReceipt" FROM PUBLIC, anon, authenticated, service_role;
