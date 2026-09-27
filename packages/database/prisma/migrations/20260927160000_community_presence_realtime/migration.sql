-- Community presence is intentionally private. The app uses a short-lived
-- server-issued JWT whose subject is the existing Clerk-backed Member ID.
-- Do not enable RLS on realtime.messages here; Supabase manages that table.
CREATE POLICY "Authenticated members can read community presence"
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      (SELECT realtime.topic()) = 'community-presence'
      AND extension = 'presence'
    );

CREATE POLICY "Authenticated members can write community presence"
    ON realtime.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
      (SELECT realtime.topic()) = 'community-presence'
      AND extension = 'presence'
    );
