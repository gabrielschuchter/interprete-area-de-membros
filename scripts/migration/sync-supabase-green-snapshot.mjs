#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseGreenSessionPoolerUrl } from "../lib/supabase-green-connection.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DATABASE_PACKAGE = path.join(ROOT, "packages/database/package.json");
const ENV_FILE = path.join(ROOT, "packages/database/.env");
const CA_FILE = path.join(
  ROOT,
  "packages/database/certs/supabase-prod-ca-2021.crt"
);
const CREDENTIAL_FILE = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Codex/migrations/interprete-supabase/green-session-pooler-uri.dpapi"
);
const SOURCE_REF = "wkclodjbrynerfgufmyb";
const GREEN_REF = "qffqhilydtnrggbcnogh";
const SOURCE_SCHEMAS = ["public", "supabase_migrations"];
const EXCLUDED_TABLES = new Set(["public._prisma_migrations"]);
const SNAPSHOT_ID_PATTERN = /^[A-Fa-f0-9-]+$/;
const DATABASE_PATH_PREFIX = /^\//;
const require = createRequire(DATABASE_PACKAGE);
const dotenv = require("dotenv");
const { Client } = require("pg");

const fail = (message) => {
  throw new Error(message);
};

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const quoteQualified = (schema, table) =>
  `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;

const stableValue = (value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("base64");
  }
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};

const rowHash = (row, columns) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(columns.map((column) => stableValue(row[column]))))
    .digest("hex");

const rowKey = (row, primaryKey) =>
  JSON.stringify(primaryKey.map((column) => stableValue(row[column])));

const fingerprintKey = (key) =>
  crypto.createHash("sha256").update(key).digest("hex").slice(0, 12);

const unprotectGreenCredential = () => {
  if (!(process.platform === "win32" && process.env.LOCALAPPDATA)) {
    fail(
      "This guarded green operation requires the prepared Windows DPAPI profile."
    );
  }
  if (!fs.existsSync(CREDENTIAL_FILE)) {
    fail("The protected green session-pooler credential is unavailable.");
  }
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
      input: Buffer.from(
        `${fs.readFileSync(CREDENTIAL_FILE).toString("base64")}\n`
      ),
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    }
  );
  if (result.status !== 0 || !result.stdout?.trim()) {
    fail("Current-user DPAPI could not open the protected green credential.");
  }
  const plain = Buffer.from(result.stdout.trim(), "base64");
  const value = plain.toString("utf8");
  plain.fill(0);
  return value;
};

const sourceConnection = () => {
  if (!(fs.existsSync(ENV_FILE) && fs.existsSync(CA_FILE))) {
    fail("The ignored source environment or verified Supabase CA is missing.");
  }
  const sourceEnvironment = dotenv.parse(fs.readFileSync(ENV_FILE));
  if (!sourceEnvironment.DIRECT_URL) {
    fail("The source session-pooler connection is not configured locally.");
  }
  const url = new URL(sourceEnvironment.DIRECT_URL);
  let username;
  let database;
  try {
    username = decodeURIComponent(url.username);
    database = decodeURIComponent(
      url.pathname.replace(DATABASE_PATH_PREFIX, "")
    );
  } catch {
    fail("The configured source connection has invalid URL encoding.");
  }
  if (
    username !== `postgres.${SOURCE_REF}` ||
    url.hostname.includes(GREEN_REF) ||
    url.port !== "5432" ||
    !url.hostname.endsWith(".pooler.supabase.com") ||
    database !== "postgres" ||
    !url.password
  ) {
    fail("Source guard failed; no database query was run.");
  }
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
    url.searchParams.delete(key);
  }
  return url;
};

const createClient = (url, readOnly) =>
  new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, ca: fs.readFileSync(CA_FILE, "utf8") },
    options: readOnly
      ? "-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=5000"
      : "-c statement_timeout=120000 -c lock_timeout=5000",
    connectionTimeoutMillis: 15_000,
  });

const readCatalogTables = async (client) =>
  (
    await client.query(
      "SELECT table_schema,table_name FROM information_schema.tables " +
        "WHERE table_schema=ANY($1::text[]) AND table_type='BASE TABLE' " +
        "ORDER BY table_schema,table_name",
      [SOURCE_SCHEMAS]
    )
  ).rows.filter(
    ({ table_schema, table_name }) =>
      !EXCLUDED_TABLES.has(`${table_schema}.${table_name}`)
  );

const readColumns = async (client, schema, table) =>
  (
    await client.query(
      "SELECT column_name,is_generated,is_identity,ordinal_position " +
        "FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 " +
        "ORDER BY ordinal_position",
      [schema, table]
    )
  ).rows;

const readPrimaryKey = async (client, schema, table) =>
  (
    await client.query(
      "SELECT attribute.attname AS column_name, " +
        "key_data.ordinal " +
        "FROM pg_index AS index_data " +
        "JOIN pg_class AS relation ON relation.oid=index_data.indrelid " +
        "JOIN pg_namespace AS namespace ON namespace.oid=relation.relnamespace " +
        "CROSS JOIN LATERAL unnest(index_data.indkey) WITH ORDINALITY " +
        "AS key_data(attnum,ordinal) " +
        "JOIN pg_attribute AS attribute ON attribute.attrelid=relation.oid " +
        "AND attribute.attnum=key_data.attnum " +
        "WHERE namespace.nspname=$1 AND relation.relname=$2 " +
        "AND index_data.indisprimary ORDER BY ordinal",
      [schema, table]
    )
  ).rows.map((row) => row.column_name);

const readForeignKeys = async (client, tables) => {
  const keys = (
    await client.query(
      "SELECT source_namespace.nspname AS source_schema, " +
        "source_relation.relname AS source_table, " +
        "target_namespace.nspname AS target_schema, " +
        "target_relation.relname AS target_table " +
        "FROM pg_constraint AS constraint_data " +
        "JOIN pg_class AS source_relation ON source_relation.oid=constraint_data.conrelid " +
        "JOIN pg_namespace AS source_namespace ON source_namespace.oid=source_relation.relnamespace " +
        "JOIN pg_class AS target_relation ON target_relation.oid=constraint_data.confrelid " +
        "JOIN pg_namespace AS target_namespace ON target_namespace.oid=target_relation.relnamespace " +
        "WHERE constraint_data.contype='f' AND source_namespace.nspname=ANY($1::text[]) " +
        "AND target_namespace.nspname=ANY($1::text[])",
      [SOURCE_SCHEMAS]
    )
  ).rows;
  const included = new Set(
    tables.map(
      ({ table_schema, table_name }) => `${table_schema}.${table_name}`
    )
  );
  const indegree = new Map([...included].map((name) => [name, 0]));
  const dependants = new Map([...included].map((name) => [name, new Set()]));
  for (const key of keys) {
    const source = `${key.source_schema}.${key.source_table}`;
    const target = `${key.target_schema}.${key.target_table}`;
    if (!(included.has(source) && included.has(target)) || source === target) {
      continue;
    }
    if (!dependants.get(target).has(source)) {
      dependants.get(target).add(source);
      indegree.set(source, indegree.get(source) + 1);
    }
  }
  const ready = [...included].filter((name) => indegree.get(name) === 0).sort();
  const ordered = [];
  while (ready.length > 0) {
    const current = ready.shift();
    ordered.push(current);
    for (const dependant of dependants.get(current)) {
      indegree.set(dependant, indegree.get(dependant) - 1);
      if (indegree.get(dependant) === 0) {
        ready.push(dependant);
        ready.sort();
      }
    }
  }
  if (ordered.length !== included.size) {
    fail(
      "The source foreign-key graph contains a cycle; refusing to sync data automatically."
    );
  }
  const byName = new Map(
    tables.map((table) => [`${table.table_schema}.${table.table_name}`, table])
  );
  return ordered.map((name) => byName.get(name));
};

const readRows = async (client, table, columns) => {
  const projection = columns.map((column) => quoteIdentifier(column)).join(",");
  return (
    await client.query(
      `SELECT ${projection} FROM ${quoteQualified(table.table_schema, table.table_name)}`
    )
  ).rows;
};

const mapRows = (rows, primaryKey, columns) => {
  const mapped = new Map();
  for (const row of rows) {
    const key = rowKey(row, primaryKey);
    if (mapped.has(key)) {
      fail("A source table returned duplicate primary-key identities.");
    }
    mapped.set(key, rowHash(row, columns));
  }
  return mapped;
};

const upsertSourceRows = async (
  destination,
  table,
  columns,
  primaryKey,
  rows
) => {
  const nonKeyColumns = columns.filter(
    (column) => !primaryKey.includes(column)
  );
  const quotedColumns = columns
    .map((column) => quoteIdentifier(column))
    .join(",");
  const conflict = primaryKey
    .map((column) => quoteIdentifier(column))
    .join(",");
  const update = nonKeyColumns.length
    ? `DO UPDATE SET ${nonKeyColumns.map((column) => `${quoteIdentifier(column)}=EXCLUDED.${quoteIdentifier(column)}`).join(",")}`
    : "DO NOTHING";
  const tableName = quoteQualified(table.table_schema, table.table_name);
  const maxRowsPerBatch = Math.max(1, Math.floor(60_000 / columns.length));

  for (let offset = 0; offset < rows.length; offset += maxRowsPerBatch) {
    const batch = rows.slice(offset, offset + maxRowsPerBatch);
    const values = [];
    const valueRows = batch.map((row) => {
      const placeholders = columns.map((column) => {
        values.push(row[column]);
        return `$${values.length}`;
      });
      return `(${placeholders.join(",")})`;
    });
    await destination.query(
      `INSERT INTO ${tableName} (${quotedColumns}) VALUES ${valueRows.join(",")} ` +
        `ON CONFLICT (${conflict}) ${update}`,
      values
    );
  }
};

const getOptions = () => {
  if (!fs.existsSync(CA_FILE)) {
    fail("The verified Supabase CA certificate is missing.");
  }
  const apply = process.argv.includes("--apply");
  if (apply && !process.argv.includes(`--confirm-green=${GREEN_REF}`)) {
    fail("Applying data requires the exact green project confirmation flag.");
  }
  const snapshotArgument = process.argv.find((value) =>
    value.startsWith("--snapshot-id=")
  );
  const snapshotId = snapshotArgument?.slice("--snapshot-id=".length);
  if (snapshotId && !SNAPSHOT_ID_PATTERN.test(snapshotId)) {
    fail("The shared PostgreSQL snapshot identifier has an invalid format.");
  }
  return { apply, snapshotId };
};

const greenConnection = () => {
  const credential = unprotectGreenCredential();
  let url;
  try {
    url = parseGreenSessionPoolerUrl(credential);
  } finally {
    Buffer.from(credential).fill(0);
  }
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
    url.searchParams.delete(key);
  }
  return url;
};

const validateRuntime = async (client, projectRef, readOnly = false) => {
  const facts = (
    await client.query(
      "SELECT current_database() AS database_name,current_user AS database_user," +
        "current_setting('transaction_read_only') AS read_only," +
        "current_setting('server_version_num') AS server_version_num"
    )
  ).rows[0];
  if (
    facts.database_name !== "postgres" ||
    facts.database_user !== "postgres" ||
    (readOnly && facts.read_only !== "on") ||
    Math.floor(Number(facts.server_version_num) / 10_000) !== 17
  ) {
    fail(
      `${projectRef === SOURCE_REF ? "Source" : "Green"} runtime guard failed; no destination write was attempted.`
    );
  }
};

const lockDestinationTables = async (destination, tables) => {
  await destination.query(
    `LOCK TABLE ${tables
      .map(({ table_schema, table_name }) =>
        quoteQualified(table_schema, table_name)
      )
      .join(",")} IN SHARE ROW EXCLUSIVE MODE`
  );
  await destination.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('interprete:blue-green-final-sync',0))::text"
  );
};

const validateTableSet = async (source, destination) => {
  const sourceTables = await readCatalogTables(source);
  const destinationTables = new Set(
    (await readCatalogTables(destination)).map(
      ({ table_schema, table_name }) => `${table_schema}.${table_name}`
    )
  );
  if (sourceTables.length === 0) {
    fail("The source product schema is empty; refusing to sync.");
  }
  for (const table of sourceTables) {
    if (!destinationTables.has(`${table.table_schema}.${table.table_name}`)) {
      fail("A source table is missing from green; refusing a partial sync.");
    }
  }
  return sourceTables;
};

const buildTableChange = async (source, destination, table) => {
  const schema = table.table_schema;
  const name = table.table_name;
  const sourceColumns = await readColumns(source, schema, name);
  const destinationColumns = await readColumns(destination, schema, name);
  const destinationColumnNames = new Set(
    destinationColumns.map((column) => column.column_name)
  );
  const columns = sourceColumns
    .filter((column) => column.is_generated === "NEVER")
    .map((column) => column.column_name);
  if (
    columns.length === 0 ||
    columns.some((column) => !destinationColumnNames.has(column))
  ) {
    fail("A source table has no compatible writable column set in green.");
  }
  const primaryKey = await readPrimaryKey(source, schema, name);
  const destinationPrimaryKey = await readPrimaryKey(destination, schema, name);
  if (
    primaryKey.length === 0 ||
    JSON.stringify(primaryKey) !== JSON.stringify(destinationPrimaryKey)
  ) {
    fail(
      `Primary-key definition differs for ${schema}.${name}: source=${JSON.stringify(primaryKey)}, green=${JSON.stringify(destinationPrimaryKey)}.`
    );
  }
  const sourceRows = await readRows(source, table, columns);
  const destinationRows = await readRows(destination, table, columns);
  const sourceMap = mapRows(sourceRows, primaryKey, columns);
  const destinationMap = mapRows(destinationRows, primaryKey, columns);
  const destinationRowsByKey = new Map(
    destinationRows.map((row) => [rowKey(row, primaryKey), row])
  );
  const rowDifferences = [];
  const { inserted, updated, unchanged } = [...sourceMap].reduce(
    (counts, [key, hash]) => {
      const current = destinationMap.get(key);
      if (!current) {
        counts.inserted += 1;
        if (rowDifferences.length < 25) {
          rowDifferences.push({
            keyFingerprint: fingerprintKey(key),
            change: "missing-in-green",
            columns: [],
          });
        }
      } else if (current !== hash) {
        counts.updated += 1;
        if (rowDifferences.length < 25) {
          const sourceRow = sourceRows.find(
            (row) => rowKey(row, primaryKey) === key
          );
          const destinationRow = destinationRowsByKey.get(key);
          const changedColumns = columns.filter(
            (column) =>
              JSON.stringify(stableValue(sourceRow[column])) !==
              JSON.stringify(stableValue(destinationRow[column]))
          );
          rowDifferences.push({
            keyFingerprint: fingerprintKey(key),
            change: "values-differ",
            columns: changedColumns,
            ...(changedColumns.includes("updatedAt")
              ? {
                  sourceUpdatedAt: stableValue(sourceRow.updatedAt),
                  greenUpdatedAt: stableValue(destinationRow.updatedAt),
                }
              : {}),
          });
        }
      } else {
        counts.unchanged += 1;
      }
      return counts;
    },
    { inserted: 0, updated: 0, unchanged: 0 }
  );
  return {
    schema,
    table: name,
    sourceRows: sourceRows.length,
    inserted,
    updated,
    unchanged,
    destinationOnlyRows: Math.max(
      0,
      destinationRows.length - unchanged - updated
    ),
    rows: sourceRows,
    columns,
    primaryKey,
    sourceMap,
    rowDifferences,
  };
};

const buildSyncPlan = async (source, destination, sourceTables) => {
  const orderedTables = await readForeignKeys(destination, sourceTables);
  const changes = [];
  for (const table of orderedTables) {
    changes.push(await buildTableChange(source, destination, table));
  }
  return changes;
};

const applySyncPlan = async (destination, changes) => {
  for (const change of changes) {
    const table = { table_schema: change.schema, table_name: change.table };
    if (change.rows.length > 0) {
      await upsertSourceRows(
        destination,
        table,
        change.columns,
        change.primaryKey,
        change.rows
      );
    }
    const verifiedRows = await readRows(destination, table, change.columns);
    const verified = mapRows(verifiedRows, change.primaryKey, change.columns);
    for (const [key, hash] of change.sourceMap) {
      if (verified.get(key) !== hash) {
        fail("A source row did not match green after the guarded sync.");
      }
    }
  }
};

const summarizeChanges = (changes, apply, sharedSnapshot) => ({
  ok: true,
  mode: apply ? "upsert-only-apply" : "read-only-dry-run",
  sourceProjectRef: SOURCE_REF,
  destinationProjectRef: GREEN_REF,
  sharedSnapshot,
  sourceTables: changes.length,
  sourceRows: changes.reduce((sum, change) => sum + change.sourceRows, 0),
  inserted: changes.reduce((sum, change) => sum + change.inserted, 0),
  updated: changes.reduce((sum, change) => sum + change.updated, 0),
  unchanged: changes.reduce((sum, change) => sum + change.unchanged, 0),
  destinationOnlyRows: changes.reduce(
    (sum, change) => sum + change.destinationOnlyRows,
    0
  ),
  tableChanges: changes.map(
    ({
      schema,
      table,
      sourceRows,
      inserted,
      updated,
      unchanged,
      destinationOnlyRows,
      rowDifferences,
    }) => ({
      schema,
      table,
      sourceRows,
      inserted,
      updated,
      unchanged,
      destinationOnlyRows,
      rowDifferences,
    })
  ),
  deletes: 0,
  prismaMigrationHistoryTouched: false,
  storageCopied: false,
  productionChanged: false,
  sourceWrites: 0,
});

const main = async () => {
  const { apply, snapshotId } = getOptions();
  const sourceUrl = sourceConnection();
  const destinationUrl = greenConnection();
  const source = createClient(sourceUrl, true);
  const destination = createClient(destinationUrl, !apply);
  let sourceTransactionOpen = false;
  let destinationTransactionOpen = false;
  try {
    await source.connect();
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    sourceTransactionOpen = true;
    if (snapshotId) {
      await source.query(`SET TRANSACTION SNAPSHOT '${snapshotId}'`);
    }
    await validateRuntime(source, SOURCE_REF, true);
    await destination.connect();
    await validateRuntime(destination, GREEN_REF);
    await destination.query(
      apply
        ? "BEGIN ISOLATION LEVEL SERIALIZABLE"
        : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"
    );
    destinationTransactionOpen = true;

    const sourceTables = await validateTableSet(source, destination);
    if (apply) {
      await lockDestinationTables(destination, sourceTables);
    }
    const changes = await buildSyncPlan(source, destination, sourceTables);
    if (apply) {
      await applySyncPlan(destination, changes);
      await destination.query("COMMIT");
      destinationTransactionOpen = false;
    } else {
      await destination.query("ROLLBACK");
      destinationTransactionOpen = false;
    }

    await source.query("ROLLBACK");
    sourceTransactionOpen = false;
    const report = summarizeChanges(changes, apply, Boolean(snapshotId));
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } finally {
    if (destinationTransactionOpen) {
      await destination.query("ROLLBACK").catch(() => undefined);
    }
    if (sourceTransactionOpen) {
      await source.query("ROLLBACK").catch(() => undefined);
    }
    await Promise.all([
      source.end().catch(() => undefined),
      destination.end().catch(() => undefined),
    ]);
    destinationUrl.password = "";
    sourceUrl.password = "";
  }
};

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown snapshot sync failure";
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      sourceProjectRef: SOURCE_REF,
      destinationProjectRef: GREEN_REF,
      error: message
        .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[connection URI redacted]")
        .replace(/password\s*[:=]\s*[^\s]+/gi, "password=[redacted]")
        .slice(0, 2000),
    })}\n`
  );
  process.exitCode = 2;
});
