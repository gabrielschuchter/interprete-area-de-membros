-- A Profile is the editorial projection of the same Clerk-backed Member.
-- Keep the relation explicit so orphan identities cannot be created.
ALTER TABLE "Profile"
ADD CONSTRAINT "Profile_clerkUserId_fkey"
FOREIGN KEY ("clerkUserId") REFERENCES "Member"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
