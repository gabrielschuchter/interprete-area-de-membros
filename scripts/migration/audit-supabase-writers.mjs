#!/usr/bin/env node
/**
 * Read-only point-in-time observation of PostgreSQL sessions that may write
 * product tables. This does not stop writers and is not a freeze guarantee.
 * Connection details are read from the ignored database env file and never
 * printed. TLS certificate and hostname verification are mandatory.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SOURCE_REF = "wkclodjbrynerfgufmyb";
const GREEN_REF = "qffqhilydtnrggbcnogh";
const LEADING_SLASH = /^\//;
const DB_PACKAGE = path.join(ROOT, "packages/database/package.json");
const ENV_FILE = path.join(ROOT, "packages/database/.env");
const CA_FILE = path.join(
  ROOT,
  "packages/database/certs/supabase-prod-ca-2021.crt"
);

function fail(message) {
  throw new Error(message);
}

async function main() {
  if (process.platform !== "win32") {
    fail("This read-only audit expects the prepared Windows environment.");
  }
  if (!(fs.existsSync(ENV_FILE) && fs.existsSync(CA_FILE))) {
    fail(
      "The ignored database env file or verified CA certificate is missing."
    );
  }

  const require = createRequire(DB_PACKAGE);
  const dotenv = require("dotenv");
  const { Client } = require("pg");
  const localEnv = dotenv.parse(fs.readFileSync(ENV_FILE));
  if (!localEnv.DIRECT_URL) {
    fail("The source session-pooler connection is not configured locally.");
  }

  const url = new URL(localEnv.DIRECT_URL);
  if (
    decodeURIComponent(url.username) !== `postgres.${SOURCE_REF}` ||
    url.hostname.includes(GREEN_REF) ||
    url.port !== "5432" ||
    !url.hostname.endsWith(".pooler.supabase.com") ||
    decodeURIComponent(url.pathname.replace(LEADING_SLASH, "")) !== "postgres"
  ) {
    fail("The source project/session-pooler guard failed; no query was run.");
  }
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
    url.searchParams.delete(key);
  }

  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, ca: fs.readFileSync(CA_FILE, "utf8") },
    options:
      "-c default_transaction_read_only=on -c statement_timeout=10000 -c lock_timeout=2000",
    connectionTimeoutMillis: 15_000,
  });

  try {
    await client.connect();
    const identity = (
      await client.query("SELECT current_database() AS db, current_user AS usr")
    ).rows[0];
    if (
      identity.db !== "postgres" ||
      !["postgres", `postgres.${SOURCE_REF}`].includes(identity.usr)
    ) {
      fail(
        `The connected database identity did not match the guarded source (databaseMatchesExpected=${identity.db === "postgres"}, roleMatchesAllowed=${["postgres", `postgres.${SOURCE_REF}`].includes(identity.usr)}).`
      );
    }

    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const observation = (
      await client.query(`
        WITH sessions AS (
          SELECT pid, state, xact_start, query, backend_type
          FROM pg_stat_activity
          WHERE datname = current_database()
            AND pid <> pg_backend_pid()
        ), product_write_locks AS (
          SELECT DISTINCT l.pid
          FROM pg_locks AS l
          JOIN pg_class AS c ON c.oid = l.relation
          JOIN pg_namespace AS n ON n.oid = c.relnamespace
          WHERE l.granted
            AND l.mode IN (
              'RowExclusiveLock', 'ShareRowExclusiveLock',
              'ExclusiveLock', 'AccessExclusiveLock'
            )
            AND n.nspname = 'public'
            AND c.relkind IN ('r', 'p')
        )
        SELECT
          count(*)::int AS other_sessions,
          count(*) FILTER (WHERE state = 'active')::int AS active_sessions,
          count(*) FILTER (WHERE state LIKE 'idle in transaction%')::int
            AS idle_in_transaction,
          count(*) FILTER (
            WHERE state = 'active'
              AND query ~* '^\\s*(INSERT|UPDATE|DELETE|MERGE|COPY|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|CALL|DO|REFRESH)\\y'
          )::int AS active_mutating_statements,
          count(*) FILTER (
            WHERE pid IN (SELECT pid FROM product_write_locks)
          )::int AS sessions_holding_product_write_locks,
          coalesce(
            max(extract(epoch FROM (clock_timestamp() - xact_start)))
              FILTER (WHERE xact_start IS NOT NULL),
            0
          )::int AS oldest_transaction_seconds
        FROM sessions
      `)
    ).rows[0];
    await client.query("ROLLBACK");

    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        sourceProjectRef: SOURCE_REF,
        observedAt: new Date().toISOString(),
        pointInTimeOnly: true,
        preventsWrites: false,
        tls: "verify-full",
        transactionReadOnly: true,
        ...observation,
      })}\n`
    );
  } finally {
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
