const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const quoteLiteral = (value) => `'${value.replaceAll("'", "''")}'`;

const roleName = (role) =>
  role.toLowerCase() === "public" ? "PUBLIC" : quoteIdentifier(role);

export const buildPolicySql = (policy) => {
  const command = String(policy.cmd).toUpperCase();
  const permissive = String(policy.permissive).toUpperCase();
  if (
    !(
      ["ALL", "SELECT", "INSERT", "UPDATE", "DELETE"].includes(command) &&
      ["PERMISSIVE", "RESTRICTIVE"].includes(permissive) &&
      Array.isArray(policy.roles)
    ) ||
    policy.roles.length === 0
  ) {
    throw new Error("The source RLS policy metadata is incomplete.");
  }
  const roles = policy.roles.map(roleName).join(", ");
  const using = policy.qual ? ` USING (${policy.qual})` : "";
  const withCheck = policy.with_check
    ? ` WITH CHECK (${policy.with_check})`
    : "";
  return (
    `CREATE POLICY ${quoteIdentifier(policy.policyname)} ON ` +
    `${quoteIdentifier(policy.schemaname)}.${quoteIdentifier(policy.tablename)} ` +
    `AS ${permissive} FOR ${command} TO ${roles}${using}${withCheck};`
  );
};

export const buildEventTriggerSql = (trigger) => {
  const event = String(trigger.event).toLowerCase();
  if (
    !(
      [
        "ddl_command_start",
        "ddl_command_end",
        "sql_drop",
        "table_rewrite",
      ].includes(event) &&
      trigger.name &&
      trigger.function_schema &&
      trigger.function_name
    )
  ) {
    throw new Error("The source event-trigger metadata is incomplete.");
  }
  const tags =
    Array.isArray(trigger.tags) && trigger.tags.length > 0
      ? ` WHEN TAG IN (${trigger.tags.map(quoteLiteral).join(", ")})`
      : "";
  let sql =
    `CREATE EVENT TRIGGER ${quoteIdentifier(trigger.name)} ON ${event}${tags} ` +
    `EXECUTE FUNCTION ${quoteIdentifier(trigger.function_schema)}.` +
    `${quoteIdentifier(trigger.function_name)}();`;
  if (trigger.enabled === "D") {
    sql += `\nALTER EVENT TRIGGER ${quoteIdentifier(trigger.name)} DISABLE;`;
  } else if (trigger.enabled === "A") {
    sql += `\nALTER EVENT TRIGGER ${quoteIdentifier(trigger.name)} ENABLE ALWAYS;`;
  } else if (trigger.enabled === "R") {
    sql += `\nALTER EVENT TRIGGER ${quoteIdentifier(trigger.name)} ENABLE REPLICA;`;
  } else if (trigger.enabled !== "O") {
    throw new Error("The source event-trigger state is not recognized.");
  }
  return sql;
};

export const buildPublicationSql = (publication, current) => {
  if (!publication || publication.all_tables) {
    throw new Error(
      "The expected Supabase Realtime publication is missing or publishes all tables."
    );
  }
  const sourceTables = publication.tables ?? [];
  const currentTables = current?.tables ?? [];
  const keyOf = (table) => `${table.schema}.${table.table}`;
  const expectedKeys = new Set(sourceTables.map(keyOf));
  const currentKeys = new Set(currentTables.map(keyOf));
  const unexpected = [...currentKeys].filter((key) => !expectedKeys.has(key));
  if (unexpected.length > 0 || current?.all_tables) {
    throw new Error(
      "Green Realtime publication includes unapproved tables; refusing to remove or broaden membership."
    );
  }
  const operations = [
    publication.publishes_insert && "insert",
    publication.publishes_update && "update",
    publication.publishes_delete && "delete",
    publication.publishes_truncate && "truncate",
  ].filter(Boolean);
  const publicationName = quoteIdentifier(publication.publication);
  const statements = [];
  if (!current) {
    statements.push(
      `CREATE PUBLICATION ${publicationName} WITH (` +
        `publish = ${quoteLiteral(operations.join(", "))}, ` +
        `publish_via_partition_root = ${publication.publishes_via_root ? "true" : "false"});`
    );
  } else if (
    current.publishes_insert !== publication.publishes_insert ||
    current.publishes_update !== publication.publishes_update ||
    current.publishes_delete !== publication.publishes_delete ||
    current.publishes_truncate !== publication.publishes_truncate ||
    current.publishes_via_root !== publication.publishes_via_root
  ) {
    statements.push(
      `ALTER PUBLICATION ${publicationName} SET (` +
        `publish = ${quoteLiteral(operations.join(", "))}, ` +
        `publish_via_partition_root = ${publication.publishes_via_root ? "true" : "false"});`
    );
  }
  const missingTables = sourceTables.filter(
    (table) => !currentKeys.has(keyOf(table))
  );
  if (missingTables.length > 0) {
    statements.push(
      `ALTER PUBLICATION ${publicationName} ADD TABLE ` +
        missingTables
          .map(
            (table) =>
              `${quoteIdentifier(table.schema)}.${quoteIdentifier(table.table)}`
          )
          .join(", ") +
        ";"
    );
  }
  return statements;
};

export const buildExtensionSql = (expected, current, existingSchemas) => {
  const currentByName = new Map(
    current.map((extension) => [extension.name, extension])
  );
  const schemas = new Set(existingSchemas);
  const statements = [];
  const mismatches = [];
  for (const extension of expected) {
    if (!(extension.name && extension.schema_name && extension.version)) {
      throw new Error("The source extension metadata is incomplete.");
    }
    const existing = currentByName.get(extension.name);
    if (existing) {
      if (
        existing.schema_name !== extension.schema_name ||
        existing.version !== extension.version
      ) {
        mismatches.push(extension.name);
      }
      continue;
    }
    if (!schemas.has(extension.schema_name)) {
      throw new Error("The destination extension schema is missing.");
    }
    statements.push(
      `CREATE EXTENSION IF NOT EXISTS ${quoteIdentifier(extension.name)} ` +
        `WITH SCHEMA ${quoteIdentifier(extension.schema_name)} ` +
        `VERSION ${quoteLiteral(extension.version)};`
    );
  }
  if (mismatches.length > 0) {
    throw new Error(
      "A destination extension has a different schema or version; no implicit upgrade or relocation is safe."
    );
  }
  return {
    statements,
    missingNames: expected
      .filter((extension) => !currentByName.has(extension.name))
      .map((extension) => extension.name),
  };
};

export const samePolicyDefinition = (left, right) =>
  left.policyname === right.policyname &&
  left.schemaname === right.schemaname &&
  left.tablename === right.tablename &&
  String(left.permissive).toUpperCase() ===
    String(right.permissive).toUpperCase() &&
  JSON.stringify([...(left.roles ?? [])].sort()) ===
    JSON.stringify([...(right.roles ?? [])].sort()) &&
  String(left.cmd).toUpperCase() === String(right.cmd).toUpperCase() &&
  left.qual === right.qual &&
  left.with_check === right.with_check;

export const sameEventTriggerDefinition = (left, right) =>
  left.name === right.name &&
  left.event === right.event &&
  left.enabled === right.enabled &&
  JSON.stringify(left.tags ?? []) === JSON.stringify(right.tags ?? []) &&
  left.function_schema === right.function_schema &&
  left.function_name === right.function_name &&
  left.identity_arguments === right.identity_arguments;
