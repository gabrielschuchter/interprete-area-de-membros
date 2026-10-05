import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { compareSnapshotManifests } from "./snapshot-manifest-diff.mjs";

const hash = (value) => value.padStart(64, "0");
const fingerprint = (value) =>
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
const invalidIdentityMessage = /invalid or duplicated/;
const snapshot = (rows) => ({
  database: {
    rowSnapshots: [
      {
        schema: "public",
        table: "Example",
        rowCount: rows.length,
        perRowHashes: rows,
      },
    ],
  },
});

test("snapshot comparison distinguishes added, removed, and modified rows", () => {
  const changes = compareSnapshotManifests(
    snapshot([
      { identitySha256: hash("1"), rowSha256: hash("a") },
      { identitySha256: hash("2"), rowSha256: hash("b") },
    ]),
    snapshot([
      { identitySha256: hash("1"), rowSha256: hash("c") },
      { identitySha256: hash("3"), rowSha256: hash("d") },
    ])
  );

  assert.deepEqual(changes, [
    {
      table: "public.Example",
      beforeRows: 2,
      afterRows: 2,
      added: [fingerprint(hash("3"))],
      removed: [fingerprint(hash("2"))],
      modified: [fingerprint(hash("1"))],
    },
  ]);
});

test("snapshot comparison rejects duplicate row identities", () => {
  assert.throws(
    () =>
      compareSnapshotManifests(
        snapshot([
          { identitySha256: hash("1"), rowSha256: hash("a") },
          { identitySha256: hash("1"), rowSha256: hash("b") },
        ]),
        snapshot([{ identitySha256: hash("1"), rowSha256: hash("a") }])
      ),
    invalidIdentityMessage
  );
});
