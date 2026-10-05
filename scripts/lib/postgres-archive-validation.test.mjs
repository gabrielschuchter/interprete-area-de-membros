import assert from "node:assert/strict";
import test from "node:test";
import {
  compactJsonText,
  comparePerRowHashes,
  extractPrismaMigrationLedger,
  prepareRestoreToc,
  reconcilePrismaMigrationLedger,
  verifyCopyRowCounts,
  verifyTableDataEntries,
} from "./postgres-archive-validation.mjs";

const TABLE_DATA_MISMATCH = /table-data entries do not match/;
const ROW_COUNT_MISMATCH = /row counts do not match/;
const UNTERMINATED_COPY = /unterminated COPY block/;
const CHECKSUM_DRIFT = /checksum drift/;
const INCOMPLETE_ATTEMPT = /incomplete attempt/;
const DUPLICATE_APPLIED = /duplicate applied/;
const MALFORMED_JSON = /malformed/;
const RESTORE_SCHEMAS = /SCHEMA - (public|supabase_migrations)/;
const TABLE_DATA_MEMBER = /TABLE DATA public Member/;
const EXPECTED_RESTORE_SCHEMAS = /both expected application schemas/;
const snapshots = [
  { schema: "public", table: "Member", rowCount: 2 },
  { schema: "public", table: "Empty", rowCount: 0 },
  { schema: "supabase_migrations", table: "schema_migrations", rowCount: 1 },
];

test("requires one archive table-data entry for every snapshot table", () => {
  const toc = [
    "12; 0 0 TABLE DATA public Member postgres",
    "13; 0 0 TABLE DATA public Empty postgres",
    "14; 0 0 TABLE DATA supabase_migrations schema_migrations postgres",
  ].join("\n");

  assert.equal(verifyTableDataEntries(toc, snapshots), 3);
  assert.throws(
    () =>
      verifyTableDataEntries(
        toc.replace("TABLE DATA public Empty postgres", ""),
        snapshots
      ),
    TABLE_DATA_MISMATCH
  );
});

test("counts restored COPY rows, including empty tables and quoted identifiers", () => {
  const copySql = [
    'COPY public."Member" ("id") FROM stdin;',
    "m-1",
    "m-2",
    "\\.",
    'COPY public."Empty" ("id") FROM stdin;',
    "\\.",
    'COPY "supabase_migrations"."schema_migrations" ("version") FROM stdin;',
    "20260924",
    "\\.",
  ].join("\n");

  assert.deepEqual(verifyCopyRowCounts(copySql, snapshots), {
    tableCount: 3,
    rowCount: 3,
  });
});

test("rejects missing, extra, or unterminated data blocks", () => {
  assert.throws(
    () =>
      verifyCopyRowCounts(
        'COPY public."Member" ("id") FROM stdin;\n\\.\n',
        snapshots
      ),
    ROW_COUNT_MISMATCH
  );
  assert.throws(
    () =>
      verifyCopyRowCounts(
        'COPY public."Member" ("id") FROM stdin;\nm-1\nm-2\n',
        snapshots
      ),
    UNTERMINATED_COPY
  );
});

test("extracts only Prisma migration identity and status from COPY rows", () => {
  const copySql = [
    'COPY public."_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") FROM stdin;',
    "id-1\tchecksum-1\t2026-10-01 10:00:00+00\t20260924170000_learning_foundation\tlog\\ttext\t\\N\t2026-10-01 10:00:00+00\t0",
    "\\.",
  ].join("\n");

  assert.deepEqual(extractPrismaMigrationLedger(copySql), [
    {
      migrationName: "20260924170000_learning_foundation",
      checksum: "checksum-1",
      finishedAt: "2026-10-01 10:00:00+00",
      rolledBackAt: null,
      appliedStepsCount: "0",
    },
  ]);
});

test("reconciles applied checksums, rolled-back attempts, and pending migrations", () => {
  const result = reconcilePrismaMigrationLedger(
    [
      {
        migrationName: "first",
        checksum: "sha-first",
        finishedAt: "2026-10-01 10:00:00+00",
        rolledBackAt: null,
        appliedStepsCount: "0",
      },
      {
        migrationName: "second",
        checksum: "sha-second",
        finishedAt: null,
        rolledBackAt: "2026-10-01 10:00:00+00",
        appliedStepsCount: "0",
      },
    ],
    [
      { name: "first", checksum: "sha-first" },
      { name: "second", checksum: "sha-second" },
      { name: "third", checksum: "sha-third" },
    ]
  );

  assert.deepEqual(result, {
    applied: ["first"],
    pending: ["second", "third"],
    attemptCount: 2,
  });
});

