ALTER TABLE "Notification"
    ADD COLUMN "actorId" TEXT,
    ADD COLUMN "entityType" TEXT,
    ADD COLUMN "entityId" TEXT,
    ADD COLUMN "parentEntityType" TEXT,
    ADD COLUMN "parentEntityId" TEXT,
    ADD COLUMN "metadata" JSONB,
    ADD COLUMN "groupKey" TEXT,
    ADD COLUMN "dedupeKey" TEXT,
    ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "seenAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Notification_dedupeKey_key"
    ON "Notification"("dedupeKey");
CREATE INDEX "Notification_memberId_seenAt_createdAt_idx"
    ON "Notification"("memberId", "seenAt", "createdAt");
CREATE INDEX "Notification_memberId_type_createdAt_idx"
    ON "Notification"("memberId", "type", "createdAt");
CREATE INDEX "Notification_groupKey_createdAt_idx"
    ON "Notification"("groupKey", "createdAt");

ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Mention" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "mentionedUserId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Mention_actorId_mentionedUserId_entityType_entityId_key"
    ON "Mention"("actorId", "mentionedUserId", "entityType", "entityId");
CREATE INDEX "Mention_mentionedUserId_createdAt_idx"
    ON "Mention"("mentionedUserId", "createdAt");
CREATE INDEX "Mention_entityType_entityId_idx"
    ON "Mention"("entityType", "entityId");
ALTER TABLE "Mention"
    ADD CONSTRAINT "Mention_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mention"
    ADD CONSTRAINT "Mention_mentionedUserId_fkey"
    FOREIGN KEY ("mentionedUserId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mention" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "mentions" BOOLEAN NOT NULL DEFAULT true,
    "commentReplies" BOOLEAN NOT NULL DEFAULT true,
    "topicComments" BOOLEAN NOT NULL DEFAULT true,
    "followedTopicActivity" BOOLEAN NOT NULL DEFAULT true,
    "lessonAvailable" BOOLEAN NOT NULL DEFAULT true,
    "moduleAvailable" BOOLEAN NOT NULL DEFAULT true,
    "activityAssigned" BOOLEAN NOT NULL DEFAULT true,
    "feedbackReceived" BOOLEAN NOT NULL DEFAULT true,
    "activityDeadline" BOOLEAN NOT NULL DEFAULT true,
    "announcements" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationPreference_memberId_key"
    ON "NotificationPreference"("memberId");
ALTER TABLE "NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "TopicFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mutedAt" TIMESTAMP(3),
    CONSTRAINT "TopicFollow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TopicFollow_userId_topicId_key"
    ON "TopicFollow"("userId", "topicId");
CREATE INDEX "TopicFollow_topicId_mutedAt_createdAt_idx"
    ON "TopicFollow"("topicId", "mutedAt", "createdAt");
CREATE INDEX "TopicFollow_userId_mutedAt_createdAt_idx"
    ON "TopicFollow"("userId", "mutedAt", "createdAt");
ALTER TABLE "TopicFollow"
    ADD CONSTRAINT "TopicFollow_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopicFollow"
    ADD CONSTRAINT "TopicFollow_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopicFollow" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE "Notification";
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- The application uses Clerk IDs as Member IDs. A short-lived server-issued
-- Supabase JWT can use the same subject for a secure realtime subscription.
CREATE POLICY "Notification recipient can read own rows"
    ON "Notification"
    FOR SELECT
    TO authenticated
    USING ((auth.jwt() ->> 'sub') = "memberId");

ALTER TABLE "CommunityComment"
    ADD COLUMN "contentJson" JSONB;
