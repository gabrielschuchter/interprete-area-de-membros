#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
/**
 * Read-only source snapshot: row/primary-key hashes, important PostgreSQL
 * catalog definitions, and an exact Storage-object reference allowlist.
 * The manifest is DPAPI-encrypted outside the repository; row values are
 * hashed in memory and never written to disk or logged.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { compactJsonText } from "../lib/postgres-archive-validation.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SOURCE_REF = "wkclodjbrynerfgufmyb";
const GREEN_REF = "qffqhilydtnrggbcnogh";
const DB_PACKAGE = path.join(ROOT, "packages/database/package.json");
const ENV_FILE = path.join(ROOT, "packages/database/.env");
const CA_FILE = path.join(
  ROOT,
  "packages/database/certs/supabase-prod-ca-2021.crt"
);
const OUT_DIR = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Codex/migrations/interprete-supabase"
);
const SCHEMAS = ["public", "supabase_migrations"];
const CATALOG_SCHEMAS = [
  "public",
  "supabase_migrations",
  "auth",
  "storage",
  "realtime",
  "extensions",
  "vault",
  "graphql",
  "graphql_public",
];
const SNAPSHOT_ID = /^[A-Fa-f0-9-]+$/;
const WINDOWS_SID = /S-1-[0-9-]+/i;
const TIMESTAMP_SEPARATORS = /[-:]/g;
const TIMESTAMP_MILLISECONDS = /\.\d{3}Z$/;
const quote = (value) => `"${value.replaceAll('"', '""')}"`;
const sharedSnapshotId = process.argv[2] ?? null;

function fail(message) {
  throw new Error(message);
}

function protectWithDpapi(bytes) {
  const command =
    "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; " +
    "$b=[Convert]::FromBase64String([Console]::In.ReadLine()); " +
    "$o=[Security.Cryptography.ProtectedData]::Protect($b,$null," +
    "[Security.Cryptography.DataProtectionScope]::CurrentUser); " +
    "[Console]::Out.Write([Convert]::ToBase64String($o))";
  const result = spawnSync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
    {
      input: Buffer.from(`${bytes.toString("base64")}\n`),
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    }
  );
  if (result.status !== 0 || !result.stdout?.trim()) {
    fail("Windows DPAPI could not protect the source manifest.");
  }
  return Buffer.from(result.stdout.trim(), "base64");
}

function restrictToCurrentUser(target, rights) {
  const result = spawnSync(
    "icacls.exe",
    [target, "/inheritance:r", "/grant:r", rights],
    {
      encoding: "utf8",
      windowsHide: true,
    }
  );
  if (result.status !== 0) {
    fail("Could not restrict access to source inventory artifacts.");
  }
}

function candidatesFor(name) {
  return [
    ...new Set([
      name,
      name
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/"),
      encodeURIComponent(name),
    ]),
  ];
}

function referenceCandidates(value, candidates, matches) {
  if (typeof value === "string") {
    for (const candidate of candidates) {
      if (candidate && value.includes(candidate)) {
        matches.add(candidate);
      }
    }
  } else if (Array.isArray(value)) {
    for (const child of value) {
      referenceCandidates(child, candidates, matches);
    }
  } else if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      referenceCandidates(child, candidates, matches);
    }
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Catalog reads and row hashes must remain inside one read-only snapshot; the linear inventory manifest is reviewed as a single audit artifact.
async function main() {
  if (process.platform !== "win32" || !process.env.LOCALAPPDATA) {
    fail("A Windows user profile is required for DPAPI-protected inventory.");
  }
  if (!(fs.existsSync(ENV_FILE) && fs.existsSync(CA_FILE))) {
    fail("Ignored database env file or Supabase CA certificate is missing.");
  }
  const require = createRequire(DB_PACKAGE);
  const dotenv = require("dotenv");
  const { Client } = require("pg");
  const localEnv = dotenv.parse(fs.readFileSync(ENV_FILE));
  if (!localEnv.DIRECT_URL) {
    fail("DIRECT_URL is missing from the ignored database env file.");
  }

  const url = new URL(localEnv.DIRECT_URL);
  if (
    decodeURIComponent(url.username) !== `postgres.${SOURCE_REF}` ||
    url.hostname.includes(GREEN_REF)
  ) {
    fail(
      "Source project guard failed; refusing to query an unexpected database."
    );
  }
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
    url.searchParams.delete(key);
  }
  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, ca: fs.readFileSync(CA_FILE, "utf8") },
    options: "-c default_transaction_read_only=on",
    connectionTimeoutMillis: 15_000,
  });
  if (sharedSnapshotId && !SNAPSHOT_ID.test(sharedSnapshotId)) {
    fail("The imported PostgreSQL snapshot identifier has an invalid format.");
  }
  const sidText = execFileSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const sid = sidText.match(WINDOWS_SID)?.[0];
  if (!sid) {
    fail("Could not resolve the current Windows user SID.");
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  restrictToCurrentUser(OUT_DIR, `*${sid}:(OI)(CI)(F)`);

  const createdAt = new Date().toISOString();
  const stamp = createdAt
    .replace(TIMESTAMP_SEPARATORS, "")
    .replace(TIMESTAMP_MILLISECONDS, "Z");
  const outputPath = path.join(OUT_DIR, `source-snapshot-${stamp}.json.dpapi`);
  if (fs.existsSync(outputPath)) {
    fail("Refusing to overwrite a prior source snapshot.");
  }
  let transactionOpen = false;
  try {
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;
    if (sharedSnapshotId) {
      await client.query(`SET TRANSACTION SNAPSHOT '${sharedSnapshotId}'`);
    }
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    const server = (
      await client.query(
        "SELECT current_setting('server_version') AS server_version, " +
          "current_setting('transaction_read_only') AS transaction_read_only, " +
          "current_database() AS database_name, pg_database_size(current_database())::text AS database_bytes, " +
          "pg_encoding_to_char(encoding) AS encoding FROM pg_database WHERE datname=current_database()"
      )
    ).rows[0];
    if (server.transaction_read_only !== "on") {
      fail("PostgreSQL did not confirm read-only mode.");
    }

    const relations = (
      await client.query(
        "SELECT n.nspname AS schema_name,c.relname AS relation_name,c.relkind AS kind," +
          "c.relrowsecurity AS row_security,c.relforcerowsecurity AS force_row_security," +
          "c.relispartition AS is_partition,pg_total_relation_size(c.oid)::text AS total_bytes " +
          "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace " +
          "WHERE n.nspname=ANY($1::text[]) AND c.relkind IN ('r','p','v','m','S','f') " +
          "ORDER BY n.nspname,c.relname",
        [SCHEMAS]
      )
    ).rows;
    const primaryKeys = (
      await client.query(
        "SELECT n.nspname AS schema_name,c.relname AS table_name," +
          "json_agg(a.attname ORDER BY k.ordinality) AS columns " +
          "FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid " +
          "JOIN pg_namespace n ON n.oid=c.relnamespace " +
          "JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum,ordinality) ON true " +
          "JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.attnum " +
          "WHERE i.indisprimary AND n.nspname=ANY($1::text[]) " +
          "GROUP BY n.nspname,c.relname ORDER BY n.nspname,c.relname",
        [SCHEMAS]
      )
    ).rows;
    const pkMap = new Map(
      primaryKeys.map((row) => [
        `${row.schema_name}.${row.table_name}`,
        row.columns,
      ])
    );
    const storage = (
      await client.query(
        "SELECT o.id::text AS object_id,o.bucket_id AS bucket,o.name AS path," +
          "NULLIF(o.metadata->>'size','')::numeric::text AS size_bytes," +
          "COALESCE(o.metadata->>'mimetype',o.metadata->>'mimeType') AS mime_type," +
          "o.metadata,o.user_metadata,o.owner_id,o.created_at,o.updated_at,o.last_accessed_at " +
          "FROM storage.objects o ORDER BY o.bucket_id,o.name"
      )
    ).rows.map((row) => ({
      originalObjectId: row.object_id,
      bucket: row.bucket,
      path: row.path,
      sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
      mimeType: row.mime_type,
      metadata: row.metadata,
      userMetadata: row.user_metadata,
      ownerId: row.owner_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastAccessedAt: row.last_accessed_at,
      referencedBy: new Set(),
      evidence: new Set(),
    }));
    const patterns = new Map();
    for (const object of storage) {
      for (const pattern of candidatesFor(object.path)) {
        const owners = patterns.get(pattern) ?? [];
        owners.push(object);
        patterns.set(pattern, owners);
      }
    }

    const rowSnapshots = [];
    let totalRows = 0;
    const productTables = relations.filter(
      (item) => ["r", "p"].includes(item.kind) && !item.is_partition
    );
    for (const table of productTables) {
      const tableKey = `${table.schema_name}.${table.relation_name}`;
      const columns = pkMap.get(tableKey) ?? [];
      const tableSql = `${quote(table.schema_name)}.${quote(table.relation_name)}`;
      const pkExpr = columns.length
        ? "jsonb_build_array(" +
          columns.map((column) => `t.${quote(column)}`).join(",") +
          ")::text"
        : "NULL::text";
      const orderExpr = columns.length
        ? `(${pkExpr}) COLLATE "C"`
        : 'row_json COLLATE "C"';
      const rows = (
        await client.query(
          "SELECT row_to_json(t)::text AS row_json," +
            pkExpr +
            " AS pk_json FROM " +
            tableSql +
            " t ORDER BY " +
            orderExpr
        )
      ).rows;
      const rowHash = crypto.createHash("sha256");
      const pkHash = crypto.createHash("sha256");
      const perRowHashes = [];
      for (const row of rows) {
        const canonicalRow = compactJsonText(row.row_json);
        rowHash.update(canonicalRow).update("\n");
        const rowSha256 = crypto
          .createHash("sha256")
          .update(canonicalRow)
          .digest("hex");
        const identitySha256 = columns.length
          ? crypto.createHash("sha256").update(row.pk_json).digest("hex")
          : rowSha256;
        perRowHashes.push({ identitySha256, rowSha256 });
        if (row.pk_json !== null) {
          pkHash.update(row.pk_json).update("\n");
        }
        const parsed = JSON.parse(row.row_json);
        for (const [pattern, owners] of patterns) {
          const matches = new Set();
          referenceCandidates(parsed, [pattern], matches);
          if (matches.size) {
            for (const object of owners) {
              object.referencedBy.add(tableKey);
              object.evidence.add(
                pattern === object.path ? "raw-path" : "URL-encoded-path"
              );
            }
          }
        }
      }
      totalRows += rows.length;
      rowSnapshots.push({
        schema: table.schema_name,
        table: table.relation_name,
        rowCount: rows.length,
        primaryKeyColumns: columns,
        primaryKeySetSha256: columns.length ? pkHash.digest("hex") : null,
        canonicalRowSha256: rowHash.digest("hex"),
        perRowHashes,
      });
    }
    const columns = (
      await client.query(
        "SELECT table_schema,table_name,column_name,ordinal_position,data_type,udt_name," +
          "is_nullable,column_default,is_identity,identity_generation " +
          "FROM information_schema.columns WHERE table_schema=ANY($1::text[]) " +
          "ORDER BY table_schema,table_name,ordinal_position",
        [SCHEMAS]
      )
    ).rows;
    const constraints = (
      await client.query(
        "SELECT n.nspname AS schema_name,c.relname AS table_name,con.conname AS name," +
          "con.contype AS type,con.convalidated AS validated,pg_get_constraintdef(con.oid,true) AS definition " +
          "FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid " +
          "JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1::text[]) " +
          "ORDER BY n.nspname,c.relname,con.conname",
        [SCHEMAS]
      )
    ).rows;
    const indexes = (
      await client.query(
        "SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes " +
          "WHERE schemaname=ANY($1::text[]) ORDER BY schemaname,tablename,indexname",
        [SCHEMAS]
      )
    ).rows;
    const policies = (
      await client.query(
        "SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check " +
          "FROM pg_policies WHERE schemaname=ANY($1::text[]) ORDER BY schemaname,tablename,policyname",
        [SCHEMAS]
      )
    ).rows;
    const managedPolicies = (
      await client.query(
        "SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check " +
          "FROM pg_policies WHERE schemaname=ANY($1::text[]) " +
          "ORDER BY schemaname,tablename,policyname",
        [["auth", "storage", "realtime"]]
      )
    ).rows;
    const managedRlsRelations = (
      await client.query(
        "SELECT n.nspname AS schema_name,c.relname AS relation_name," +
          "c.relrowsecurity AS row_security,c.relforcerowsecurity AS force_row_security " +
          "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace " +
          "WHERE n.nspname=ANY($1::text[]) AND c.relkind IN ('r','p') " +
          "ORDER BY n.nspname,c.relname",
        [["auth", "storage", "realtime"]]
      )
    ).rows;
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
        [CATALOG_SCHEMAS]
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
    const relationAcls = (
      await client.query(
        "SELECT n.nspname AS schema_name,c.relname AS relation_name,c.relkind AS kind," +
          "c.relacl::text AS acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace " +
          "WHERE n.nspname=ANY($1::text[]) AND c.relkind IN ('r','p','v','m','S') " +
          "ORDER BY n.nspname,c.relname",
        [CATALOG_SCHEMAS]
      )
    ).rows;
    const defaultAcls = (
      await client.query(
        "SELECT n.nspname AS schema_name,pg_get_userbyid(d.defaclrole) AS owner_name," +
          "d.defaclobjtype AS object_type,d.defaclacl::text AS acl " +
          "FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace " +
          "ORDER BY n.nspname,owner_name,d.defaclobjtype"
      )
    ).rows;
    const roleAttributes = (
      await client.query(
        "SELECT rolname,rolsuper,rolcreaterole,rolcreatedb,rolinherit,rolcanlogin," +
          "rolreplication,rolbypassrls FROM pg_roles ORDER BY rolname"
      )
    ).rows;
    const authUserCount = Number(
      (await client.query("SELECT count(*)::text AS count FROM auth.users"))
        .rows[0].count
    );
    const functions = (
      await client.query(
        "SELECT n.nspname AS schema_name,p.proname AS function_name," +
          "pg_get_function_identity_arguments(p.oid) AS identity_arguments,l.lanname AS language," +
          "p.prosecdef AS security_definer,p.provolatile AS volatility," +
          "p.proacl::text AS acl," +
          "COALESCE((SELECT json_agg(jsonb_build_object(" +
          "'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END," +
          "'privilege',a.privilege_type,'grantable',a.is_grantable) " +
          "ORDER BY a.grantee,a.privilege_type) FROM aclexplode(" +
          "COALESCE(p.proacl,acldefault('f',p.proowner))) a),'[]'::json) AS acl_grants," +
          "pg_get_userbyid(p.proowner) AS owner_name," +
          "encode(digest(pg_get_functiondef(p.oid),'sha256'),'hex') AS definition_sha256," +
          "CASE WHEN n.nspname='public' THEN pg_get_functiondef(p.oid) END AS definition " +
          "FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace " +
          "JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname=ANY($1::text[]) " +
          "ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)",
        [CATALOG_SCHEMAS]
      )
    ).rows;
    const extensions = (
      await client.query(
        "SELECT e.extname AS name,e.extversion AS version,n.nspname AS schema_name " +
          "FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace ORDER BY e.extname"
      )
    ).rows;
    const publications = (
      await client.query(
        "SELECT p.pubname AS publication,p.puballtables AS all_tables," +
          "p.pubinsert AS publishes_insert,p.pubupdate AS publishes_update," +
          "p.pubdelete AS publishes_delete,p.pubtruncate AS publishes_truncate," +
          "p.pubviaroot AS publishes_via_root," +
          "COALESCE(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname) " +
          "ORDER BY n.nspname,c.relname) FILTER (WHERE c.oid IS NOT NULL),'[]'::jsonb) AS tables " +
          "FROM pg_publication p LEFT JOIN pg_publication_rel pr ON pr.prpubid=p.oid " +
          "LEFT JOIN pg_class c ON c.oid=pr.prrelid LEFT JOIN pg_namespace n ON n.oid=c.relnamespace " +
          "GROUP BY p.pubname,p.puballtables,p.pubinsert,p.pubupdate," +
          "p.pubdelete,p.pubtruncate,p.pubviaroot ORDER BY p.pubname"
      )
    ).rows;
    const enumTypes = (
      await client.query(
        "SELECT n.nspname AS schema_name,t.typname AS type_name," +
          "json_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels " +
          "FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace " +
          "JOIN pg_enum e ON e.enumtypid=t.oid " +
          "WHERE n.nspname=ANY($1::text[]) " +
          "GROUP BY n.nspname,t.typname ORDER BY n.nspname,t.typname",
        [CATALOG_SCHEMAS]
      )
    ).rows;
    const domainTypes = (
      await client.query(
        "SELECT n.nspname AS schema_name,t.typname AS type_name," +
          "format_type(t.typbasetype,t.typtypmod) AS base_type,t.typnotnull AS not_null," +
          "COALESCE(json_agg(pg_get_constraintdef(c.oid,true) ORDER BY c.conname) " +
          "FILTER (WHERE c.oid IS NOT NULL),'[]'::json) AS constraints " +
          "FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace " +
          "LEFT JOIN pg_constraint c ON c.contypid=t.oid " +
          "WHERE t.typtype='d' AND n.nspname=ANY($1::text[]) " +
          "GROUP BY n.nspname,t.typname,t.typbasetype,t.typtypmod,t.typnotnull " +
          "ORDER BY n.nspname,t.typname",
        [CATALOG_SCHEMAS]
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
        [SCHEMAS]
      )
    ).rows;
    const sequenceStates = [];
    for (const sequence of sequences) {
      const state = (
        await client.query(
          `SELECT last_value::text AS last_value,is_called FROM ${quote(sequence.schema_name)}.${quote(sequence.sequence_name)}`
        )
      ).rows[0];
      sequenceStates.push({
        ...sequence,
        lastValue: state.last_value,
        isCalled: state.is_called,
      });
    }
    const schemaAcls = (
      await client.query(
        "SELECT n.nspname AS schema_name,pg_get_userbyid(n.nspowner) AS owner_name," +
          "n.nspacl::text AS acl FROM pg_namespace n " +
          "WHERE n.nspname=ANY($1::text[]) ORDER BY n.nspname",
        [CATALOG_SCHEMAS]
      )
    ).rows;
    const roleMemberships = (
      await client.query(
        "SELECT granted.rolname AS granted_role,member.rolname AS member_role," +
          "grantor.rolname AS grantor_role,m.admin_option " +
          "FROM pg_auth_members m " +
          "JOIN pg_roles granted ON granted.oid=m.roleid " +
          "JOIN pg_roles member ON member.oid=m.member " +
          "JOIN pg_roles grantor ON grantor.oid=m.grantor " +
          "ORDER BY granted.rolname,member.rolname"
      )
    ).rows;
    const viewDefinitions = (
      await client.query(
        "SELECT n.nspname AS schema_name,c.relname AS relation_name,c.relkind AS kind," +
          "encode(digest(pg_get_viewdef(c.oid,true),'sha256'),'hex') AS definition_sha256 " +
          "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace " +
          "WHERE n.nspname=ANY($1::text[]) AND c.relkind IN ('v','m') " +
          "ORDER BY n.nspname,c.relname",
        [SCHEMAS]
      )
    ).rows;
    const buckets = (
      await client.query(
        "SELECT id,name,public,file_size_limit::text AS file_size_limit,allowed_mime_types " +
          "FROM storage.buckets ORDER BY name"
      )
    ).rows;
    const databaseBytes = Number(server.database_bytes);
    const storageBytes = storage.reduce(
      (sum, object) => sum + (object.sizeBytes ?? 0),
      0
    );
    const manifest = {
      format: "INTERPRETE-SUPABASE-SOURCE-SNAPSHOT-V1",
      createdAt,
      sourceProjectRef: SOURCE_REF,
      connection: {
        serverVersion: server.server_version,
        transactionReadOnly: server.transaction_read_only,
        tls: "verify-full",
        sharedSnapshot: Boolean(sharedSnapshotId),
        snapshotIdSha256: sharedSnapshotId
          ? crypto.createHash("sha256").update(sharedSnapshotId).digest("hex")
          : null,
      },
      database: {
        name: server.database_name,
        encoding: server.encoding,
        sizeBytes: databaseBytes,
        rowCount: totalRows,
        relations,
        columns,
        rowSnapshots,
      },
      catalog: {
        constraints,
        indexes,
        policies,
        functions,
        enumTypes,
        domainTypes,
        sequenceStates,
        schemaAcls,
        roleMemberships,
        viewDefinitions,
        extensions,
        publications,
        managedPolicies,
        managedRlsRelations,
        triggers,
        eventTriggers,
        relationAcls,
        defaultAcls,
        roleAttributes,
      },
      migrationLedgers: rowSnapshots.filter(
        (table) =>
          (table.schema === "public" && table.table === "_prisma_migrations") ||
          table.schema === "supabase_migrations"
      ),
      authUserCount,
      storage: {
        buckets,
        objectCount: storage.length,
        metadataBytes: storageBytes,
        objects: storage.map((object) => ({
          ...object,
          referencedBy: [...object.referencedBy].sort(),
          evidence: [...object.evidence].sort(),
          migrateAllowlist: true,
        })),
      },
    };
    await client.query("ROLLBACK");
    transactionOpen = false;
    const protectedBytes = protectWithDpapi(
      Buffer.from(JSON.stringify(manifest, null, 2), "utf8")
    );
    fs.writeFileSync(outputPath, protectedBytes, { flag: "wx", mode: 0o600 });
    restrictToCurrentUser(outputPath, `*${sid}:(F)`);
    const allowlist = manifest.storage.objects.filter(
      (object) => object.migrateAllowlist
    );
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        manifestPath: outputPath,
        protectedManifestBytes: protectedBytes.length,
        protectedManifestSha256: crypto
          .createHash("sha256")
          .update(protectedBytes)
          .digest("hex"),
        serverVersion: server.server_version,
        transactionReadOnly: true,
        databaseBytes,
        tableCount: productTables.length,
        columnCount: columns.length,
        rowCount: totalRows,
        storageObjectCount: storage.length,
        storageMetadataBytes: storageBytes,
        storageAllowlistCount: allowlist.length,
        storageAllowlistBytes: allowlist.reduce(
          (sum, object) => sum + (object.sizeBytes ?? 0),
          0
        ),
        storageUnreferencedCount: storage.length - allowlist.length,
      })}\n`
    );
  } finally {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the inventory error if rolling back also fails.
      }
    }
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
    })}\n`
  );
  process.exitCode = 2;
});
