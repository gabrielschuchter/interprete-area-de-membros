#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  compactJsonText,
  comparePerRowHashes,
  reconcilePrismaMigrationLedger,
} from "../lib/postgres-archive-validation.mjs";
import { parseGreenSessionPoolerUrl } from "../lib/supabase-green-connection.mjs";
import { sameEventTriggerDefinition } from "../lib/supabase-project-config.mjs";
import { loadQaLedger } from "./green-qa-ledger.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DATABASE_PACKAGE = path.join(ROOT, "packages/database/package.json");
const PRISMA_SCHEMA = path.join(ROOT, "packages/database/prisma/schema.prisma");
const MIGRATIONS_DIRECTORY = path.join(
  ROOT,
  "packages/database/prisma/migrations"
);
const CA_FILE = path.join(
  ROOT,
  "packages/database/certs/supabase-prod-ca-2021.crt"
);
const CREDENTIAL_FILE = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Codex/migrations/interprete-supabase/green-session-pooler-uri.dpapi"
);
const GREEN_REF = "qffqhilydtnrggbcnogh";
const PUBLIC_SCHEMA = "public";
const MIGRATION_TABLE = "_prisma_migrations";
const SCHEMA_MIGRATIONS = "supabase_migrations";
const LINE_BREAK = /\r?\n/;
const MODEL_DECLARATION = /^model\s+([A-Za-z_][\w]*)\s*\{/gm;
const ENUM_DECLARATION = /^enum\s+([A-Za-z_][\w]*)\s*\{/gm;
const ENUM_BLOCK = /^enum\s+([A-Za-z_][\w]*)\s*\{([^}]*)\}/gm;
const MIGRATION_NAME = /^\d{14}_[a-z0-9_]+$/;
const COMMENT_SUFFIX = /\/\/.*$/;
const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const quoteLiteral = (value) => `'${value.replaceAll("'", "''")}'`;
// biome-ignore lint/suspicious/noBitwiseOperators: PostgreSQL defines pg_trigger.tgtype as a bit mask.
const hasTriggerBit = (triggerType, mask) => (triggerType & mask) === mask;
const stableJson = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};
const rowsMatch = (left, right) =>
  JSON.stringify(left.map(stableJson).sort()) ===
  JSON.stringify(right.map(stableJson).sort());

const fail = (message) => {
  throw new Error(message);
};

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const unprotectWithDpapi = (bytes) => {
  const command =
    "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; " +
    "$b=[Convert]::FromBase64String([Console]::In.ReadLine()); " +
    "$p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null," +
    "[Security.Cryptography.DataProtectionScope]::CurrentUser); " +
    "[Console]::Out.Write([Convert]::ToBase64String($p))";
  const result = spawnSync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
    {
      input: Buffer.from(`${bytes.toString("base64")}\n`),
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    }
  );
  if (result.status !== 0 || !result.stdout?.trim()) {
    fail("Current-user DPAPI could not open the protected migration artifact.");
  }
  return Buffer.from(result.stdout.trim(), "base64");
};

const readSnapshot = (manifestPath) => {
  if (!(process.platform === "win32" && process.env.LOCALAPPDATA)) {
    fail("This validator requires the Windows user profile used for DPAPI.");
  }
  const protectedSnapshot = unprotectWithDpapi(fs.readFileSync(manifestPath));
  let snapshot;
  try {
    snapshot = JSON.parse(protectedSnapshot.toString("utf8"));
  } finally {
    protectedSnapshot.fill(0);
  }
  if (
    snapshot.format !== "INTERPRETE-SUPABASE-SOURCE-SNAPSHOT-V1" ||
    snapshot.sourceProjectRef !== "wkclodjbrynerfgufmyb" ||
    !snapshot.connection.sharedSnapshot ||
    !snapshot.database.rowSnapshots.every(
      (table) => table.perRowHashes?.length === table.rowCount
    )
  ) {
    fail(
      "The protected source snapshot is not a complete paired row-hash manifest."
    );
  }
  return snapshot;
};

