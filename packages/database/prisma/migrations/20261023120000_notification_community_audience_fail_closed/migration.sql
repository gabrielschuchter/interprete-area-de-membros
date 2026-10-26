-- Older application instances do not know this column and omit it on insert.
-- Give those writes an inaccessible scope until a current writer can resolve it.
ALTER TABLE public."Notification"
    ALTER COLUMN "communitySpaceId"
    SET DEFAULT '__community_scope_unresolved__';

-- The previous backfill could not distinguish a global post from a post whose
-- former group's FK had been nulled by ON DELETE SET NULL. Keep every legacy
-- community notification with NULL scope closed, then recover only live links.
UPDATE public."Notification"
SET "communitySpaceId" = '__community_scope_unresolved__'
WHERE "communitySpaceId" IS NULL
  AND "type" IN (
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
  AND post."spaceId" IS NOT NULL
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
WHERE notification."communitySpaceId" = '__community_scope_unresolved__'
  AND notification."type" = 'GROUP_INVITATION'
  AND notification."entityType" = 'COMMUNITY_INVITATION'
  AND notification."entityId" = invitation."id";
