-- Private Realtime channels are scoped to the Clerk-backed member ID.
-- The Notification table already has a recipient-only SELECT policy.
CREATE POLICY "Member can join own notification channel"
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      (SELECT realtime.topic()) =
        'member-notifications:' || (SELECT auth.jwt() ->> 'sub')
      AND extension = 'broadcast'
    );

-- Broadcast only an invalidation key. The full notification stays behind the
-- authenticated Prisma endpoint instead of travelling in the Realtime frame.
CREATE OR REPLACE FUNCTION public.broadcast_notification_invalidation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_member_id TEXT;
  target_notification_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_member_id := OLD."memberId";
    target_notification_id := OLD."id";
  ELSE
    target_member_id := NEW."memberId";
    target_notification_id := NEW."id";
  END IF;

  PERFORM realtime.send(
    jsonb_build_object(
      'notificationId', target_notification_id,
      'operation', TG_OP
    ),
    'notification.invalidate',
    'member-notifications:' || target_member_id,
    TRUE
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_notification_invalidation() FROM PUBLIC;

CREATE TRIGGER "Notification_broadcast_invalidation"
AFTER INSERT OR UPDATE OR DELETE ON public."Notification"
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_notification_invalidation();
