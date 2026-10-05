#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseGreenSessionPoolerUrl } from "../lib/supabase-green-connection.mjs";
import {
  buildEventTriggerSql,
  buildExtensionSql,
  buildPolicySql,
  buildPublicationSql,
  sameEventTriggerDefinition,
  samePolicyDefinition,
} from "../lib/supabase-project-config.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DATABASE_PACKAGE = path.join(ROOT, "packages/database/package.json");
const CA_FILE = path.join(
  ROOT,
  "packages/database/certs/supabase-prod-ca-2021.crt"
);
const CREDENTIAL_FILE = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Codex/migrations/interprete-supabase/green-session-pooler-uri.dpapi"
);
const GREEN_REF = "qffqhilydtnrggbcnogh";
const SOURCE_REF = "wkclodjbrynerfgufmyb";
const FUNCTIONS_SCHEMA = "public";

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
    fail(
      "Current-user DPAPI could not open the source snapshot or green credential."
    );
  }
  return Buffer.from(result.stdout.trim(), "base64");
};

const readSourceSnapshot = (snapshotPath) => {
  const bytes = unprotectWithDpapi(fs.readFileSync(snapshotPath));
  try {
    const snapshot = JSON.parse(bytes.toString("utf8"));
    if (
      snapshot.format !== "INTERPRETE-SUPABASE-SOURCE-SNAPSHOT-V1" ||
      snapshot.sourceProjectRef !== SOURCE_REF ||
      !snapshot.connection.sharedSnapshot
    ) {
      fail(
        "The protected source snapshot does not match the audited blue project."
      );
    }
    return snapshot;
  } finally {
    bytes.fill(0);
  }
};

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;

const functionKey = (fn) =>
  `${fn.schema_name}.${fn.function_name}(${fn.identity_arguments})`;

const functionAclSql = (fn) => {
  const signature =
    `${quoteIdentifier(fn.schema_name)}.${quoteIdentifier(fn.function_name)}` +
    `(${fn.identity_arguments})`;
  const statements = [
    `REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC, anon, authenticated, service_role;`,
  ];
  for (const grant of fn.acl_grants ?? []) {
    if (grant.grantee === fn.owner_name || grant.privilege !== "EXECUTE") {
      continue;
    }
    const grantee =
      grant.grantee === "PUBLIC" ? "PUBLIC" : quoteIdentifier(grant.grantee);
    statements.push(
      `GRANT EXECUTE ON FUNCTION ${signature} TO ${grantee}` +
        `${grant.grantable ? " WITH GRANT OPTION" : ""};`
    );
  }
  return statements;
};

const GRANT_ROLES = new Set([
  "PUBLIC",
  "postgres",
  "anon",
  "authenticated",
  "service_role",
]);
const GRANT_PRIVILEGES = new Set([
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
  "REFERENCES",
  "TRIGGER",
  "MAINTAIN",
  "USAGE",
  "EXECUTE",
]);
const canonicalGrants = (grants) =>
  grants
    .map((grant) => `${grant.grantee}:${grant.privilege}:${grant.grantable}`)
    .sort()
    .join("|");

const decodeAcl = async (client, acl) => {
  if (!acl) {
    fail("Source grant reconciliation requires explicit inventoried ACLs.");
  }
  const grants = (
    await client.query(
      "SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee," +
        "a.privilege_type AS privilege,a.is_grantable AS grantable FROM aclexplode($1::aclitem[]) a",
      [acl]
    )
  ).rows;
  if (
    !grants.every(
      (grant) =>
        GRANT_ROLES.has(grant.grantee) && GRANT_PRIVILEGES.has(grant.privilege)
    )
  ) {
    fail("Source ACL contains an unreviewed role or privilege.");
  }
  return grants;
};

