CREATE TYPE "ExerciseSessionKind" AS ENUM ('LIST', 'FAVORITE');

ALTER TABLE "ExerciseSession"
ADD COLUMN "kind" "ExerciseSessionKind" NOT NULL DEFAULT 'LIST';
