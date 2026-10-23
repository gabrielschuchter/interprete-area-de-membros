-- Notifications are read through the authenticated Prisma API. Realtime uses
-- only the private Broadcast topic below and does not need Data API table grants.
REVOKE ALL ON TABLE public."Notification" FROM PUBLIC, anon, authenticated;

ALTER TABLE public."Notification"
    ADD COLUMN "communitySpaceId" TEXT;

CREATE INDEX "Notification_memberId_communitySpaceId_createdAt_idx"
    ON public."Notification"("memberId", "communitySpaceId", "createdAt");

-- Keep rows whose former group cannot be resolved fail-closed. Rows linked to
-- a live post/comment are replaced below with the post's current space (which
-- is NULL only for a known global post).
UPDATE public."Notification"
SET "communitySpaceId" = '__community_scope_unresolved__'
WHERE "type" IN (
    'MENTION',
    'COMMENT_REPLY',
    'TOPIC_COMMENT',
    'FOLLOWED_TOPIC_ACTIVITY',
    'GROUP_INVITATION',
    'GROUP_POST'
);

UPDATE public."Notification" AS notification
SET "communitySpaceId" = post."spaceId"
FROM public."CommunityPost" AS post
WHERE notification."communitySpaceId" = '__community_scope_unresolved__'
  AND post."spaceId" IS NOT NULL
  AND notification."type" = 'GROUP_POST'
  AND (
      (notification."entityType" = 'TOPIC' AND notification."entityId" = post."id")
      OR (notification."parentEntityType" = 'TOPIC' AND notification."parentEntityId" = post."id")
  );

UPDATE public."Notification" AS notification
SET "communitySpaceId" = post."spaceId"
FROM public."CommunityPost" AS post
WHERE notification."communitySpaceId" = '__community_scope_unresolved__'
  AND notification."type" IN (
      'MENTION',
      'COMMENT_REPLY',
      'TOPIC_COMMENT',
      'FOLLOWED_TOPIC_ACTIVITY'
  )
  AND (
      (notification."entityType" = 'TOPIC' AND notification."entityId" = post."id")
      OR (notification."parentEntityType" = 'TOPIC' AND notification."parentEntityId" = post."id")
      OR EXISTS (
          SELECT 1 FROM public."CommunityComment" AS comment
          WHERE comment."id" = notification."entityId"
            AND notification."entityType" = 'COMMENT'
            AND comment."postId" = post."id"
      )
      OR EXISTS (
          SELECT 1 FROM public."CommunityComment" AS comment
          WHERE comment."id" = notification."parentEntityId"
            AND notification."parentEntityType" = 'COMMENT'
            AND comment."postId" = post."id"
      )
  );

UPDATE public."Notification" AS notification
SET "communitySpaceId" = invitation."spaceId"
FROM public."CommunitySpaceInvitation" AS invitation
WHERE notification."type" = 'GROUP_INVITATION'
  AND notification."entityType" = 'COMMUNITY_INVITATION'
  AND notification."entityId" = invitation."id";
