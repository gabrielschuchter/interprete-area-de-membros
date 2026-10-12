ALTER TABLE "PlaybackProgress"
  ADD COLUMN "watchedIntervals" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "playbackSessions" JSONB NOT NULL DEFAULT '{}'::jsonb;
