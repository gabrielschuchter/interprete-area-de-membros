-- Additive only. Historical publication instants are unknown: leave them null.
ALTER TABLE "Meeting" ADD COLUMN "publishedAt" TIMESTAMP(3);
