-- Unified assignments may target courses, lessons, assets, or library items.
-- Keep legacy activity IDs and their FK; the existing target check still
-- requires activityId for ACTIVITY and NULL for every other target type.
ALTER TABLE public."ActivityAssignment"
  ALTER COLUMN "activityId" DROP NOT NULL;
