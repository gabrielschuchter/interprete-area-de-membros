import { readFile } from "node:fs/promises";
import { database, MemberRole } from "@repo/database";

interface ClerkQaAccount {
  readonly clerkUserId: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
}

interface ClerkQaLedger {
  readonly accounts: readonly ClerkQaAccount[];
}

const memberRoleFor = (role: string) => {
  if (role === "ADMIN") {
    return MemberRole.ADMIN;
  }
  if (role === "TEACHER") {
    return MemberRole.TEACHER;
  }
  return MemberRole.MEMBER;
};

const expectedDatabase = "interprete_community_v2_qa";
const databaseUrl = new URL(process.env.DATABASE_URL ?? "http://invalid.local");
if (
  process.env.COMMUNITY_QA_ISOLATED !== "true" ||
  databaseUrl.hostname !== "127.0.0.1" ||
  databaseUrl.port !== "54325" ||
  databaseUrl.pathname.slice(1) !== expectedDatabase ||
  databaseUrl.username !== "community_qa"
) {
  throw new Error(
    "Community E2E requires the guarded local interprete_community_v2_qa database."
  );
}

// Standalone PostgreSQL does not provide Supabase Realtime's invalidation
// transport. Keep the real notification row and outbox consumer under test,
// while making only that external broadcast a local no-op in the guarded QA DB.
const realtimeSend = await database.$queryRaw<
  Array<{ readonly installed: boolean }>
>`
  SELECT to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL
    AS installed
`;
if (!realtimeSend[0]?.installed) {
  await database.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS "realtime"');
  await database.$executeRawUnsafe(
    `CREATE FUNCTION "realtime"."send"(jsonb, text, text, boolean)
      RETURNS uuid
      LANGUAGE sql
      VOLATILE
      AS 'SELECT gen_random_uuid()'`
  );
}

const ledgerPath = process.env.COMMUNITY_QA_LEDGER_PATH;
if (!ledgerPath) {
  throw new Error("The protected local Clerk QA ledger is not configured.");
}

const ledger = JSON.parse(await readFile(ledgerPath, "utf8")) as ClerkQaLedger;
const memberAccounts = ledger.accounts.filter(
  (account) => account.role === "MEMBER"
);
const accounts = [
  memberAccounts[1] ?? memberAccounts[0],
  memberAccounts[0],
  ledger.accounts.find((account) => account.role === "TEACHER"),
  ledger.accounts.find((account) => account.role === "ADMIN"),
]
  .filter((account): account is ClerkQaAccount => Boolean(account))
  .filter(
    (account, index, all) =>
      all.findIndex(
        ({ clerkUserId }) => clerkUserId === account.clerkUserId
      ) === index
  );

if (accounts.length < 2 || accounts.some((account) => !account.clerkUserId)) {
  throw new Error(
    "The existing Clerk Development QA member/admin accounts are unavailable."
  );
}

if (
  ["groups", "invitations", "full"].includes(
    process.env.COMMUNITY_QA_SUITE ?? ""
  ) &&
  ![
    process.env.COMMUNITY_QA_MEMBER_ID,
    process.env.COMMUNITY_QA_SECONDARY_MEMBER_ID,
    process.env.COMMUNITY_QA_TEACHER_ID,
    process.env.COMMUNITY_QA_ADMIN_ID,
  ].every((id) => id && accounts.some((account) => account.clerkUserId === id))
) {
  throw new Error(
    "Group authorization QA requires the existing two MEMBER, TEACHER, and ADMIN identities."
  );
}