const publicTableGrantSql = async (client, snapshot) => {
  const statements = [];
  for (const source of snapshot.catalog.relationAcls.filter(
    (acl) => acl.schema_name === "public"
  )) {
    const current = (
      await client.query(
        "SELECT c.relacl::text AS acl,pg_get_userbyid(c.relowner) AS owner FROM pg_class c " +
          "JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=$1 AND c.relkind IN ('r','p','v','m','S')",
        [source.relation_name]
      )
    ).rows[0];
    if (!current || current.owner !== "postgres" || source.kind !== "r") {
      fail(
        "Public grant reconciliation requires a restored postgres-owned table."
      );
    }
    const desired = await decodeAcl(client, source.acl);
    const actual = await decodeAcl(client, current.acl);
    if (canonicalGrants(desired) === canonicalGrants(actual)) {
      continue;
    }
    const target = `TABLE public.${quoteIdentifier(source.relation_name)}`;
    statements.push(
      `REVOKE ALL ON ${target} FROM PUBLIC, anon, authenticated, service_role;`
    );
    for (const grant of desired.filter((item) => item.grantee !== "postgres")) {
      const role =
        grant.grantee === "PUBLIC" ? "PUBLIC" : quoteIdentifier(grant.grantee);
      statements.push(
        `GRANT ${grant.privilege} ON ${target} TO ${role}${grant.grantable ? " WITH GRANT OPTION" : ""};`
      );
    }
  }
  return statements;
};

const publicDefaultGrantSql = async (client, snapshot) => {
  const statements = [];
  for (const source of snapshot.catalog.defaultAcls.filter(
    (acl) => acl.schema_name === "public" && acl.owner_name === "postgres"
  )) {
    const current = (
      await client.query(
        "SELECT d.defaclacl::text AS acl FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace " +
          "WHERE n.nspname='public' AND pg_get_userbyid(d.defaclrole)='postgres' AND d.defaclobjtype=$1",
        [source.object_type]
      )
    ).rows[0];
    const desired = await decodeAcl(client, source.acl);
    const actual = await decodeAcl(client, current?.acl);
    if (canonicalGrants(desired) === canonicalGrants(actual)) {
      continue;
    }
    const type = { r: "TABLES", S: "SEQUENCES", f: "FUNCTIONS" }[
      source.object_type
    ];
    if (!type) {
      fail("Unsupported default privilege object type.");
    }
    const prefix =
      "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public";
    statements.push(
      `${prefix} REVOKE ALL ON ${type} FROM PUBLIC, anon, authenticated, service_role;`
    );
    for (const grant of desired.filter((item) => item.grantee !== "postgres")) {
      const role =
        grant.grantee === "PUBLIC" ? "PUBLIC" : quoteIdentifier(grant.grantee);
      statements.push(
        `${prefix} GRANT ${grant.privilege} ON ${type} TO ${role}${grant.grantable ? " WITH GRANT OPTION" : ""};`
      );
    }
  }
  return statements;
};

const buildStoredPolicySql = async (client, policy) => {
  const roles = Array.isArray(policy.roles)
    ? policy.roles
    : (await client.query("SELECT $1::name[]::text[] AS roles", [policy.roles]))
        .rows[0].roles;
  return buildPolicySql({ ...policy, roles });
};

const reviewedFunctionGrants = (fn) => {
  if (
    !fn.acl_grants.every(
      (grant) => GRANT_ROLES.has(grant.grantee) && grant.privilege === "EXECUTE"
    )
  ) {
    fail("Source function has unreviewed grants.");
  }
  return functionAclSql(fn);
};

const requireNoMismatch = (source, current, same, label, keyOf) => {
  const currentByName = new Map(current.map((item) => [keyOf(item), item]));
  const missing = [];
  for (const item of source) {
    const key = keyOf(item);
    const existing = currentByName.get(key);
    if (!existing) {
      missing.push(item);
    } else if (!same(item, existing)) {
      fail(
        `Green ${label} ${key} exists with a different definition; no changes were applied.`
      );
    }
  }
  return missing;
};

