-- Additive only. Manual completion of a recording in the room (Sala de Aula).
-- NULL = follow the automatic 90% rule (completedPlaybackAt), true = marked as
-- done by the member, false = reopened by the member. The playback progress
-- route rewrites completedPlaybackAt on every save, so a manual choice needs
-- its own column to survive it.
ALTER TABLE "PlaybackProgress" ADD COLUMN IF NOT EXISTS "manualCompletion" BOOLEAN;

-- Rollback (only with explicit approval, after confirming nothing reads it):
-- ALTER TABLE "PlaybackProgress" DROP COLUMN IF EXISTS "manualCompletion";