const getMigrationFiles = () => {
  const entries = fs
    .readdirSync(MIGRATIONS_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      if (!MIGRATION_NAME.test(entry.name)) {
        fail("A local Prisma migration directory has an invalid name.");
      }
      const migrationPath = path.join(
        MIGRATIONS_DIRECTORY,
        entry.name,
        "migration.sql"
      );
      if (!fs.existsSync(migrationPath)) {
        fail("A local Prisma migration directory has no migration.sql file.");
      }
      return {
        name: entry.name,
        checksum: sha256(fs.readFileSync(migrationPath)),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  return entries;
};

const namesFromSchema = (pattern) =>
  [...fs.readFileSync(PRISMA_SCHEMA, "utf8").matchAll(pattern)].map(
    (match) => match[1]
  );

const enumsFromSchema = () => {
  const schema = fs.readFileSync(PRISMA_SCHEMA, "utf8");
  return [...schema.matchAll(ENUM_BLOCK)].map((match) => ({
    name: match[1],
    labels: match[2]
      .split(LINE_BREAK)
      .map((line) => line.replace(COMMENT_SUFFIX, "").trim())
      .filter(Boolean),
  }));
};

const migrationRowHashes = async (client, snapshotTable, sourceColumns) => {
  const schema = quoteIdentifier(snapshotTable.schema);
  const table = quoteIdentifier(snapshotTable.table);
  const rowExpression =
    sourceColumns.length === 0
      ? "row_to_json(t)::text"
      : `json_build_object(${sourceColumns
          .flatMap((column) => [
            quoteLiteral(column),
            `t.${quoteIdentifier(column)}`,
          ])
          .join(",")})::text`;
  const primaryKeyExpression = snapshotTable.primaryKeyColumns.length
    ? `jsonb_build_array(${snapshotTable.primaryKeyColumns
        .map((column) => `t.${quoteIdentifier(column)}`)
        .join(",")})::text`
    : "NULL::text";
  const orderExpression = snapshotTable.primaryKeyColumns.length
    ? `(${primaryKeyExpression}) COLLATE "C"`
    : 'row_json COLLATE "C"';
  const rows = (
    await client.query(
      `SELECT ${rowExpression} AS row_json,${primaryKeyExpression} AS pk_json ` +
        `FROM ${schema}.${table} t ORDER BY ${orderExpression}`
    )
  ).rows;
  const perRowHashes = rows.map((row) => {
    const rowSha256 = sha256(compactJsonText(row.row_json));
    return {
      identitySha256: row.pk_json === null ? rowSha256 : sha256(row.pk_json),
      rowSha256,
    };
  });
  return {
    rowCount: rows.length,
    perRowHashes,
  };
};

const restoredCatalogChecks = async (client, snapshot) => {
  const schemas = [PUBLIC_SCHEMA, SCHEMA_MIGRATIONS];
  const columns = (
    await client.query(
      "SELECT table_schema,table_name,column_name,ordinal_position,data_type,udt_name," +
        "is_nullable,column_default,is_identity,identity_generation " +
        "FROM information_schema.columns WHERE table_schema=ANY($1::text[]) " +
        "ORDER BY table_schema,table_name,ordinal_position",
      [schemas]
    )
  ).rows;
  const constraints = (
    await client.query(
      "SELECT n.nspname AS schema_name,t.relname AS table_name,c.conname AS name," +
        "c.contype AS type,c.convalidated AS validated,pg_get_constraintdef(c.oid,true) AS definition " +
        "FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid " +
        "JOIN pg_namespace n ON n.oid=t.relnamespace " +
        "WHERE n.nspname=ANY($1::text[]) ORDER BY n.nspname,t.relname,c.conname",
      [schemas]
    )
  ).rows;
  const indexes = (
    await client.query(
      "SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes " +
        "WHERE schemaname=ANY($1::text[]) ORDER BY schemaname,tablename,indexname",
      [schemas]
    )
  ).rows;
  const policies = (
    await client.query(
      "SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check " +
        "FROM pg_policies WHERE schemaname=ANY($1::text[]) " +
        "ORDER BY schemaname,tablename,policyname",
      [[...schemas, "auth", "storage", "realtime"]]
    )
  ).rows;
  const sequences = (
    await client.query(
      "SELECT s.schemaname AS schema_name,s.sequencename AS sequence_name," +
        "s.sequenceowner AS owner_name,s.data_type,s.start_value::text," +
        "s.min_value::text,s.max_value::text,s.increment_by::text," +
        "s.cache_size::text,s.cycle,s.last_value::text " +
        "FROM pg_sequences s WHERE s.schemaname=ANY($1::text[]) " +
        "ORDER BY s.schemaname,s.sequencename",
      [schemas]
    )
  ).rows;
  const sequenceStates = [];
  for (const sequence of sequences) {
    const state = (
      await client.query(
        `SELECT last_value::text AS last_value,is_called FROM ${quoteIdentifier(sequence.schema_name)}.${quoteIdentifier(sequence.sequence_name)}`
      )
    ).rows[0];
    sequenceStates.push({
      ...sequence,
      lastValue: state.last_value,
      isCalled: state.is_called,
    });
  }
  const functions = (
    await client.query(
      "SELECT n.nspname AS schema_name,p.proname AS function_name," +
        "pg_get_function_identity_arguments(p.oid) AS identity_arguments,l.lanname AS language," +
        "p.prosecdef AS security_definer,p.provolatile AS volatility,p.proacl::text AS acl," +
        "pg_get_userbyid(p.proowner) AS owner_name," +
        "COALESCE((SELECT json_agg(jsonb_build_object(" +
        "'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END," +
        "'privilege',a.privilege_type,'grantable',a.is_grantable) " +
        "ORDER BY a.grantee,a.privilege_type) FROM aclexplode(" +
        "COALESCE(p.proacl,acldefault('f',p.proowner))) a),'[]'::json) AS acl_grants," +
        "pg_get_functiondef(p.oid) AS definition " +
        "FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace " +
        "JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='public' " +
        "ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)"
    )
  ).rows.map(({ definition, ...fn }) => ({
    ...fn,
    definition_sha256: sha256(definition),
  }));
  const triggers = (
    await client.query(
      "SELECT n.nspname AS schema_name,c.relname AS table_name,t.tgname AS trigger_name," +
        "t.tgenabled AS enabled,pn.nspname AS function_schema,p.proname AS function_name," +
        "pg_get_triggerdef(t.oid,true) AS definition " +
        "FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid " +
        "JOIN pg_namespace n ON n.oid=c.relnamespace " +
        "JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace " +
        "WHERE NOT t.tgisinternal AND n.nspname=ANY($1::text[]) " +
        "ORDER BY n.nspname,c.relname,t.tgname",
      [["public", "supabase_migrations", "auth", "storage", "realtime"]]
    )
  ).rows;
  const eventTriggers = (
    await client.query(
      "SELECT e.evtname AS name,e.evtevent AS event,e.evtenabled AS enabled," +
        "e.evttags AS tags,n.nspname AS function_schema,p.proname AS function_name," +
        "pg_get_function_identity_arguments(p.oid) AS identity_arguments " +
        "FROM pg_event_trigger e JOIN pg_proc p ON p.oid=e.evtfoid " +
        "JOIN pg_namespace n ON n.oid=p.pronamespace ORDER BY e.evtname"
    )
  ).rows;
  const schemaAcls = (
    await client.query(
      "SELECT n.nspname AS schema_name,pg_get_userbyid(n.nspowner) AS owner_name," +
        "n.nspacl::text AS acl FROM pg_namespace n " +
        "WHERE n.nspname=ANY($1::text[]) ORDER BY n.nspname",
      [schemas]
    )
  ).rows;
  const relationAcls = (
    await client.query(
      "SELECT n.nspname AS schema_name,c.relname AS relation_name,c.relkind AS kind," +
        "c.relacl::text AS acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace " +
        "WHERE n.nspname=ANY($1::text[]) AND c.relkind IN ('r','p','v','m','S') " +
        "ORDER BY n.nspname,c.relname",
      [schemas]
    )
  ).rows;
  const defaultAcls = (
    await client.query(
      "SELECT n.nspname AS schema_name,pg_get_userbyid(d.defaclrole) AS owner_name," +
        "d.defaclobjtype AS object_type,d.defaclacl::text AS acl " +
        "FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace " +
        "WHERE n.nspname=ANY($1::text[]) ORDER BY n.nspname,owner_name,d.defaclobjtype",
      [schemas]
    )
  ).rows;
  const extensionRows = (
    await client.query(
      "SELECT e.extname AS name,e.extversion AS version,n.nspname AS schema_name " +
        "FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace"
    )
  ).rows;
  const publication =
    (
      await client.query(
        "SELECT p.pubname AS publication,p.puballtables AS all_tables," +
          "p.pubinsert AS publishes_insert,p.pubupdate AS publishes_update," +
          "p.pubdelete AS publishes_delete,p.pubtruncate AS publishes_truncate," +
          "p.pubviaroot AS publishes_via_root," +
          "COALESCE(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname) " +
          "ORDER BY n.nspname,c.relname) FILTER (WHERE c.oid IS NOT NULL),'[]'::jsonb) AS tables " +
          "FROM pg_publication p LEFT JOIN pg_publication_rel pr ON pr.prpubid=p.oid " +
          "LEFT JOIN pg_class c ON c.oid=pr.prrelid " +
          "LEFT JOIN pg_namespace n ON n.oid=c.relnamespace " +
          "WHERE p.pubname='supabase_realtime' " +
          "GROUP BY p.pubname,p.puballtables,p.pubinsert,p.pubupdate," +
          "p.pubdelete,p.pubtruncate,p.pubviaroot"
      )
    ).rows[0] ?? null;
  const expectedExtensions = snapshot.catalog.extensions;
  const extensionByName = new Map(
    extensionRows.map((extension) => [extension.name, extension])
  );
  const extensionMismatches = expectedExtensions
    .filter((extension) => {
      const actual = extensionByName.get(extension.name);
      return (
        !actual ||
        actual.schema_name !== extension.schema_name ||
        actual.version !== extension.version
      );
    })
    .map((extension) => extension.name);
  const extensionsPresent = extensionMismatches.length === 0;
  const sourceEvents = snapshot.catalog.eventTriggers.filter(
    (trigger) => trigger.function_schema === "public"
  );
  const targetEvents = new Map(
    eventTriggers.map((trigger) => [trigger.name, trigger])
  );
  const eventTriggersMatch = sourceEvents.every((trigger) => {
    const target = targetEvents.get(trigger.name);
    return target && sameEventTriggerDefinition(trigger, target);
  });
  const sourceManagedTriggers = snapshot.catalog.triggers.filter(
    (trigger) =>
      ["auth", "storage", "realtime"].includes(trigger.schema_name) &&
      trigger.function_schema === "public"
  );
  const targetManagedTriggers = triggers.filter(
    (trigger) =>
      ["auth", "storage", "realtime"].includes(trigger.schema_name) &&
      trigger.function_schema === "public"
  );
  const managedTriggersMatch = rowsMatch(
    sourceManagedTriggers,
    targetManagedTriggers
  );
  const sourceRelations = snapshot.catalog.relationAcls.filter((acl) =>
    schemas.includes(acl.schema_name)
  );
  const sourceSchemaAcls = snapshot.catalog.schemaAcls.filter((acl) =>
    schemas.includes(acl.schema_name)
  );
  const sourceDefaultAcls = snapshot.catalog.defaultAcls.filter((acl) =>
    schemas.includes(acl.schema_name)
  );
  const sourceManagedPolicies = snapshot.catalog.managedPolicies;
  const targetManagedPolicies = policies.filter((policy) =>
    ["auth", "storage", "realtime"].includes(policy.schemaname)
  );
  const sourcePublication = snapshot.catalog.publications.find(
    (item) => item.publication === "supabase_realtime"
  );
  const publicationMatch =
    sourcePublication !== undefined &&
    publication !== null &&
    rowsMatch([sourcePublication], [publication]);
  const sourceFunctions = snapshot.catalog.functions
    .filter((fn) => fn.schema_name === "public")
    .map(({ definition: _definition, ...fn }) => fn);
  const sourceTriggers = snapshot.catalog.triggers.filter((trigger) =>
    ["public", "supabase_migrations"].includes(trigger.schema_name)
  );
  const checks = {
    columnsMatch: rowsMatch(
      snapshot.database.columns.filter((column) =>
        schemas.includes(column.table_schema)
      ),
      columns
    ),
    constraintsMatch: rowsMatch(
      snapshot.catalog.constraints.filter((constraint) =>
        schemas.includes(constraint.schema_name)
      ),
      constraints
    ),
    indexesMatch: rowsMatch(
      snapshot.catalog.indexes.filter((index) =>
        schemas.includes(index.schemaname)
      ),
      indexes
    ),
    publicPoliciesMatch: rowsMatch(
      snapshot.catalog.policies.filter((policy) =>
        schemas.includes(policy.schemaname)
      ),
      policies.filter((policy) => schemas.includes(policy.schemaname))
    ),
    managedPoliciesMatch: rowsMatch(
      sourceManagedPolicies,
      targetManagedPolicies
    ),
    sequencesMatch: rowsMatch(
      snapshot.catalog.sequenceStates.filter((sequence) =>
        schemas.includes(sequence.schema_name)
      ),
      sequenceStates
    ),
    publicFunctionsMatch: rowsMatch(sourceFunctions, functions),
    publicTriggersMatch: rowsMatch(
      sourceTriggers,
      triggers.filter((trigger) =>
        ["public", "supabase_migrations"].includes(trigger.schema_name)
      )
    ),
    managedTriggersMatch,
    eventTriggersMatch,
    relationGrantsMatch: rowsMatch(sourceRelations, relationAcls),
    schemaGrantsMatch: rowsMatch(sourceSchemaAcls, schemaAcls),
    defaultGrantsMatch: rowsMatch(sourceDefaultAcls, defaultAcls),
    extensionsPresent,
    realtimePublicationMatch: publicationMatch,
  };
  return {
    checks,
    extensionMismatches,
  };
};

const migratedProductChecks = async (client, snapshot, qaLedger) => {
  const assignments = (
    await client.query(
      `WITH expected_batches AS (
         SELECT 'legacy-activity-batch:' || aa."activityId" AS id,
                aa."activityId" AS target_id,
                member.id AS created_by_member_id,
                min(aa."assignedAt") AS created_at
         FROM public."ActivityAssignment" aa
         LEFT JOIN public."Activity" activity ON activity.id=aa."activityId"
         LEFT JOIN public."Member" member ON member.id=activity."createdBy"
         GROUP BY aa."activityId",member.id
       ), batch_errors AS (
         SELECT count(*)::int AS count
         FROM expected_batches expected
         LEFT JOIN public."LearningAssignmentBatch" batch ON batch.id=expected.id
         WHERE batch.id IS NULL
            OR batch."targetType"::text <> 'ACTIVITY'
            OR batch."targetId" IS DISTINCT FROM expected.target_id
            OR batch."audienceType"::text <> 'SELECTED_MEMBERS'
            OR batch."createdByMemberId" IS DISTINCT FROM expected.created_by_member_id
            OR batch."createdAt" IS DISTINCT FROM expected.created_at
       ), assignment_errors AS (
         SELECT count(*)::int AS count
         FROM public."ActivityAssignment" aa
         LEFT JOIN public."Activity" activity ON activity.id=aa."activityId"
         LEFT JOIN public."Member" member ON member.id=activity."createdBy"
         WHERE aa."targetType"::text <> 'ACTIVITY'
            OR aa."targetId" IS DISTINCT FROM aa."activityId"
            OR aa."batchId" IS DISTINCT FROM ('legacy-activity-batch:' || aa."activityId")
            OR aa."assignedByMemberId" IS DISTINCT FROM member.id
       ), completion_errors AS (
         SELECT count(*)::int AS count
         FROM public."ActivityAssignment" aa
         WHERE (
           EXISTS (
             SELECT 1 FROM public."ActivitySubmission" submission
             WHERE submission."activityId"=aa."activityId"
               AND submission."memberId"=aa."memberId"
               AND submission.status::text IN ('SUBMITTED','REVIEWED')
           ) AND (
             aa.status::text <> 'COMPLETED'
             OR aa."completedAt" IS DISTINCT FROM (
               SELECT COALESCE(submitted."submittedAt",submitted."updatedAt")
               FROM public."ActivitySubmission" submitted
               WHERE submitted."activityId"=aa."activityId"
                 AND submitted."memberId"=aa."memberId"
                 AND submitted.status::text IN ('SUBMITTED','REVIEWED')
               ORDER BY submitted."updatedAt" DESC
               LIMIT 1
             )
           )
         ) OR (
           NOT EXISTS (
             SELECT 1 FROM public."ActivitySubmission" submission
             WHERE submission."activityId"=aa."activityId"
               AND submission."memberId"=aa."memberId"
               AND submission.status::text IN ('SUBMITTED','REVIEWED')
           ) AND (aa.status::text <> 'NEW' OR aa."completedAt" IS NOT NULL)
         )
       )
       SELECT
         (SELECT count(*)::int FROM public."ActivityAssignment") AS assignment_count,
         (SELECT count(*)::int FROM expected_batches) AS expected_batch_count,
         (SELECT count(*)::int FROM public."LearningAssignmentBatch") AS actual_batch_count,
         (SELECT count FROM batch_errors) AS batch_error_count,
         (SELECT count FROM assignment_errors) AS assignment_error_count,
         (SELECT count FROM completion_errors) AS completion_error_count`
    )
  ).rows[0];
  const sourceAssignmentCount = snapshot.database.rowSnapshots.find(
    (table) =>
      table.schema === PUBLIC_SCHEMA && table.table === "ActivityAssignment"
  )?.rowCount;
  const assignmentBackfillMatches =
    sourceAssignmentCount !== undefined &&
    Number(assignments.assignment_count) === sourceAssignmentCount &&
    Number(assignments.actual_batch_count) ===
      Number(assignments.expected_batch_count) &&
    Number(assignments.batch_error_count) === 0 &&
    Number(assignments.assignment_error_count) === 0 &&
    Number(assignments.completion_error_count) === 0;

  const media = (
    await client.query(
      `SELECT
         count(*) FILTER (
           WHERE kind::text='VIDEO' AND "storagePath" IS NOT NULL
             AND COALESCE(btrim("externalUrl"),'')=''
         )::int AS external_video_count,
         count(*) FILTER (
           WHERE kind::text='VIDEO' AND "storagePath" IS NOT NULL
             AND COALESCE(btrim("externalUrl"),'')=''
             AND "mediaProvider"::text='YOUTUBE'
         )::int AS youtube_provider_count,
         count(*) FILTER (
           WHERE kind::text='VIDEO' AND "storagePath" IS NOT NULL
             AND COALESCE(btrim("externalUrl"),'')=''
             AND ("mediaExternalId" IS NULL OR "mediaExternalId" ~ '^[A-Za-z0-9_-]{11}$')
         )::int AS valid_or_pending_id_count,
         count(*) FILTER (
           WHERE kind::text='VIDEO' AND "storagePath" IS NOT NULL
             AND COALESCE(btrim("externalUrl"),'')=''
             AND "mediaExternalId" IS NOT NULL
         )::int AS mapped_id_count,
         count(*) FILTER (
           WHERE kind::text='VIDEO' AND "storagePath" IS NOT NULL
             AND COALESCE(btrim("externalUrl"),'')=''
             AND "mediaExternalId" IS NULL
         )::int AS pending_id_count,
         count(*) FILTER (
           WHERE COALESCE(btrim("externalUrl"),'')<>''
             AND "mediaProvider"::text <> 'EXTERNAL_URL'
         )::int AS external_url_provider_error_count
       FROM public."LessonAsset"`
    )
  ).rows[0];
  const mediaDispositionMatches =
    Number(media.external_video_count) === 99 &&
    Number(media.youtube_provider_count) === 99 &&
    Number(media.valid_or_pending_id_count) === 99 &&
    Number(media.external_url_provider_error_count) === 0;

  const badges = (
    await client.query(
      `SELECT
         (SELECT count(*)::int FROM public."BadgeDefinition") AS definition_count,
         (SELECT count(*)::int FROM public."BadgeDefinitionRevision") AS revision_count,
         (SELECT count(*)::int FROM public."BadgeAward") AS award_count,
         (SELECT count(*)::int FROM public."StudyGoalAchievement") AS achievement_count,
         (SELECT count(*)::int FROM public."BadgeDefinition" definition
           WHERE definition.slug IN (
             'primeira-aula','cinco-horas-de-estudo','sete-dias-de-estudo',
             'primeira-meta-alcancada','vinte-e-cinco-questoes','cinco-atividades',
             'cinco-publicacoes','dez-tarefas-concluidas',
             'primeira-trilha-concluida','primeiro-encontro-presente'
           )) AS approved_seed_count`
    )
  ).rows[0];
  const rewardCounts = {};
  for (const table of ["BadgeAward", "StudyGoalAchievement"]) {
    const rows = (
      await client.query(
        `SELECT id,"memberId" FROM public.${quoteIdentifier(table)}`
      )
    ).rows;
    const tracked = new Set(qaLedger?.tables[`public.${table}`] ?? []);
    const approvedQaRows = rows.filter(
      (row) =>
        row.memberId === qaLedger?.memberId &&
        tracked.has(sha256(JSON.stringify([row.id])))
    );
    rewardCounts[table] = {
      qa: approvedQaRows.length,
      nonQa: rows.length - approvedQaRows.length,
    };
  }
  const migrationSeedDataMatches =
    Number(badges.definition_count) === 10 &&
    Number(badges.revision_count) === 10 &&
    rewardCounts.BadgeAward.nonQa === 0 &&
    rewardCounts.StudyGoalAchievement.nonQa === 0 &&
    Number(badges.approved_seed_count) === 10;

  return {
    checks: {
      assignmentBackfillMatches,
      mediaDispositionMatches,
      migrationSeedDataMatches,
    },
    assignmentCounts: {
      sourceAssignments: sourceAssignmentCount,
      actualAssignments: Number(assignments.assignment_count),
      expectedBatches: Number(assignments.expected_batch_count),
      actualBatches: Number(assignments.actual_batch_count),
      batchErrors: Number(assignments.batch_error_count),
      assignmentErrors: Number(assignments.assignment_error_count),
      completionErrors: Number(assignments.completion_error_count),
    },
    mediaCounts: {
      eligibleVideos: Number(media.external_video_count),
      youtubeProvider: Number(media.youtube_provider_count),
      validOrPendingIds: Number(media.valid_or_pending_id_count),
      pendingYouTubeIds: Number(media.pending_id_count),
      mappedYouTubeIds: Number(media.mapped_id_count),
      externalUrlProviderErrors: Number(
        media.external_url_provider_error_count
      ),
    },
    migrationSeedCounts: {
      definitions: Number(badges.definition_count),
      revisions: Number(badges.revision_count),
      awards: Number(badges.award_count),
      achievements: Number(badges.achievement_count),
      trackedQaAwards: rewardCounts.BadgeAward.qa,
      trackedQaAchievements: rewardCounts.StudyGoalAchievement.qa,
      unexpectedAwards: rewardCounts.BadgeAward.nonQa,
      unexpectedAchievements: rewardCounts.StudyGoalAchievement.nonQa,
      approvedDefinitions: Number(badges.approved_seed_count),
    },
  };
};

const migratedInfrastructureChecks = async (client, snapshot) => {
  const sourceSchemas = [PUBLIC_SCHEMA, SCHEMA_MIGRATIONS];
  const publicPolicies = (
    await client.query(
      "SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check " +
        "FROM pg_policies WHERE schemaname='public' " +
        "ORDER BY schemaname,tablename,policyname"
    )
  ).rows;
  const expectedPublicPolicies = snapshot.catalog.policies.filter(
    (policy) => policy.schemaname === PUBLIC_SCHEMA
  );

  const functions = (
    await client.query(
      "SELECT n.nspname AS schema_name,p.proname AS function_name," +
        "pg_get_function_identity_arguments(p.oid) AS identity_arguments,l.lanname AS language," +
        "p.prosecdef AS security_definer,p.provolatile AS volatility,p.proacl::text AS acl," +
        "pg_get_userbyid(p.proowner) AS owner_name," +
        "COALESCE((SELECT json_agg(jsonb_build_object(" +
        "'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END," +
        "'privilege',a.privilege_type,'grantable',a.is_grantable) " +
        "ORDER BY a.grantee,a.privilege_type) FROM aclexplode(" +
        "COALESCE(p.proacl,acldefault('f',p.proowner))) a),'[]'::json) AS acl_grants," +
        "pg_get_functiondef(p.oid) AS definition " +
        "FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace " +
        "JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='public' " +
        "ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)"
    )
  ).rows.map(({ definition, ...fn }) => ({
    ...fn,
    definition_sha256: sha256(definition),
    definition,
  }));
  const sourceFunctions = snapshot.catalog.functions.filter(
    (fn) => fn.schema_name === PUBLIC_SCHEMA
  );
  const sourceFunctionKeys = new Set(
    sourceFunctions.map(
      (fn) => `${fn.schema_name}.${fn.function_name}(${fn.identity_arguments})`
    )
  );
  const baselineFunctionsMatch = rowsMatch(
    sourceFunctions.map(({ definition: _definition, ...fn }) => fn),
    functions
      .filter((fn) =>
        sourceFunctionKeys.has(
          `${fn.schema_name}.${fn.function_name}(${fn.identity_arguments})`
        )
      )
      .map(({ definition: _definition, ...fn }) => fn)
  );
  const notificationFunction = functions.find(
    (fn) =>
      fn.function_name === "broadcast_notification_invalidation" &&
      fn.identity_arguments === ""
  );
  const notificationSettings = (
    await client.query(
      "SELECT p.proconfig AS settings FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace " +
        "WHERE n.nspname='public' AND p.proname='broadcast_notification_invalidation' AND p.pronargs=0"
    )
  ).rows[0]?.settings;
  const emptySearchPath = notificationSettings?.some(
    (setting) => setting === 'search_path=""'
  );
  const notificationFunctionSafe = Boolean(
    notificationFunction?.security_definer &&
      emptySearchPath &&
      notificationFunction.definition.includes("realtime.send") &&
      notificationFunction.definition.includes("notification.invalidate") &&
      notificationFunction.definition.includes("member-notifications:") &&
      notificationFunction.acl_grants.every(
        (grant) =>
          !(
            ["PUBLIC", "anon", "authenticated"].includes(grant.grantee) &&
            grant.privilege === "EXECUTE"
          )
      )
  );

  const triggers = (
    await client.query(
      "SELECT n.nspname AS schema_name,c.relname AS table_name,t.tgname AS trigger_name," +
        "t.tgenabled AS enabled,pn.nspname AS function_schema,p.proname AS function_name," +
        "t.tgtype::int AS trigger_type," +
        "pg_get_triggerdef(t.oid,true) AS definition " +
        "FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid " +
        "JOIN pg_namespace n ON n.oid=c.relnamespace " +
        "JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace " +
        "WHERE NOT t.tgisinternal AND n.nspname=ANY($1::text[]) " +
        "ORDER BY n.nspname,c.relname,t.tgname",
      [[PUBLIC_SCHEMA, SCHEMA_MIGRATIONS]]
    )
  ).rows;
  const expectedSourceTriggers = snapshot.catalog.triggers.filter((trigger) =>
    sourceSchemas.includes(trigger.schema_name)
  );
  const sourceTriggerKeys = new Set(
    expectedSourceTriggers.map(
      (trigger) =>
        `${trigger.schema_name}.${trigger.table_name}.${trigger.trigger_name}`
    )
  );
  const baselineTriggersMatch = rowsMatch(
    expectedSourceTriggers,
    triggers
      .filter((trigger) =>
        sourceTriggerKeys.has(
          `${trigger.schema_name}.${trigger.table_name}.${trigger.trigger_name}`
        )
      )
      .map(({ trigger_type: _triggerType, ...trigger }) => trigger)
  );
  const notificationTrigger = triggers.filter(
    (trigger) => trigger.trigger_name === "Notification_broadcast_invalidation"
  );
  const notificationTriggerMatches =
    notificationTrigger.length === 1 &&
    notificationTrigger[0].schema_name === PUBLIC_SCHEMA &&
    notificationTrigger[0].table_name === "Notification" &&
    notificationTrigger[0].enabled === "O" &&
    notificationTrigger[0].function_schema === PUBLIC_SCHEMA &&
    notificationTrigger[0].function_name ===
      "broadcast_notification_invalidation" &&
    hasTriggerBit(notificationTrigger[0].trigger_type, 1) &&
    !hasTriggerBit(notificationTrigger[0].trigger_type, 2) &&
    !hasTriggerBit(notificationTrigger[0].trigger_type, 64) &&
    hasTriggerBit(notificationTrigger[0].trigger_type, 4) &&
    hasTriggerBit(notificationTrigger[0].trigger_type, 8) &&
    hasTriggerBit(notificationTrigger[0].trigger_type, 16) &&
    !hasTriggerBit(notificationTrigger[0].trigger_type, 32);

  const eventTriggers = (
    await client.query(
      "SELECT e.evtname AS name,e.evtevent AS event,e.evtenabled AS enabled," +
        "e.evttags AS tags,n.nspname AS function_schema,p.proname AS function_name," +
        "pg_get_function_identity_arguments(p.oid) AS identity_arguments " +
        "FROM pg_event_trigger e JOIN pg_proc p ON p.oid=e.evtfoid " +
        "JOIN pg_namespace n ON n.oid=p.pronamespace ORDER BY e.evtname"
    )
  ).rows;
  const sourceEventTriggers = snapshot.catalog.eventTriggers.filter(
    (trigger) => trigger.function_schema === PUBLIC_SCHEMA
  );
  const targetEventTriggerByName = new Map(
    eventTriggers.map((trigger) => [trigger.name, trigger])
  );
  const sourceEventTriggersMatch = sourceEventTriggers.every((trigger) => {
    const actual = targetEventTriggerByName.get(trigger.name);
    return actual && sameEventTriggerDefinition(trigger, actual);
  });

  const realtimeNotificationPolicy = (
    await client.query(
      "SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check " +
        "FROM pg_policies WHERE schemaname='realtime' AND tablename='messages' " +
        "AND policyname='Member can join own notification channel'"
    )
  ).rows[0];
  const realtimeNotificationPolicySafe = Boolean(
    realtimeNotificationPolicy &&
      realtimeNotificationPolicy.cmd === "SELECT" &&
      realtimeNotificationPolicy.roles.includes("authenticated") &&
      realtimeNotificationPolicy.qual?.includes("realtime.topic") &&
      realtimeNotificationPolicy.qual?.includes("auth.jwt") &&
      realtimeNotificationPolicy.qual?.includes("member-notifications:") &&
      realtimeNotificationPolicy.qual?.includes("broadcast")
  );
  const realtimePolicyNames = (
    await client.query(
      "SELECT policyname FROM pg_policies WHERE schemaname='realtime' " +
        "AND tablename='messages' ORDER BY policyname"
    )
  ).rows.map((policy) => policy.policyname);
  const expectedRealtimePolicyNames = [
    "Authenticated members can read community presence",
    "Authenticated members can write community presence",
    "Member can join own notification channel",
  ].sort();

  const publication = (
    await client.query(
      "SELECT p.pubname AS publication,p.puballtables AS all_tables," +
        "p.pubinsert AS publishes_insert,p.pubupdate AS publishes_update," +
        "p.pubdelete AS publishes_delete,p.pubtruncate AS publishes_truncate," +
        "p.pubviaroot AS publishes_via_root," +
        "COALESCE(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname) " +
        "ORDER BY n.nspname,c.relname) FILTER (WHERE c.oid IS NOT NULL),'[]'::jsonb) AS tables " +
        "FROM pg_publication p LEFT JOIN pg_publication_rel pr ON pr.prpubid=p.oid " +
        "LEFT JOIN pg_class c ON c.oid=pr.prrelid " +
        "LEFT JOIN pg_namespace n ON n.oid=c.relnamespace " +
        "WHERE p.pubname='supabase_realtime' " +
        "GROUP BY p.pubname,p.puballtables,p.pubinsert,p.pubupdate," +
        "p.pubdelete,p.pubtruncate,p.pubviaroot"
    )
  ).rows[0];
  const sourcePublication = snapshot.catalog.publications.find(
    (item) => item.publication === "supabase_realtime"
  );
  const publicationMatches = Boolean(
    sourcePublication &&
      publication &&
      rowsMatch([sourcePublication], [publication])
  );

  const extensions = (
    await client.query(
      "SELECT e.extname AS name,e.extversion AS version,n.nspname AS schema_name " +
        "FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace"
    )
  ).rows;
  const extensionByName = new Map(
    extensions.map((extension) => [extension.name, extension])
  );
  const extensionsMatch = snapshot.catalog.extensions.every((expected) => {
    const actual = extensionByName.get(expected.name);
    return (
      actual &&
      actual.version === expected.version &&
      actual.schema_name === expected.schema_name
    );
  });

  const schemas = (
    await client.query(
      "SELECT n.nspname AS schema_name,pg_get_userbyid(n.nspowner) AS owner_name," +
        "n.nspacl::text AS acl FROM pg_namespace n " +
        "WHERE n.nspname=ANY($1::text[]) ORDER BY n.nspname",
      [sourceSchemas]
    )
  ).rows;
  const relationAcls = (
    await client.query(
      "SELECT n.nspname AS schema_name,c.relname AS relation_name,c.relkind AS kind," +
        "c.relacl::text AS acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace " +
        "WHERE n.nspname=ANY($1::text[]) AND c.relkind IN ('r','p','v','m','S') " +
        "ORDER BY n.nspname,c.relname",
      [sourceSchemas]
    )
  ).rows;
  const defaults = (
    await client.query(
      "SELECT n.nspname AS schema_name,pg_get_userbyid(d.defaclrole) AS owner_name," +
        "d.defaclobjtype AS object_type,d.defaclacl::text AS acl " +
        "FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace " +
        "WHERE n.nspname=ANY($1::text[]) " +
        "ORDER BY n.nspname,owner_name,d.defaclobjtype",
      [sourceSchemas]
    )
  ).rows;
  const sourceRelations = snapshot.catalog.relationAcls.filter((row) =>
    sourceSchemas.includes(row.schema_name)
  );
  const sourceRelationKeys = new Set(
    sourceRelations.map((row) => `${row.schema_name}.${row.relation_name}`)
  );
  const existingRelationAclsMatch = rowsMatch(
    sourceRelations,
    relationAcls.filter((row) =>
      sourceRelationKeys.has(`${row.schema_name}.${row.relation_name}`)
    )
  );
  const sourceSchemasAcls = snapshot.catalog.schemaAcls.filter((row) =>
    sourceSchemas.includes(row.schema_name)
  );
  const sourceDefaultAcls = snapshot.catalog.defaultAcls.filter((row) =>
    sourceSchemas.includes(row.schema_name)
  );
  const grantsMatch =
    rowsMatch(sourceSchemasAcls, schemas) &&
    existingRelationAclsMatch &&
    rowsMatch(sourceDefaultAcls, defaults);
  const legacyPublicTables = snapshot.database.rowSnapshots
    .filter((table) => table.schema === PUBLIC_SCHEMA)
    .map((table) => table.table);
  const clientRoleGrantsOnNewTables = (
    await client.query(
      "SELECT count(*)::int AS count FROM information_schema.role_table_grants " +
        "WHERE table_schema='public' AND table_name <> ALL($1::text[]) " +
        "AND lower(grantee) IN ('public','anon','authenticated') " +
        "AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')",
      [legacyPublicTables]
    )
  ).rows[0].count;
  const clientRoleGrantsAbsent = Number(clientRoleGrantsOnNewTables) === 0;

  return {
    checks: {
      publicPoliciesMatch: rowsMatch(expectedPublicPolicies, publicPolicies),
      sourcePublicFunctionsMatch: baselineFunctionsMatch,
      notificationFunctionSafe,
      sourceTriggersMatch: baselineTriggersMatch,
      notificationTriggerMatches,
      sourceEventTriggersMatch,
      realtimeNotificationPolicySafe,
      realtimePolicyNamesMatch:
        JSON.stringify(expectedRealtimePolicyNames) ===
        JSON.stringify(realtimePolicyNames),
      realtimePublicationMatches: publicationMatches,
      extensionsMatch,
      preMigrationGrantsPreserved: grantsMatch,
      newTablesHaveNoClientGrants: clientRoleGrantsAbsent,
    },
  };
};

const arrayDifference = (left, right) => {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
};

const auditForeignKeys = async (client) => {
  const keys = (
    await client.query(
      "SELECT c.conname AS name,n.nspname AS schema_name,t.relname AS table_name," +
        "rn.nspname AS referenced_schema,rt.relname AS referenced_table," +
        "json_agg(a.attname ORDER BY k.ord) AS columns,json_agg(ra.attname ORDER BY k.ord) AS referenced_columns " +
        "FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace " +
        "JOIN pg_class rt ON rt.oid=c.confrelid JOIN pg_namespace rn ON rn.oid=rt.relnamespace " +
        "CROSS JOIN LATERAL unnest(c.conkey,c.confkey) WITH ORDINALITY k(child,parent,ord) " +
        "JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.child " +
        "JOIN pg_attribute ra ON ra.attrelid=rt.oid AND ra.attnum=k.parent " +
        "WHERE n.nspname='public' AND c.contype='f' GROUP BY c.oid,c.conname,n.nspname,t.relname,rn.nspname,rt.relname ORDER BY c.conname"
    )
  ).rows;
  const violations = [];
  for (const fk of keys) {
    const conditions = fk.columns
      .map(
        (column, index) =>
          `child.${quoteIdentifier(column)}=parent.${quoteIdentifier(fk.referenced_columns[index])}`
      )
      .join(" AND ");
    const nonnull = fk.columns
      .map((column) => `child.${quoteIdentifier(column)} IS NOT NULL`)
      .join(" AND ");
    const count = Number(
      (
        await client.query(
          `SELECT count(*)::text AS count FROM ${quoteIdentifier(fk.schema_name)}.${quoteIdentifier(fk.table_name)} child WHERE ${nonnull} AND NOT EXISTS (SELECT 1 FROM ${quoteIdentifier(fk.referenced_schema)}.${quoteIdentifier(fk.referenced_table)} parent WHERE ${conditions})`
        )
      ).rows[0].count
    );
    if (count) {
      violations.push({ constraint: fk.name, count });
    }
  }
  return { checked: keys.length, violations };
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This read-only validator aggregates all gates in one repeatable-read snapshot and emits one machine-readable report.
const main = async () => {
  const stage = process.argv[2];
  const snapshotPath = process.argv[3];
  if (
    !(["restored-data", "restored", "migrated"].includes(stage) && snapshotPath)
  ) {
    fail(
      "Usage: bun run scripts/migration/validate-supabase-green.mjs <restored-data|restored|migrated> <DPAPI-source-snapshot>"
    );
  }
  if (!(fs.existsSync(CREDENTIAL_FILE) && fs.existsSync(CA_FILE))) {
    fail("Protected green credential or Supabase CA certificate is missing.");
  }
  const snapshot = readSnapshot(snapshotPath);
  const qaLedger = stage === "migrated" ? loadQaLedger() : null;
  if (
    qaLedger &&
    snapshot.database.rowSnapshots
      .find((t) => t.schema === "public" && t.table === "Member")
      .perRowHashes.some(
        (row) =>
          row.identitySha256 === sha256(JSON.stringify([qaLedger.memberId]))
      )
  ) {
    fail("QA identity must not belong to the source snapshot.");
  }
  const localMigrations = getMigrationFiles();
  const require = createRequire(DATABASE_PACKAGE);
  const { Client } = require("pg");
  const credential = unprotectWithDpapi(fs.readFileSync(CREDENTIAL_FILE));
  const url = parseGreenSessionPoolerUrl(credential.toString("utf8"));
  credential.fill(0);

  let client;
  let transactionOpen = false;
  try {
    client = new Client({
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: true, ca: fs.readFileSync(CA_FILE, "utf8") },
      options: "-c default_transaction_read_only=on",
      connectionTimeoutMillis: 15_000,
    });
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;
    const facts = (
      await client.query(
        "SELECT current_setting('transaction_read_only') AS read_only," +
          "current_setting('server_version') AS server_version," +
          "current_database() AS database_name,pg_database_size(current_database())::text AS database_bytes"
      )
    ).rows[0];
    if (facts.read_only !== "on" || facts.database_name !== "postgres") {
      fail(
        "Green validation did not run against the expected read-only database."
      );
    }

    const sourceTableKeys = snapshot.database.rowSnapshots.map(
      (table) => `${table.schema}.${table.table}`
    );
    const targetTableRows = (
      await client.query(
        "SELECT table_schema,table_name FROM information_schema.tables " +
          "WHERE table_schema=ANY($1::text[]) AND table_type='BASE TABLE' " +
          "ORDER BY table_schema,table_name",
        [[PUBLIC_SCHEMA, SCHEMA_MIGRATIONS]]
      )
    ).rows;
    const targetTableKeys = targetTableRows.map(
      (table) => `${table.table_schema}.${table.table_name}`
    );
    const targetRowCounts = [];
    for (const table of targetTableRows) {
      const count = Number(
        (
          await client.query(
            `SELECT count(*)::text AS count FROM ${quoteIdentifier(table.table_schema)}.${quoteIdentifier(table.table_name)}`
          )
        ).rows[0].count
      );
      targetRowCounts.push({
        table: `${table.table_schema}.${table.table_name}`,
        count,
      });
    }
    const foreignKeyIntegrity = await auditForeignKeys(client);
    const excluded = stage === "migrated" ? [`public.${MIGRATION_TABLE}`] : [];
    const expectedRestoredTables = sourceTableKeys.filter(
      (key) => !excluded.includes(key)
    );
    const modelNames = namesFromSchema(MODEL_DECLARATION);
    const expectedMigratedTables = [
      ...modelNames.map((name) => `public.${name}`),
      `public.${MIGRATION_TABLE}`,
      ...sourceTableKeys.filter((key) =>
        key.startsWith(`${SCHEMA_MIGRATIONS}.`)
      ),
    ].sort();
    const expectedTableKeys =
      stage === "migrated"
        ? expectedMigratedTables
        : expectedRestoredTables.sort();
    const missingTables = arrayDifference(expectedTableKeys, targetTableKeys);
    const unexpectedTables = arrayDifference(
      targetTableKeys,
      expectedTableKeys
    );
    const tableSetMatches =
      missingTables.length === 0 && unexpectedTables.length === 0;

    const sourceColumnsByTable = new Map();
    for (const column of snapshot.database.columns) {
      const key = `${column.table_schema}.${column.table_name}`;
      const columns = sourceColumnsByTable.get(key) ?? [];
      columns.push({
        name: column.column_name,
        ordinal: column.ordinal_position,
      });
      sourceColumnsByTable.set(key, columns);
    }
    for (const columns of sourceColumnsByTable.values()) {
      columns.sort((left, right) => left.ordinal - right.ordinal);
    }

    const rowMismatches = [];
    let preservedRows = 0;
    for (const sourceTable of snapshot.database.rowSnapshots) {
      const key = `${sourceTable.schema}.${sourceTable.table}`;
      if (excluded.includes(key)) {
        continue;
      }
      if (!targetTableKeys.includes(key)) {
        rowMismatches.push(key);
        continue;
      }
      const columns = (sourceColumnsByTable.get(key) ?? []).map(
        (column) => column.name
      );
      const actual = await migrationRowHashes(client, sourceTable, columns);
      const qaIdentities = qaLedger?.tables[key] ?? [];
      if (
        sourceTable.perRowHashes.some((row) =>
          qaIdentities.includes(row.identitySha256)
        )
      ) {
        fail("QA ledger attempted to exclude a source record.");
      }
      actual.perRowHashes = actual.perRowHashes.filter(
        (row) => !qaIdentities.includes(row.identitySha256)
      );
      actual.rowCount = actual.perRowHashes.length;
      if (
        actual.rowCount !== sourceTable.rowCount ||
        !comparePerRowHashes(sourceTable.perRowHashes, actual.perRowHashes)
      ) {
        rowMismatches.push(key);
      } else {
        preservedRows += actual.rowCount;
      }
    }

    const catalog = (
      await client.query(
        "SELECT count(*) FILTER (WHERE c.relkind IN ('r','p'))::int AS public_table_count," +
          "count(*) FILTER (WHERE c.relkind IN ('r','p') AND c.relrowsecurity)::int AS rls_enabled_count," +
          "count(*) FILTER (WHERE c.relkind IN ('r','p') AND NOT c.relrowsecurity)::int AS rls_disabled_count " +
          "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace " +
          "WHERE n.nspname='public'"
      )
    ).rows[0];
    const invalidState = (
      await client.query(
        "SELECT " +
          "(SELECT count(*)::int FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid " +
          "JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND NOT c.convalidated) AS unvalidated_constraints," +
          "(SELECT count(*)::int FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid " +
          "JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND (NOT i.indisvalid OR NOT i.indisready)) AS invalid_indexes," +
          "(SELECT count(*)::int FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid " +
          "JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND c.contype='f') AS foreign_key_count"
      )
    ).rows[0];
    const migratedChecks =
      stage === "migrated"
        ? await migratedProductChecks(client, snapshot, qaLedger)
        : null;
    const migratedInfrastructure =
      stage === "migrated"
        ? await migratedInfrastructureChecks(client, snapshot)
        : null;
    const enumRows = (
      await client.query(
        "SELECT t.typname AS type_name,json_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels " +
          "FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace " +
          "JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' " +
          "GROUP BY t.typname ORDER BY t.typname"
      )
    ).rows;
    const expectedEnums =
      stage === "migrated"
        ? enumsFromSchema().map((type) => ({
            type_name: type.name,
            labels: type.labels,
          }))
        : snapshot.catalog.enumTypes
            .filter((type) => type.schema_name === "public")
            .map((type) => ({
              type_name: type.type_name,
              labels: type.labels,
            }));
    const actualEnumNames = enumRows.map((type) => type.type_name).sort();
    const enumSetMatches =
      JSON.stringify(
        expectedEnums
          .map((type) => ({
            type_name: type.type_name,
            labels: type.labels,
          }))
          .sort((left, right) => left.type_name.localeCompare(right.type_name))
      ) ===
      JSON.stringify(
        enumRows
          .map((type) => ({
            type_name: type.type_name,
            labels: type.labels,
          }))
          .sort((left, right) => left.type_name.localeCompare(right.type_name))
      );
    const realtimePolicies = (
      await client.query(
        "SELECT policyname FROM pg_policies WHERE schemaname='realtime' " +
          "AND tablename='messages' ORDER BY policyname"
      )
    ).rows.map((policy) => policy.policyname);
    const expectedRealtimePolicies =
      stage === "migrated"
        ? [
            "Authenticated members can read community presence",
            "Authenticated members can write community presence",
            "Member can join own notification channel",
          ].sort()
        : snapshot.catalog.managedPolicies
            .filter(
              (policy) =>
                policy.schemaname === "realtime" &&
                policy.tablename === "messages"
            )
            .map((policy) => policy.policyname)
            .sort();
    const realtimePoliciesMatch =
      stage === "restored-data" ||
      JSON.stringify(expectedRealtimePolicies) ===
        JSON.stringify(realtimePolicies);
    const catalogValidation =
      stage === "migrated"
        ? null
        : await restoredCatalogChecks(client, snapshot);
    const preConfigCatalogChecks = new Set([
      "columnsMatch",
      "constraintsMatch",
      "indexesMatch",
      "publicPoliciesMatch",
      "sequencesMatch",
      "publicFunctionsMatch",
      "publicTriggersMatch",
      "relationGrantsMatch",
      "schemaGrantsMatch",
      "defaultGrantsMatch",
    ]);
    let catalogChecksRequired = true;
    if (stage === "restored-data") {
      catalogChecksRequired = Object.entries(catalogValidation.checks)
        .filter(([name]) => preConfigCatalogChecks.has(name))
        .every(([, matches]) => matches);
    } else if (stage === "restored") {
      catalogChecksRequired = Object.values(catalogValidation.checks).every(
        Boolean
      );
    }

    const migrationRows = (
      await client.query(
        "SELECT migration_name,checksum,finished_at::text,rolled_back_at::text," +
          'applied_steps_count::text FROM public."_prisma_migrations" ' +
          "ORDER BY migration_name,started_at"
      )
    ).rows.map((row) => ({
      migrationName: row.migration_name,
      checksum: row.checksum,
      finishedAt: row.finished_at,
      rolledBackAt: row.rolled_back_at,
      appliedStepsCount: row.applied_steps_count,
    }));
    const migrationState = reconcilePrismaMigrationLedger(
      migrationRows,
      localMigrations
    );
    const migrationStateMatches =
      stage !== "migrated"
        ? migrationState.applied.length === 30 &&
          migrationState.pending.length === localMigrations.length - 30
        : migrationState.applied.length === localMigrations.length &&
          migrationState.pending.length === 0;
    const expectedCatalogShape =
      stage === "migrated"
        ? modelNames.length + 1 === Number(catalog.public_table_count) &&
          namesFromSchema(ENUM_DECLARATION).length === actualEnumNames.length &&
          Number(invalidState.foreign_key_count) === 126
        : Number(catalog.public_table_count) ===
          targetTableKeys.filter((key) => key.startsWith("public.")).length;
    const catalogHealthy =
      Number(facts.database_bytes) <= 100_000_000 &&
      Number(catalog.rls_disabled_count) === 0 &&
      Number(catalog.rls_enabled_count) ===
        Number(catalog.public_table_count) &&
      Number(invalidState.unvalidated_constraints) === 0 &&
      Number(invalidState.invalid_indexes) === 0;
    const ok =
      tableSetMatches &&
      rowMismatches.length === 0 &&
      enumSetMatches &&
      realtimePoliciesMatch &&
      catalogChecksRequired &&
      migrationStateMatches &&
      expectedCatalogShape &&
      foreignKeyIntegrity.violations.length === 0 &&
      catalogHealthy &&
      (migratedChecks === null ||
        Object.values(migratedChecks.checks).every(Boolean)) &&
      (migratedInfrastructure === null ||
        Object.values(migratedInfrastructure.checks).every(Boolean));

    await client.query("ROLLBACK");
    transactionOpen = false;
    process.stdout.write(
      `${JSON.stringify({
        ok,
        stage,
        projectRef: GREEN_REF,
        transactionReadOnly: true,
        tls: "verify-full",
        serverVersion: facts.server_version,
        databaseBytes: Number(facts.database_bytes),
        databaseSizeWithinOperationalBudget:
          Number(facts.database_bytes) <= 100_000_000,
        sourceSnapshotIdSha256: snapshot.connection.snapshotIdSha256,
        expectedTableCount: expectedTableKeys.length,
        actualTableCount: targetTableKeys.length,
        tableSetMatches,
        missingTables,
        unexpectedTables,
        sourceRowsVerified: preservedRows,
        totalTargetRows: targetRowCounts.reduce(
          (sum, table) => sum + table.count,
          0
        ),
        targetRowCounts,
        foreignKeyIntegrity,
        rowHashMismatches: rowMismatches,
        publicEnumCount: actualEnumNames.length,
        enumSetMatches,
        foreignKeyCount: Number(invalidState.foreign_key_count),
        unvalidatedConstraints: Number(invalidState.unvalidated_constraints),
        invalidIndexes: Number(invalidState.invalid_indexes),
        rlsEnabledTables: Number(catalog.rls_enabled_count),
        rlsDisabledTables: Number(catalog.rls_disabled_count),
        realtimePolicies,
        realtimePoliciesMatch,
        catalogChecks: catalogValidation?.checks ?? null,
        catalogCheckFailures: catalogValidation
          ? Object.entries(catalogValidation.checks)
              .filter(([, matches]) => !matches)
              .map(([name]) => name)
          : [],
        extensionMismatches: catalogValidation?.extensionMismatches ?? [],
        migratedProductChecks: migratedChecks?.checks ?? null,
        assignmentCounts: migratedChecks?.assignmentCounts ?? null,
        mediaCounts: migratedChecks?.mediaCounts ?? null,
        migrationSeedCounts: migratedChecks?.migrationSeedCounts ?? null,
        migratedInfrastructureChecks: migratedInfrastructure?.checks ?? null,
        prismaApplied: migrationState.applied.length,
        prismaPending: migrationState.pending,
        prismaMigrationChecksumsMatch: true,
        migrationStateMatches,
      })}\n`
    );
    if (!ok) {
      process.exitCode = 3;
    }
  } finally {
    if (transactionOpen && client) {
      await client.query("ROLLBACK").catch(() => undefined);
    }
    await client?.end().catch(() => undefined);
  }
};

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown green validation error";
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: message
        .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[connection URI redacted]")
        .replace(/password\s*[:=]\s*[^\s]+/gi, "password=[redacted]")
        .slice(0, 1200),
    })}\n`
  );
  process.exitCode = 2;
});
