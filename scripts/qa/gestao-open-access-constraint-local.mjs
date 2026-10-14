import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import pg from "../../packages/database/node_modules/pg/lib/index.js";

await test("open course grants preserve subject constraints in PostgreSQL", async () => {
  const database = process.env.QA_DATABASE ?? "interprete_gestao_qa_20261012";
  assert(
    [
      "interprete_gestao_qa_20261012",
      "interprete_gestao_visual_qa_20261012",
    ].includes(database),
    "Only existing isolated QA databases are allowed"
  );
  const client = new pg.Client({
    host: "127.0.0.1",
    port: 55_433,
    user: "postgres",
    database,
    ssl: {
      ca: readFileSync(
        resolve(
          process.env.TEMP,
          "interprete-gestao-qa-20261012/local-qa-ca.crt"
        ),
        "utf8"
      ),
      rejectUnauthorized: true,
    },
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
  });
  await client.connect();
  try {
    const identity = await client.query(
      "SELECT current_database() AS db, ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()"
    );
    assert.equal(identity.rows[0].db, database);
    assert.equal(identity.rows[0].ssl, true);
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '2s'");
    const before = await client.query(
      'SELECT count(*)::int AS count FROM "AccessGrantSource"'
    );
    // Reproduce the constraint carried by the original migration. NOT VALID
    // preserves existing fixtures while enforcing the old rule on new rows.
    await client.query(
      'ALTER TABLE "AccessGrantSource" DROP CONSTRAINT IF EXISTS "AccessGrantSource_subject_check"'
    );
    await client.query(
      'ALTER TABLE "AccessGrantSource" ADD CONSTRAINT "AccessGrantSource_subject_check" CHECK (("subjectMemberId" IS NOT NULL) <> ("subjectCohortId" IS NOT NULL)) NOT VALID'
    );
    const member = (
      await client.query('SELECT id FROM "Member" ORDER BY id LIMIT 1')
    ).rows[0].id;
    const resourceId = `qa-constraint-${randomUUID()}`;
    const insert = async (origin, subject, resourceType = "COURSE") => {
      await client.query(
        'INSERT INTO "AccessGrantSource" (id, origin, "subjectMemberId", "resourceType", "resourceId", "updatedAt") VALUES ($1, $2, $3, $4, $5, now())',
        [randomUUID(), origin, subject, resourceType, resourceId]
      );
    };
    const denied = async (operation) => {
      await client.query("SAVEPOINT denied_source");
      await assert.rejects(operation, (error) => error.code === "23514");
      await client.query("ROLLBACK TO SAVEPOINT denied_source");
    };
    await denied(() => insert("OPEN_ACCESS", null));
    await client.query(
      readFileSync(
        resolve(
          "packages/database/prisma/migrations/20261014125527_course_open_access_constraint/migration.sql"
        ),
        "utf8"
      )
    );
    await insert("OPEN_ACCESS", null);
    await insert("DIRECT", member);
    await denied(() => insert("DIRECT", null));
    await denied(() => insert("OPEN_ACCESS", member));
    await denied(() => insert("OPEN_ACCESS", null, "LESSON"));
    await client.query("SAVEPOINT duplicate_source");
    await assert.rejects(
      () => insert("OPEN_ACCESS", null),
      (error) => error.code === "23505"
    );
    await client.query("ROLLBACK TO SAVEPOINT duplicate_source");
    assert.equal(
      (
        await client.query(
          'SELECT count(*)::int AS count FROM "AccessGrantSource"'
        )
      ).rows[0].count,
      before.rows[0].count + 2
    );
    await client.query("ROLLBACK");
    assert.equal(
      (
        await client.query(
          'SELECT count(*)::int AS count FROM "AccessGrantSource"'
        )
      ).rows[0].count,
      before.rows[0].count
    );
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.end();
  }
});
