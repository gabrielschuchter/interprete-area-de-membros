import crypto from "node:crypto";

const fingerprint = (value) =>
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
const sha256Pattern = /^[a-f0-9]{64}$/i;

const indexedRows = (table) => {
  const rows = table.perRowHashes;
  if (!Array.isArray(rows) || rows.length !== table.rowCount) {
    throw new Error("Snapshot row hashes do not match the table row count.");
  }
  const index = new Map();
  for (const row of rows) {
    if (
      typeof row.identitySha256 !== "string" ||
      !sha256Pattern.test(row.identitySha256) ||
      typeof row.rowSha256 !== "string" ||
      !sha256Pattern.test(row.rowSha256) ||
      index.has(row.identitySha256)
    ) {
      throw new Error(
        "Snapshot row identity hashes are invalid or duplicated."
      );
    }
    index.set(row.identitySha256, row.rowSha256);
  }
  return index;
};

export const compareSnapshotManifests = (before, after) => {
  const beforeTables = new Map(
    before.database.rowSnapshots.map((table) => [
      `${table.schema}.${table.table}`,
      table,
    ])
  );
  const afterTables = new Map(
    after.database.rowSnapshots.map((table) => [
      `${table.schema}.${table.table}`,
      table,
    ])
  );
  if (
    beforeTables.size !== afterTables.size ||
    [...beforeTables.keys()].some((key) => !afterTables.has(key))
  ) {
    throw new Error("Snapshots do not contain the same table set.");
  }

  const changes = [];
  for (const [key, oldTable] of beforeTables) {
    const newTable = afterTables.get(key);
    const oldRows = indexedRows(oldTable);
    const newRows = indexedRows(newTable);
    const added = [];
    const removed = [];
    const modified = [];
    for (const [identity, rowHash] of oldRows) {
      if (!newRows.has(identity)) {
        removed.push(fingerprint(identity));
      } else if (newRows.get(identity) !== rowHash) {
        modified.push(fingerprint(identity));
      }
    }
    for (const identity of newRows.keys()) {
      if (!oldRows.has(identity)) {
        added.push(fingerprint(identity));
      }
    }
    if (added.length || removed.length || modified.length) {
      changes.push({
        table: key,
        beforeRows: oldTable.rowCount,
        afterRows: newTable.rowCount,
        added,
        removed,
        modified,
      });
    }
  }
  return changes;
};
