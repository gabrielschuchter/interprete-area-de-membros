-- Additive only. Optional video timestamp for lesson notes taken in the room
-- (Sala de Aula). Existing notes keep NULL, which reads as "no timestamp".
ALTER TABLE "PlannerNote" ADD COLUMN IF NOT EXISTS "videoTimeSeconds" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PlannerNote_videoTimeSeconds_check'
  ) THEN
    ALTER TABLE "PlannerNote"
      ADD CONSTRAINT "PlannerNote_videoTimeSeconds_check"
      CHECK ("videoTimeSeconds" IS NULL OR "videoTimeSeconds" >= 0);
  END IF;
END $$;

-- Rollback (only with explicit approval, after confirming nothing reads it):
-- ALTER TABLE "PlannerNote" DROP CONSTRAINT IF EXISTS "PlannerNote_videoTimeSeconds_check";
-- ALTER TABLE "PlannerNote" DROP COLUMN IF EXISTS "videoTimeSeconds";
