import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEventTriggerSql,
  buildExtensionSql,
  buildPolicySql,
  buildPublicationSql,
  sameEventTriggerDefinition,
  samePolicyDefinition,
} from "./supabase-project-config.mjs";

const EXPECTED_SCHEMA = /missing or publishes all tables/;
const UNAPPROVED_PUBLICATION_TABLE = /unapproved tables/;
const OWN_CHANNEL_POLICY =
  /CREATE POLICY "member's own channel" ON "realtime"\."messages"/;
const AUTHENTICATED_POLICY = /TO "authenticated" USING/;
const EXTENSION_DRIFT = /different schema or version/;
const MISSING_EXTENSION_SCHEMA = /extension schema is missing/;

test("rebuilds a managed-schema RLS policy from catalog metadata", () => {
  const sql = buildPolicySql({
    schemaname: "realtime",
    tablename: "messages",
    policyname: "member's own channel",
    permissive: "PERMISSIVE",
    roles: ["authenticated"],
    cmd: "SELECT",
    qual: "(SELECT realtime.topic()) = 'member-notifications:'",
    with_check: null,
  });

  assert.match(sql, OWN_CHANNEL_POLICY);
  assert.match(sql, AUTHENTICATED_POLICY);
  assert.equal(
    samePolicyDefinition(
      {
        schemaname: "realtime",
        tablename: "messages",
        policyname: "presence",
        permissive: "PERMISSIVE",
        roles: ["authenticated", "service_role"],
        cmd: "SELECT",
        qual: "true",
        with_check: null,
      },
      {
        schemaname: "realtime",
        tablename: "messages",
        policyname: "presence",
        permissive: "permissive",
        roles: ["service_role", "authenticated"],
        cmd: "select",
        qual: "true",
        with_check: null,
      }
    ),
    true
  );
});

test("rebuilds event triggers with tags and enabled state", () => {
  const trigger = {
    name: "ensure_rls",
    event: "ddl_command_end",
    enabled: "O",
    tags: ["CREATE TABLE", "CREATE TABLE AS"],
    function_schema: "public",
    function_name: "rls_auto_enable",
    identity_arguments: "",
  };
  assert.equal(
    buildEventTriggerSql(trigger),
    'CREATE EVENT TRIGGER "ensure_rls" ON ddl_command_end WHEN TAG IN (\'CREATE TABLE\', \'CREATE TABLE AS\') EXECUTE FUNCTION "public"."rls_auto_enable"();'
  );
  assert.equal(sameEventTriggerDefinition(trigger, trigger), true);
});

test("publication reconcile adds only missing expected tables and preserves safe settings", () => {
  const source = {
    publication: "supabase_realtime",
    all_tables: false,
    publishes_insert: true,
    publishes_update: true,
    publishes_delete: true,
    publishes_truncate: true,
    publishes_via_root: false,
    tables: [{ schema: "public", table: "Notification" }],
  };
  assert.deepEqual(buildPublicationSql(source, null), [
    "CREATE PUBLICATION \"supabase_realtime\" WITH (publish = 'insert, update, delete, truncate', publish_via_partition_root = false);",
    'ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."Notification";',
  ]);
  assert.deepEqual(buildPublicationSql(source, { ...source, tables: [] }), [
    'ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."Notification";',
  ]);
  assert.throws(
    () =>
      buildPublicationSql(source, {
        ...source,
        tables: [{ schema: "public", table: "Other" }],
      }),
    UNAPPROVED_PUBLICATION_TABLE
  );
  assert.throws(
    () => buildPublicationSql({ ...source, all_tables: true }, null),
    EXPECTED_SCHEMA
  );
});

test("recreates only missing extensions at their inventoried version and schema", () => {
  const expected = [
    { name: "pgcrypto", version: "1.3", schema_name: "extensions" },
  ];
  assert.deepEqual(buildExtensionSql(expected, [], ["extensions"]), {
    statements: [
      'CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions" VERSION \'1.3\';',
    ],
    missingNames: ["pgcrypto"],
  });
  assert.deepEqual(buildExtensionSql(expected, expected, ["extensions"]), {
    statements: [],
    missingNames: [],
  });
  assert.throws(
    () =>
      buildExtensionSql(
        expected,
        [{ ...expected[0], version: "1.4" }],
        ["extensions"]
      ),
    EXTENSION_DRIFT
  );
  assert.throws(
    () => buildExtensionSql(expected, [], []),
    MISSING_EXTENSION_SCHEMA
  );
});
