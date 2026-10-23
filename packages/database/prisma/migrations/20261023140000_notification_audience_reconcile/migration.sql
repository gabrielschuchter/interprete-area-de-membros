-- Older notification writers could persist NULL communitySpaceId after the
-- first fail-closed migration. Since NULL is also the legitimate scope for
-- global posts, keep it only when every explicit post/comment reference proves
-- a published post with a coherent, explicit audience.
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

-- An invitation notification is visible only while its matching invitation is
-- pending. Resolve its group scope only when the recipient and published group
-- still match; all other invitation rows remain inaccessible.
UPDATE public."Notification" AS notification
SET "communitySpaceId" = invitation."spaceId"
FROM public."CommunitySpaceInvitation" AS invitation
JOIN public."CommunitySpace" AS space
  ON space."id" = invitation."spaceId"
WHERE notification."communitySpaceId" = '__community_scope_unresolved__'
  AND notification."type" = 'GROUP_INVITATION'
  AND notification."entityType" = 'COMMUNITY_INVITATION'
  AND notification."entityId" = invitation."id"
  AND notification."memberId" = invitation."inviteeId"
  AND invitation."status" = 'PENDING'
  AND space."status" = 'PUBLISHED';

-- Resolve notification references through either a post or a comment. Every
-- non-empty entity slot must resolve to the same published post; malformed,
-- missing, contradictory, deleted, or legacy-ambiguous references stay closed.
WITH notification_references AS (
  SELECT
    notification."id" AS notification_id,
    notification."type" AS notification_type,
    reference."entityType" AS entity_type,
    reference."entityId" AS entity_id
  FROM public."Notification" AS notification
  CROSS JOIN LATERAL (
    VALUES
      (notification."entityType", notification."entityId"),
      (notification."parentEntityType", notification."parentEntityId")
  ) AS reference("entityType", "entityId")
  WHERE notification."communitySpaceId" = '__community_scope_unresolved__'
    AND notification."type" IN (
      'MENTION',
      'COMMENT_REPLY',
      'TOPIC_COMMENT',
      'FOLLOWED_TOPIC_ACTIVITY',
      'GROUP_POST'
    )
    AND (
      reference."entityType" IS NOT NULL
      OR reference."entityId" IS NOT NULL
    )
),
resolved_references AS (
  SELECT
    reference.notification_id,
    reference.notification_type,
    CASE
      WHEN reference.entity_type = 'TOPIC' THEN topic."id"
      WHEN reference.entity_type = 'COMMENT' THEN comment."postId"
      ELSE NULL
    END AS post_id,
    post."audienceScope" AS audience_scope,
    post."spaceId" AS space_id,
    post."status" AS post_status,
    post."deletedAt" AS post_deleted_at,
    space."status" AS space_status
  FROM notification_references AS reference
  LEFT JOIN public."CommunityPost" AS topic
    ON reference.entity_type = 'TOPIC'
   AND topic."id" = reference.entity_id
  LEFT JOIN public."CommunityComment" AS comment
    ON reference.entity_type = 'COMMENT'
   AND comment."id" = reference.entity_id
  LEFT JOIN public."CommunityPost" AS post
    ON post."id" = CASE
      WHEN reference.entity_type = 'TOPIC' THEN topic."id"
      WHEN reference.entity_type = 'COMMENT' THEN comment."postId"
      ELSE NULL
    END
  LEFT JOIN public."CommunitySpace" AS space
    ON space."id" = post."spaceId"
),
notification_scopes AS (
  SELECT
    reference.notification_id,
    reference.notification_type,
    COUNT(*) AS reference_count,
    COUNT(reference.post_id) AS resolved_reference_count,
    COUNT(DISTINCT reference.post_id) AS distinct_post_count,
    COUNT(DISTINCT reference.space_id) AS distinct_space_count,
    BOOL_AND(
      reference.post_id IS NOT NULL
      AND reference.post_status = 'PUBLISHED'
      AND reference.post_deleted_at IS NULL
      AND (
        (
          reference.audience_scope = 'GLOBAL'
          AND reference.space_id IS NULL
        )
        OR (
          reference.audience_scope = 'GROUP'
          AND reference.space_id IS NOT NULL
          AND reference.space_status = 'PUBLISHED'
        )
      )
    ) AS all_references_valid,
    BOOL_AND(
      reference.audience_scope = 'GLOBAL'
      AND reference.space_id IS NULL
    ) AS all_references_global,
    BOOL_AND(
      reference.audience_scope = 'GROUP'
      AND reference.space_id IS NOT NULL
      AND reference.space_status = 'PUBLISHED'
    ) AS all_references_group,
    MIN(reference.space_id) AS group_id
  FROM resolved_references AS reference
  GROUP BY reference.notification_id, reference.notification_type
),
classified_notifications AS (
  SELECT
    scope.notification_id,
    CASE
      WHEN scope.reference_count = scope.resolved_reference_count
        AND scope.distinct_post_count = 1
        AND scope.all_references_valid
        AND scope.notification_type IN (
          'MENTION',
          'COMMENT_REPLY',
          'TOPIC_COMMENT',
          'FOLLOWED_TOPIC_ACTIVITY'
        )
        AND scope.all_references_global
        THEN NULL
      WHEN scope.reference_count = scope.resolved_reference_count
        AND scope.distinct_post_count = 1
        AND scope.all_references_valid
        AND scope.all_references_group
        AND scope.distinct_space_count = 1
        AND scope.notification_type IN (
          'MENTION',
          'COMMENT_REPLY',
          'TOPIC_COMMENT',
          'FOLLOWED_TOPIC_ACTIVITY',
          'GROUP_POST'
        )
        THEN scope.group_id
      ELSE '__community_scope_unresolved__'
    END AS community_space_id
  FROM notification_scopes AS scope
)
UPDATE public."Notification" AS notification
SET "communitySpaceId" = classified.community_space_id
FROM classified_notifications AS classified
WHERE notification."id" = classified.notification_id
  AND notification."communitySpaceId" = '__community_scope_unresolved__'
  AND notification."communitySpaceId" IS DISTINCT FROM classified.community_space_id;