try {
  const [
    coverColumn,
    authorIndex,
    globalPinIndex,
    groupPinIndex,
    migration,
    moderatorRole,
    inviteLinkTable,
    inviteLinkIndex,
    inviteLinkNoExpiry,
    inviteLinkMigration,
    inviteLinkRls,
    inviteLinkPolicies,
    inviteLinkGrants,
  ] = await Promise.all([
    database.$queryRaw<Array<{ readonly column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'CommunityPost'
          AND column_name = 'coverAltText'
      `,
    database.$queryRaw<Array<{ readonly indexname: string }>>`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'CommunityPost_authorId_status_updatedAt_id_idx'
      `,
    database.$queryRaw<Array<{ readonly indexname: string }>>`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'CommunityPost_one_pinned_feed_idx'
      `,
    database.$queryRaw<Array<{ readonly indexname: string }>>`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'CommunityPost_one_pinned_per_space_idx'
      `,
    database.$queryRaw<Array<{ readonly migration_name: string }>>`
        SELECT migration_name FROM public."_prisma_migrations"
        WHERE migration_name = '20261020190000_community_publication_ux'
          AND finished_at IS NOT NULL
          AND rolled_back_at IS NULL
      `,
    database.$queryRaw<Array<{ readonly enumlabel: string }>>`
        SELECT enumlabel FROM pg_enum
        WHERE enumtypid = '"CommunitySpaceMemberRole"'::regtype
          AND enumlabel = 'MODERATOR'
      `,
    database.$queryRaw<
      Array<{
        readonly column_name: string;
        readonly data_type: string;
        readonly character_maximum_length: number | null;
      }>
    >`
        SELECT column_name, data_type, character_maximum_length FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'CommunitySpaceInviteLink'
          AND column_name = 'tokenHash'
      `,
    database.$queryRaw<Array<{ readonly indexname: string }>>`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'CommunitySpaceInviteLink_one_active_per_space'
      `,
    database.$queryRaw<Array<{ readonly expiry_column_count: bigint }>>`
        SELECT count(*) AS expiry_column_count FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'CommunitySpaceInviteLink'
          AND column_name IN ('expiresAt', 'expiresOn')
      `,
    database.$queryRaw<Array<{ readonly migration_name: string }>>`
        SELECT migration_name FROM public."_prisma_migrations"
        WHERE migration_name = '20261021130000_community_group_invite_links'
          AND finished_at IS NOT NULL
          AND rolled_back_at IS NULL
      `,
    database.$queryRaw<Array<{ readonly row_security: boolean }>>`
        SELECT relrowsecurity AS row_security FROM pg_class
        WHERE oid = 'public."CommunitySpaceInviteLink"'::regclass
      `,
    database.$queryRaw<Array<{ readonly policy_count: bigint }>>`
        SELECT count(*) AS policy_count FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'CommunitySpaceInviteLink'
      `,
    database.$queryRaw<
      Array<{
        readonly anon_allowed: boolean;
        readonly authenticated_allowed: boolean;
      }>
    >`
        SELECT
          COALESCE((
            SELECT has_table_privilege(role.rolname, 'public."CommunitySpaceInviteLink"', 'SELECT')
            FROM pg_roles AS role WHERE role.rolname = 'anon'
          ), false) AS anon_allowed,
          COALESCE((
            SELECT has_table_privilege(role.rolname, 'public."CommunitySpaceInviteLink"', 'SELECT')
            FROM pg_roles AS role WHERE role.rolname = 'authenticated'
          ), false) AS authenticated_allowed
      `,
  ]);

  if (
    coverColumn.length !== 1 ||
    authorIndex.length !== 1 ||
    globalPinIndex.length !== 1 ||
    groupPinIndex.length !== 1 ||
    migration.length !== 1 ||
    moderatorRole.length !== 1
  ) {
    throw new Error(
      "The local Community V2 UX migration is not fully applied to the isolated QA database."
    );
  }

  if (
    ["invitations", "full"].includes(process.env.COMMUNITY_QA_SUITE ?? "") &&
    (inviteLinkTable.length !== 1 ||
      inviteLinkTable[0]?.data_type !== "character varying" ||
      inviteLinkTable[0]?.character_maximum_length !== 64 ||
      inviteLinkIndex.length !== 1 ||
      inviteLinkNoExpiry[0]?.expiry_column_count !== 0n ||
      inviteLinkMigration.length !== 1 ||
      inviteLinkRls[0]?.row_security !== true ||
      inviteLinkPolicies[0]?.policy_count !== 0n ||
      inviteLinkGrants[0]?.anon_allowed !== false ||
      inviteLinkGrants[0]?.authenticated_allowed !== false)
  ) {
    throw new Error(
      "The isolated invitation migration, RLS, or Data API grant boundary is not verified."
    );
  }

  for (const account of accounts) {
    const role = memberRoleFor(account.role);
    await database.member.upsert({
      where: { id: account.clerkUserId },
      create: {
        id: account.clerkUserId,
        role,
        displayName: account.name,
        email: account.email,
        onboardingStatus: "COMPLETED",
      },
      update: { role, onboardingStatus: "COMPLETED", deactivatedAt: null },
    });
  }

  process.stdout.write(
    "Prepared existing Clerk Development MEMBER, TEACHER, and ADMIN identities in the guarded local QA database; applied migrations and group role indexes verified.\n"
  );
} finally {
  await database.$disconnect();
}
