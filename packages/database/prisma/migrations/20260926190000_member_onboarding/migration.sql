CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

ALTER TABLE "Member"
  ADD COLUMN "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "onboardingVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "onboardingStartedAt" TIMESTAMP(3),
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

CREATE INDEX "Member_onboardingStatus_idx"
  ON "Member"("onboardingStatus");
