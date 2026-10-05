const NEWLINE = /\r?\n/;
const TABLE_DATA_TOC_ENTRY =
  /^\s*\d+;\s+\d+\s+\d+\s+TABLE DATA\s+(\S+)\s+(\S+)\s+\S+/;
const COPY_HEADER =
  /^COPY\s+(?:"((?:[^"]|"")*)"|([A-Za-z_][\w$]*))\.(?:"((?:[^"]|"")*)"|([A-Za-z_][\w$]*))\s+\(/;
const PRISMA_MIGRATION_TABLE = "public._prisma_migrations";
const COPY_COLUMNS_SUFFIX = /\)\s+FROM stdin;$/;
const WHITESPACE = /\s/;
const RESTORE_ENTRY_LINE = /^\s*\d+;/;
const RESTORE_SCHEMA_ENTRY =
  /^\s*\d+;\s+\d+\s+\d+\s+SCHEMA\s+-\s+(public|supabase_migrations)\s+/;

const unquoteIdentifier = (value) => value.replaceAll('""', '"');

const copyTableKey = (line) => {
  const match = COPY_HEADER.exec(line);
  if (!match) {
    return null;
  }
  const schema = unquoteIdentifier(match[1] ?? match[2]);
  const table = unquoteIdentifier(match[3] ?? match[4]);
  return `${schema}.${table}`;
};

const parseCopyColumns = (line) => {
  const open = line.indexOf("(");
  const close = line.lastIndexOf(")");
  if (
    open < 0 ||
    close < open ||
    !COPY_COLUMNS_SUFFIX.test(line.slice(close))
  ) {
    throw new Error("Archive migration-ledger COPY header is malformed.");
  }
  return line
    .slice(open + 1, close)
    .split(",")
    .map((column) => column.trim().replace(/^"|"$/g, ""));
};

const splitCopyFields = (line) => {
  const fields = [];
  let field = "";
  let escaped = false;
  for (const character of line) {
    if (character === "\\") {
      escaped = !escaped;
      field += character;
      continue;
    }
    if (character === "\t" && !escaped) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
    escaped = false;
  }
  fields.push(field);
  return fields;
};

export const verifyTableDataEntries = (toc, rowSnapshots) => {
  const actual = new Set(
    toc
      .split(NEWLINE)
      .map((line) => TABLE_DATA_TOC_ENTRY.exec(line))
      .filter(Boolean)
      .map((match) => `${match[1]}.${match[2]}`)
  );
  const expected = new Set(
    rowSnapshots.map((table) => `${table.schema}.${table.table}`)
  );
  const missing = [...expected].filter((key) => !actual.has(key));
  const unexpected = [...actual].filter((key) => !expected.has(key));
  if (missing.length || unexpected.length || actual.size !== expected.size) {
    throw new Error(
      "Archive table-data entries do not match the source snapshot table set."
    );
  }
  return actual.size;
};

export const verifyCopyRowCounts = (copySql, rowSnapshots) => {
  const counts = new Map();
  let activeTable = null;
  for (const line of copySql.split(NEWLINE)) {
    if (activeTable) {
      if (line === "\\.") {
        activeTable = null;
      } else {
        counts.set(activeTable, (counts.get(activeTable) ?? 0) + 1);
      }
      continue;
    }
    activeTable = copyTableKey(line);
    if (activeTable) {
      counts.set(activeTable, 0);
    }
  }
  if (activeTable) {
    throw new Error("Archive data stream has an unterminated COPY block.");
  }

  let totalRows = 0;
  for (const snapshot of rowSnapshots) {
    const key = `${snapshot.schema}.${snapshot.table}`;
    const actual = counts.get(key);
    if (actual === undefined || actual !== snapshot.rowCount) {
      throw new Error("Archive row counts do not match the source snapshot.");
    }
    totalRows += actual;
  }
  if (counts.size !== rowSnapshots.length) {
    throw new Error("Archive data stream contains an unexpected table.");
  }
  return { tableCount: counts.size, rowCount: totalRows };
};

export const extractPrismaMigrationLedger = (copySql) => {
  let columns = null;
  let inLedgerCopy = false;
  const records = [];

  for (const line of copySql.split(NEWLINE)) {
    if (inLedgerCopy) {
      if (line === "\\.") {
        inLedgerCopy = false;
        continue;
      }
      const values = splitCopyFields(line);
      if (values.length !== columns.length) {
        throw new Error(
          "Archive migration-ledger row has an invalid field count."
        );
      }
      const record = Object.fromEntries(
        columns.map((column, index) => [
          column,
          values[index] === "\\N" ? null : values[index],
        ])
      );
      records.push({
        migrationName: record.migration_name,
        checksum: record.checksum,
        finishedAt: record.finished_at,
        rolledBackAt: record.rolled_back_at,
        appliedStepsCount: record.applied_steps_count,
      });
      continue;
    }

    if (copyTableKey(line) === PRISMA_MIGRATION_TABLE) {
      columns = parseCopyColumns(line);
      inLedgerCopy = true;
    }
  }

  if (inLedgerCopy || !columns) {
    throw new Error(
      "Archive does not contain a complete Prisma migration ledger."
    );
  }
  return records;
};

export const reconcilePrismaMigrationLedger = (records, migrations) => {
  const expected = new Map(
    migrations.map(({ name, checksum }) => [name, checksum])
  );
  const active = new Map();

  for (const record of records) {
    const expectedChecksum = expected.get(record.migrationName);
    if (!expectedChecksum || expectedChecksum !== record.checksum) {
      throw new Error(
        "Prisma migration ledger contains an unknown migration or checksum drift."
      );
    }
    if (record.finishedAt === null && record.rolledBackAt === null) {
      throw new Error(
        "Prisma migration ledger contains an incomplete attempt."
      );
    }
    if (record.finishedAt !== null && record.rolledBackAt === null) {
      const count = (active.get(record.migrationName) ?? 0) + 1;
      if (count > 1) {
        throw new Error(
          "Prisma migration ledger has duplicate applied entries."
        );
      }
      active.set(record.migrationName, count);
    }
  }

  const applied = [...active.keys()].sort();
  const pending = [...expected.keys()]
    .filter((name) => !active.has(name))
    .sort();
  return { applied, pending, attemptCount: records.length };
};

export const comparePerRowHashes = (sourceRows, targetRows) => {
  const counts = new Map();
  for (const row of sourceRows) {
    const key = `${row.identitySha256}:${row.rowSha256}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const row of targetRows) {
    const key = `${row.identitySha256}:${row.rowSha256}`;
    const count = counts.get(key) ?? 0;
    if (count === 0) {
      return false;
    }
    if (count === 1) {
      counts.delete(key);
    } else {
      counts.set(key, count - 1);
    }
  }
  return counts.size === 0;
};

export const compactJsonText = (value) => {
  let inString = false;
  let escaped = false;
  let compact = "";
  for (const character of value) {
    if (inString) {
      compact += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      compact += character;
    } else if (!WHITESPACE.test(character)) {
      compact += character;
    }
  }
  if (inString || escaped) {
    throw new Error("Archive row JSON is malformed.");
  }
  return compact;
};

const PLATFORM_RLS_FUNCTION_ENTRY =
  /^\d+; \d+ \d+ FUNCTION public rls_auto_enable\(\) \S+$/;
const MANAGED_DEFAULT_ACL_ENTRY =
  /^\d+; \d+ \d+ DEFAULT ACL public DEFAULT PRIVILEGES FOR (TABLES|SEQUENCES|FUNCTIONS) supabase_admin$/;

export const prepareRestoreToc = (
  toc,
  { existingRlsFunction = false, existingManagedDefaults = false } = {}
) => {
  const lines = toc.split(NEWLINE);
  const schemaEntries = lines.filter((line) => RESTORE_SCHEMA_ENTRY.test(line));
  const presentSchemas = new Set(
    schemaEntries.map((line) => RESTORE_SCHEMA_ENTRY.exec(line)?.[1])
  );
  if (
    !(presentSchemas.has("public") && presentSchemas.has("supabase_migrations"))
  ) {
    throw new Error(
      "Archive TOC does not contain both expected application schemas."
    );
  }
  const functionEntries = existingRlsFunction
    ? lines.filter((line) => PLATFORM_RLS_FUNCTION_ENTRY.test(line))
    : [];
  if (existingRlsFunction && functionEntries.length !== 1) {
    throw new Error(
      "Archive must contain exactly one verified platform RLS function entry."
    );
  }
  const defaultEntries = existingManagedDefaults
    ? lines.filter((line) => MANAGED_DEFAULT_ACL_ENTRY.test(line))
    : [];
  if (existingManagedDefaults && defaultEntries.length !== 3) {
    throw new Error(
      "Archive must contain exactly three verified managed default privilege entries."
    );
  }
  const filtered = lines.filter(
    (line) =>
      !(
        RESTORE_SCHEMA_ENTRY.test(line) ||
        (existingRlsFunction && PLATFORM_RLS_FUNCTION_ENTRY.test(line)) ||
        (existingManagedDefaults && MANAGED_DEFAULT_ACL_ENTRY.test(line))
      )
  );
  return {
    list: filtered.join("\n"),
    excludedSchemaEntries: schemaEntries.length,
    excludedFunctionEntries: functionEntries.length,
    excludedDefaultEntries: defaultEntries.length,
    remainingEntries: filtered.filter((line) => RESTORE_ENTRY_LINE.test(line))
      .length,
  };
};
