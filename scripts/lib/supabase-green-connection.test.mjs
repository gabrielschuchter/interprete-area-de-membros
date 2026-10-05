import assert from "node:assert/strict";
import test from "node:test";
import { parseGreenSessionPoolerUrl } from "./supabase-green-connection.mjs";

const greenRef = "qffqhilydtnrggbcnogh";
const MISSING_MESSAGE = /is missing/;
const GREEN_GUARD_FAILURE = /Green guard failed/;
const validGreenUrl = `postgresql://postgres.${greenRef}:example@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`;

test("accepts only the expected green session pooler connection", () => {
  const parsed = parseGreenSessionPoolerUrl(validGreenUrl);

  assert.equal(parsed.username, `postgres.${greenRef}`);
  assert.equal(parsed.port, "5432");
  assert.equal(parsed.pathname, "/postgres");
});

test("rejects a missing green connection string", () => {
  assert.throws(() => parseGreenSessionPoolerUrl(""), MISSING_MESSAGE);
});

test("rejects the blue database even when it uses a Supavisor host", () => {
  assert.throws(
    () =>
      parseGreenSessionPoolerUrl(
        "postgresql://postgres.wkclodjbrynerfgufmyb:example@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
      ),
    GREEN_GUARD_FAILURE
  );
});

test("rejects a green direct host or transaction pooler", () => {
  assert.throws(
    () =>
      parseGreenSessionPoolerUrl(
        `postgresql://postgres.${greenRef}:example@db.${greenRef}.supabase.co:5432/postgres`
      ),
    GREEN_GUARD_FAILURE
  );
  assert.throws(
    () =>
      parseGreenSessionPoolerUrl(
        `postgresql://postgres.${greenRef}:example@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`
      ),
    GREEN_GUARD_FAILURE
  );
});
