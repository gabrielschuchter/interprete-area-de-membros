CREATE TYPE "StudyCampaignRenewalMode" AS ENUM ('AUTOMATIC', 'MANUAL');

ALTER TABLE "Profile"
  ADD COLUMN "showInCommunityAvatars" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "StudyCampaign"
  ADD COLUMN "renewalMode" "StudyCampaignRenewalMode" NOT NULL DEFAULT 'MANUAL';

CREATE TABLE "StudyCampaignSnapshot" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "periodStartsAt" TIMESTAMP(3) NOT NULL,
  "periodEndsAt" TIMESTAMP(3) NOT NULL,
  "targetMinutes" INTEGER NOT NULL,
  "totalSeconds" BIGINT NOT NULL,
  "sourceKinds" "StudyActivityKind"[] NOT NULL DEFAULT ARRAY[]::"StudyActivityKind"[],
  "snapshottedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudyCampaignSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyCampaignSnapshot_period_check" CHECK ("periodEndsAt" > "periodStartsAt"),
  CONSTRAINT "StudyCampaignSnapshot_targetMinutes_check" CHECK ("targetMinutes" > 0),
  CONSTRAINT "StudyCampaignSnapshot_totalSeconds_check" CHECK ("totalSeconds" >= 0),
  CONSTRAINT "StudyCampaignSnapshot_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "StudyCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StudyCampaignSnapshot_campaignId_periodStartsAt_periodEndsAt_key"
  ON "StudyCampaignSnapshot"("campaignId", "periodStartsAt", "periodEndsAt");
CREATE INDEX "StudyCampaignSnapshot_campaignId_snapshottedAt_idx"
  ON "StudyCampaignSnapshot"("campaignId", "snapshottedAt");
CREATE INDEX "StudyActivityInterval_startedAt_idx"
  ON "StudyActivityInterval"("startedAt");

ALTER TABLE "StudyCampaignSnapshot" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."StudyCampaignSnapshot" FROM anon, authenticated;
