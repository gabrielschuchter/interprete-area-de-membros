-- Additive only. Personal labels on a saved Community post, used to filter the
-- member's Salvos. Only the member who saved the post sees them.
ALTER TABLE "CommunityBookmark" ADD COLUMN IF NOT EXISTS "labels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Rollback (only with explicit approval, after confirming nothing reads it):
-- ALTER TABLE "CommunityBookmark" DROP COLUMN IF EXISTS "labels";