const currentProjectConfig = async (client) => {
  const policies = (
    await client.query(
      "SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check " +
        "FROM pg_policies WHERE schemaname=ANY($1::text[]) " +
        "ORDER BY schemaname,tablename,policyname",
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
      [["auth", "storage", "realtime"]]
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
  return { policies, triggers, eventTriggers, publication };
};

const existingFunctions = async (client) => {
  const rows = (
    await client.query(
      "SELECT n.nspname AS schema_name,p.proname AS function_name," +
        "pg_get_function_identity_arguments(p.oid) AS identity_arguments," +
        "pg_get_userbyid(p.proowner) AS owner_name," +
        "pg_get_functiondef(p.oid) AS definition," +
        "COALESCE((SELECT json_agg(jsonb_build_object(" +
        "'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END," +
        "'privilege',a.privilege_type,'grantable',a.is_grantable) " +
        "ORDER BY a.grantee,a.privilege_type) FROM aclexplode(" +
        "COALESCE(p.proacl,acldefault('f',p.proowner))) a),'[]'::json) AS acl_grants " +
        "FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace " +
        "WHERE n.nspname='public' ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)"
    )
  ).rows;
  return rows.map((row) => ({
    ...row,
    definition_sha256: sha256(row.definition),
  }));
};

const extensionSql = async (client, snapshot) => {
  const current = (
    await client.query(
      "SELECT e.extname AS name,n.nspname AS schema_name,e.extversion AS version " +
        "FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace"
    )
  ).rows;
  const schemas = new Set(
    (await client.query("SELECT nspname FROM pg_namespace")).rows.map(
      (row) => row.nspname
    )
  );
  try {
    const plan = buildExtensionSql(snapshot.catalog.extensions, current, [
      ...schemas,
    ]);
    return {
      ...plan,
      existingCount: current.length,
    };
  } catch (error) {
    fail(
      error instanceof Error
        ? `Green extension reconciliation failed: ${error.message}`
        : "Green extension reconciliation failed."
    );
  }
};

const buildReconciliation = async (client, snapshot) => {
  const current = await currentProjectConfig(client);
  const sourcePolicies = snapshot.catalog.managedPolicies;
  const missingPolicies = requireNoMismatch(
    sourcePolicies,
    current.policies,
    samePolicyDefinition,
    "managed-schema policy",
    (policy) => `${policy.schemaname}.${policy.tablename}.${policy.policyname}`
  );
  const sourceManagedTriggers = snapshot.catalog.triggers.filter(
    (trigger) =>
      ["auth", "storage", "realtime"].includes(trigger.schema_name) &&
      trigger.function_schema === FUNCTIONS_SCHEMA
  );
  const currentTriggers = new Map(
    current.triggers.map((trigger) => [
      `${trigger.schema_name}.${trigger.table_name}.${trigger.trigger_name}`,
      trigger,
    ])
  );
  const missingTriggers = [];
  for (const trigger of sourceManagedTriggers) {
    const key = `${trigger.schema_name}.${trigger.table_name}.${trigger.trigger_name}`;
    const existing = currentTriggers.get(key);
    if (!existing) {
      missingTriggers.push(trigger);
    } else if (existing.definition !== trigger.definition) {
      fail(
        `Green managed-schema trigger ${trigger.trigger_name} has a different definition.`
      );
    }
  }
  const sourceEventTriggers = snapshot.catalog.eventTriggers.filter(
    (trigger) => trigger.function_schema === FUNCTIONS_SCHEMA
  );
  const missingEventTriggers = requireNoMismatch(
    sourceEventTriggers,
    current.eventTriggers,
    sameEventTriggerDefinition,
    "event trigger",
    (trigger) => trigger.name
  );
  const publication = snapshot.catalog.publications.find(
    (item) => item.publication === "supabase_realtime"
  );
  const publicationStatements = buildPublicationSql(
    publication,
    current.publication
  );
  const targetFunctions = await existingFunctions(client);
  const targetFunctionsByKey = new Map(
    targetFunctions.map((fn) => [functionKey(fn), fn])
  );
  const sourceFunctions = snapshot.catalog.functions.filter(
    (fn) => fn.schema_name === FUNCTIONS_SCHEMA && fn.definition
  );
  const functionStatements = [];
  const missingPublicFunctionCount = [];
  for (const fn of sourceFunctions) {
    const existing = targetFunctionsByKey.get(functionKey(fn));
    if (existing && existing.definition_sha256 !== fn.definition_sha256) {
      fail(
        `Green function ${functionKey(fn)} has a different definition; refusing to replace it.`
      );
    }
    if (!existing) {
      functionStatements.push(fn.definition);
      functionStatements.push(...functionAclSql(fn));
      missingPublicFunctionCount.push(functionKey(fn));
    } else if (
      canonicalGrants(existing.acl_grants) !== canonicalGrants(fn.acl_grants)
    ) {
      functionStatements.push(...reviewedFunctionGrants(fn));
    }
  }
  const extension = await extensionSql(client, snapshot);
  const grantStatements = [
    ...(await publicTableGrantSql(client, snapshot)),
    ...(await publicDefaultGrantSql(client, snapshot)),
  ];
  const missingPolicySql = [];
  for (const policy of missingPolicies) {
    missingPolicySql.push(await buildStoredPolicySql(client, policy));
  }
  for (const trigger of missingEventTriggers) {
    const key =
      `${trigger.function_schema}.${trigger.function_name}` +
      `(${trigger.identity_arguments})`;
    if (
      !(
        targetFunctionsByKey.has(key) ||
        sourceFunctions.some((fn) => functionKey(fn) === key)
      )
    ) {
      fail(
        `The source snapshot is missing the DDL for custom event-trigger function ${key}.`
      );
    }
  }
  const eventSql = missingEventTriggers.map(buildEventTriggerSql);
  return {
    current,
    extension,
    statements: [
      ...extension.statements,
      ...functionStatements,
      ...grantStatements,
      ...missingTriggers.map((trigger) => trigger.definition),
      ...missingPolicySql,
      ...publicationStatements,
      ...eventSql,
    ],
    counts: {
      missingExtensions: extension.missingNames.length,
      missingPublicFunctions: missingPublicFunctionCount.length,
      missingManagedTriggers: missingTriggers.length,
      missingManagedPolicies: missingPolicies.length,
      missingEventTriggers: missingEventTriggers.length,
      publicationStatements: publicationStatements.length,
      grantStatements: grantStatements.length,
      unexpectedManagedPolicies: current.policies
        .filter(
          (policy) =>
            !sourcePolicies.some((source) =>
              samePolicyDefinition(source, policy)
            )
        )
        .map(
          (policy) =>
            `${policy.schemaname}.${policy.tablename}.${policy.policyname}`
        ),
    },
  };
};

const main = async () => {
  if (!(process.platform === "win32" && process.env.LOCALAPPDATA)) {
    fail(
      "This green configuration reconciler requires the Windows profile protected by DPAPI."
    );
  }
  const snapshotPath = process.argv[2];
  if (!(snapshotPath && fs.existsSync(snapshotPath))) {
    fail("Pass the paired DPAPI-protected source snapshot.");
  }
  if (!(fs.existsSync(CREDENTIAL_FILE) && fs.existsSync(CA_FILE))) {
    fail("Protected green credential or Supabase CA certificate is missing.");
  }
  const snapshot = readSourceSnapshot(snapshotPath);
  const credential = unprotectWithDpapi(fs.readFileSync(CREDENTIAL_FILE));
  const url = parseGreenSessionPoolerUrl(credential.toString("utf8"));
  credential.fill(0);
  const require = createRequire(DATABASE_PACKAGE);
  const { Client } = require("pg");
  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, ca: fs.readFileSync(CA_FILE, "utf8") },
    connectionTimeoutMillis: 15_000,
  });
  let transactionOpen = false;
  try {
    await client.connect();
    await client.query("BEGIN");
    transactionOpen = true;
    const facts = (
      await client.query(
        "SELECT current_setting('transaction_read_only') AS read_only," +
          "current_setting('server_version_num') AS server_version_num," +
          "current_database() AS database_name"
      )
    ).rows[0];
    if (
      facts.read_only !== "off" ||
      facts.database_name !== "postgres" ||
      Number(facts.server_version_num) < 150_000
    ) {
      fail(
        "Green configuration write guard failed; expected PostgreSQL 15+ and a writable postgres database."
      );
    }
    const reconciliation = await buildReconciliation(client, snapshot);
    if (reconciliation.statements.length > 0) {
      await client.query(reconciliation.statements.join("\n\n"));
    }
    await client.query("COMMIT");
    transactionOpen = false;
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        projectRef: GREEN_REF,
        tls: "verify-full",
        transactionCommitted: true,
        statementCount: reconciliation.statements.length,
        ...reconciliation.counts,
      })}\n`
    );
  } finally {
    if (transactionOpen) {
      await client.query("ROLLBACK").catch(() => undefined);
    }
    await client.end().catch(() => undefined);
  }
};

main().catch((error) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown green config reconciliation error";
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      projectRef: GREEN_REF,
      error: message
        .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[connection URI redacted]")
        .replace(
          /sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,
          "[Supabase key redacted]"
        )
        .replace(
          /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
          "[JWT redacted]"
        )
        .slice(0, 1000),
    })}\n`
  );
  process.exitCode = 2;
});
