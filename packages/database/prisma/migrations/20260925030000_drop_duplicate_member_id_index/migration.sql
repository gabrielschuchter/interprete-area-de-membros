-- Member.id is already protected by the primary key. The older migration
-- also created an identical unique index, which Supabase flags as redundant.
DROP INDEX IF EXISTS "Member_id_key";