test("rejects checksum drift, incomplete attempts, and duplicate applied entries", () => {
  const migrations = [{ name: "first", checksum: "sha-first" }];
  const record = {
    migrationName: "first",
    checksum: "sha-first",
    finishedAt: "2026-10-01 10:00:00+00",
    rolledBackAt: null,
    appliedStepsCount: "1",
  };

  assert.throws(
    () =>
      reconcilePrismaMigrationLedger(
        [{ ...record, checksum: "sha-other" }],
        migrations
      ),
    CHECKSUM_DRIFT
  );
  assert.throws(
    () =>
      reconcilePrismaMigrationLedger(
        [{ ...record, finishedAt: null }],
        migrations
      ),
    INCOMPLETE_ATTEMPT
  );
  assert.throws(
    () => reconcilePrismaMigrationLedger([record, record], migrations),
    DUPLICATE_APPLIED
  );
});

test("compares row identities and values as a multiset without exposing row data", () => {
  const source = [
    { identitySha256: "id-a", rowSha256: "row-a" },
    { identitySha256: "id-b", rowSha256: "row-b" },
    { identitySha256: "duplicate", rowSha256: "same" },
    { identitySha256: "duplicate", rowSha256: "same" },
  ];

  assert.equal(comparePerRowHashes(source, [...source].reverse()), true);
  assert.equal(
    comparePerRowHashes(source, [
      ...source.slice(0, 3),
      { identitySha256: "id-b", rowSha256: "changed" },
    ]),
    false
  );
  assert.equal(comparePerRowHashes(source, source.slice(0, 3)), false);
});

test("compacts PostgreSQL JSON whitespace without changing strings or numbers", () => {
  assert.equal(
    compactJsonText('{ "caption" : "a  b \\"c\\"", "n" : 9007199254740993 }'),
    '{"caption":"a  b \\"c\\"","n":9007199254740993}'
  );
  assert.throws(() => compactJsonText('{"unfinished":"value}'), MALFORMED_JSON);
});

test("restore TOC omits only the two provisioned schema create entries", () => {
  const prepared = prepareRestoreToc(
    [
      "; archive metadata",
      "1; 2615 2200 SCHEMA - public postgres",
      "2; 2615 9000 SCHEMA - supabase_migrations postgres",
      "3; 1259 9001 TABLE public Member postgres",
      "4; 0 0 TABLE DATA public Member postgres",
    ].join("\n")
  );

  assert.equal(prepared.excludedSchemaEntries, 2);
  assert.equal(prepared.remainingEntries, 2);
  assert.doesNotMatch(prepared.list, RESTORE_SCHEMAS);
  assert.match(prepared.list, TABLE_DATA_MEMBER);
  assert.throws(
    () => prepareRestoreToc("1; 1259 9001 TABLE public Member postgres"),
    EXPECTED_RESTORE_SCHEMAS
  );
});

test("restore TOC preserves function ACLs when an identical platform function already exists", () => {
  const toc = [
    "1; 2615 2200 SCHEMA - public postgres",
    "2; 2615 9000 SCHEMA - supabase_migrations postgres",
    "3; 1255 9001 FUNCTION public rls_auto_enable() postgres",
    "4; 0 0 ACL public FUNCTION rls_auto_enable() postgres",
    "5; 1255 9002 FUNCTION public custom_function() postgres",
  ].join("\n");
  assert.equal(prepareRestoreToc(toc).excludedFunctionEntries, 0);
  const prepared = prepareRestoreToc(toc, { existingRlsFunction: true });
  assert.equal(prepared.excludedFunctionEntries, 1);
  assert.equal(prepared.remainingEntries, 2);
  assert.ok(prepared.list.includes("ACL public FUNCTION rls_auto_enable()"));
  assert.ok(prepared.list.includes("FUNCTION public custom_function()"));
  assert.throws(() =>
    prepareRestoreToc(toc.replace("rls_auto_enable()", "other()"), {
      existingRlsFunction: true,
    })
  );
});

test("restore TOC skips only all three independently verified platform default ACLs", () => {
  const toc = [
    "1; 2615 2200 SCHEMA - public postgres",
    "2; 2615 9000 SCHEMA - supabase_migrations postgres",
    "3; 0 0 DEFAULT ACL public DEFAULT PRIVILEGES FOR TABLES supabase_admin",
    "4; 0 0 DEFAULT ACL public DEFAULT PRIVILEGES FOR SEQUENCES supabase_admin",
    "5; 0 0 DEFAULT ACL public DEFAULT PRIVILEGES FOR FUNCTIONS supabase_admin",
    "6; 0 0 DEFAULT ACL public DEFAULT PRIVILEGES FOR TABLES postgres",
  ].join("\n");
  assert.equal(prepareRestoreToc(toc).excludedDefaultEntries, 0);
  const prepared = prepareRestoreToc(toc, { existingManagedDefaults: true });
  assert.equal(prepared.excludedDefaultEntries, 3);
  assert.equal(prepared.remainingEntries, 1);
  assert.ok(prepared.list.includes("DEFAULT PRIVILEGES FOR TABLES postgres"));
  assert.throws(() =>
    prepareRestoreToc(
      toc.replace("FOR SEQUENCES supabase_admin", "FOR SEQUENCES other"),
      { existingManagedDefaults: true }
    )
  );
});
