-- These association tables are accessed through the server-side Prisma layer.
-- Enable RLS and remove direct client grants; no Data API policies are needed.
ALTER TABLE "ActivityAssignment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ActivityAssignment" FROM PUBLIC, anon, authenticated;

ALTER TABLE "MeetingParticipant" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "MeetingParticipant" FROM PUBLIC, anon, authenticated;
