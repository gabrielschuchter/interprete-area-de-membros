import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNotSupabaseProject,
  isSupabaseProjectConnection,
} from "./supabase-project-guard.mjs";

const destinationRef = "qffqhilydtnrggbcnogh";
const disabledImporterMessage = /is disabled for Supabase project/;

test("recognizes a project API URL and direct database hostname", () => {
  assert.equal(
    isSupabaseProjectConnection(
      `https://${destinationRef}.supabase.co`,
      destinationRef
    ),
    true
  );
  assert.equal(
    isSupabaseProjectConnection(
      `postgresql://postgres:example@db.${destinationRef}.supabase.co:5432/postgres`,
      destinationRef
    ),
    true
  );
});

test("recognizes the project ref in a Supavisor username", () => {
  assert.equal(
    isSupabaseProjectConnection(
      `postgresql://postgres.${destinationRef}:example@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`,
      destinationRef
    ),
    true
  );
});

test("does not flag the legacy project or unrelated URLs", () => {
  assert.equal(
    isSupabaseProjectConnection(
      "https://wkclodjbrynerfgufmyb.supabase.co",
      destinationRef
    ),
    false
  );
  assert.equal(isSupabaseProjectConnection("not a url", destinationRef), false);
});

test("blocks a historical importer when either target points at green", () => {
  assert.throws(
    () =>
      assertNotSupabaseProject({
        databaseUrl: `postgresql://postgres.${destinationRef}:example@pooler.supabase.com:5432/postgres`,
        operation: "Kiwify import",
        projectRef: destinationRef,
      }),
    disabledImporterMessage
  );
  assert.throws(
    () =>
      assertNotSupabaseProject({
        operation: "Kiwify media upload",
        projectRef: destinationRef,
        supabaseUrl: `https://${destinationRef}.supabase.co`,
      }),
    disabledImporterMessage
  );
});
