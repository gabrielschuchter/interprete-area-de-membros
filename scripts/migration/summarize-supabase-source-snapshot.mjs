#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
/**
 * Opens the DPAPI-encrypted source manifest in memory and emits only aggregate
 * counts/bytes by Storage prefix. Object paths and database row data are never
 * printed.
 */
import fs from "node:fs";

function unprotectWithDpapi(bytes) {
  const command =
    "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; " +
    "$b=[Convert]::FromBase64String([Console]::In.ReadLine()); " +
    "$o=[Security.Cryptography.ProtectedData]::Unprotect($b,$null," +
    "[Security.Cryptography.DataProtectionScope]::CurrentUser); " +
    "[Console]::Out.Write([Convert]::ToBase64String($o))";
  const result = spawnSync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
    {
      input: Buffer.from(`${bytes.toString("base64")}\n`),
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    }
  );
  if (result.status !== 0 || !result.stdout?.trim()) {
    throw new Error("Current-user DPAPI could not open the source manifest.");
  }
  return Buffer.from(result.stdout.trim(), "base64");
}

function main() {
  if (process.platform !== "win32") {
    throw new Error("This manifest is protected for the current Windows user.");
  }
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    throw new Error("Pass the DPAPI-protected manifest path.");
  }
  const manifest = JSON.parse(
    unprotectWithDpapi(fs.readFileSync(manifestPath)).toString("utf8")
  );
  if (manifest.format !== "INTERPRETE-SUPABASE-SOURCE-SNAPSHOT-V1") {
    throw new Error("Source snapshot format does not match.");
  }
  const grouped = {};
  const constraintTypeCounts = {};
  for (const constraint of manifest.catalog.constraints) {
    constraintTypeCounts[constraint.type] =
      (constraintTypeCounts[constraint.type] ?? 0) + 1;
  }
  const catalogBySchema = {};
  const incrementSchemaCount = (name, collection, getSchema) => {
    for (const item of collection) {
      const schema = getSchema(item);
      if (!schema) {
        continue;
      }
      catalogBySchema[schema] ??= {};
      catalogBySchema[schema][name] = (catalogBySchema[schema][name] ?? 0) + 1;
    }
  };
  const catalogCollections = [
    ["relations", manifest.database.relations, (item) => item.schema_name],
    ["columns", manifest.database.columns, (item) => item.table_schema],
    ["constraints", manifest.catalog.constraints, (item) => item.schema_name],
    ["indexes", manifest.catalog.indexes, (item) => item.schemaname],
    ["enumTypes", manifest.catalog.enumTypes, (item) => item.schema_name],
    ["functions", manifest.catalog.functions, (item) => item.schema_name],
    ["triggers", manifest.catalog.triggers, (item) => item.schema_name],
    ["policies", manifest.catalog.policies, (item) => item.schemaname],
    [
      "managedPolicies",
      manifest.catalog.managedPolicies,
      (item) => item.schemaname,
    ],
    [
      "managedRlsRelations",
      manifest.catalog.managedRlsRelations,
      (item) => item.schema_name,
    ],
  ];
  for (const [name, collection, getSchema] of catalogCollections) {
    incrementSchemaCount(name, collection, getSchema);
  }
  const migrationObjects = manifest.storage.objects;
  const storageObjectMetadataSummary = migrationObjects.map((object) => ({
    bucket: object.bucket,
    pathSha256: crypto.createHash("sha256").update(object.path).digest("hex"),
    prefix: object.path.split("/")[0],
    sizeBytes: object.sizeBytes,
    mimeType: object.mimeType,
    metadataKeys: Object.keys(object.metadata ?? {}).sort(),
    userMetadataKeys: Object.keys(object.userMetadata ?? {}).sort(),
    ownerIdPresent: object.ownerId !== null,
    createdAtPresent: object.createdAt !== null,
    updatedAtPresent: object.updatedAt !== null,
    lastAccessedAtPresent: object.lastAccessedAt !== null,
  }));
  const migrationBytes = migrationObjects.reduce(
    (sum, object) => sum + (object.sizeBytes ?? 0),
    0
  );
  for (const object of manifest.storage.objects) {
    const prefix = object.path.split("/")[0];
    if (!grouped[prefix]) {
      grouped[prefix] = {
        objectCount: 0,
        metadataBytes: 0,
        referencedObjectCount: 0,
        referencedBytes: 0,
        unreferencedObjectCount: 0,
        unreferencedBytes: 0,
      };
    }
    const group = grouped[prefix];
    group.objectCount += 1;
    group.metadataBytes += object.sizeBytes ?? 0;
    if (object.referencedBy.length > 0) {
      group.referencedObjectCount += 1;
      group.referencedBytes += object.sizeBytes ?? 0;
    } else {
      group.unreferencedObjectCount += 1;
      group.unreferencedBytes += object.sizeBytes ?? 0;
    }
  }
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      sourceProjectRef: manifest.sourceProjectRef,
      databaseBytes: manifest.database.sizeBytes,
      databaseTables: manifest.database.rowSnapshots.length,
      databaseRows: manifest.database.rowCount,
      storageObjectCount: manifest.storage.objectCount,
      storageMetadataBytes: manifest.storage.metadataBytes,
      storageMigrationDecision: "PRESERVE_AND_COPY_ALL_INVENTORIED_OBJECTS",
      storageMigrationObjectCount: migrationObjects.length,
      storageMigrationBytes: migrationBytes,
      storagePrefixes: grouped,
      storageMetadataFieldsCaptured: [
        "originalObjectId",
        "bucket",
        "path",
        "sizeBytes",
        "mimeType",
        "metadata",
        "userMetadata",
        "ownerId",
        "createdAt",
        "updatedAt",
        "lastAccessedAt",
      ],
      storageObjectMetadataSummary,
      catalogCounts: {
        relations: manifest.database.relations.length,
        columns: manifest.database.columns.length,
        constraints: manifest.catalog.constraints.length,
        indexes: manifest.catalog.indexes.length,
        enumTypes: manifest.catalog.enumTypes.length,
        domainTypes: manifest.catalog.domainTypes.length,
        functions: manifest.catalog.functions.length,
        viewDefinitions: manifest.catalog.viewDefinitions.length,
        sequences: manifest.catalog.sequenceStates.length,
        extensions: manifest.catalog.extensions.length,
        triggers: manifest.catalog.triggers.length,
        eventTriggers: manifest.catalog.eventTriggers.length,
        policies:
          manifest.catalog.policies.length +
          manifest.catalog.managedPolicies.length,
        relationAcls: manifest.catalog.relationAcls.length,
        schemaAcls: manifest.catalog.schemaAcls.length,
        defaultAcls: manifest.catalog.defaultAcls.length,
        roles: manifest.catalog.roleAttributes.length,
        roleMemberships: manifest.catalog.roleMemberships.length,
        managedRlsRelations: manifest.catalog.managedRlsRelations.length,
      },
      constraintTypeCounts,
      extensions: manifest.catalog.extensions,
      catalogBySchema,
      authUserCount: manifest.authUserCount,
      managedPolicyCount: manifest.catalog.managedPolicies.length,
      managedPolicies: manifest.catalog.managedPolicies.map((policy) => ({
        schema: policy.schemaname,
        table: policy.tablename,
        name: policy.policyname,
        command: policy.cmd,
        roles: policy.roles,
        hasUsing: policy.qual !== null,
        hasWithCheck: policy.with_check !== null,
      })),
      publicPolicies: manifest.catalog.policies
        .filter((policy) => policy.schemaname === "public")
        .map((policy) => ({
          table: policy.tablename,
          name: policy.policyname,
          command: policy.cmd,
          roles: policy.roles,
          permissive: policy.permissive,
          hasUsing: policy.qual !== null,
          hasWithCheck: policy.with_check !== null,
        })),
      publicFunctions: manifest.catalog.functions
        .filter((fn) => fn.schema_name === "public")
        .map((fn) => ({
          schema: fn.schema_name,
          name: fn.function_name,
          identityArguments: fn.identity_arguments,
          language: fn.language,
          securityDefiner: fn.security_definer,
          volatility: fn.volatility,
          owner: fn.owner_name,
          aclGrants: fn.acl_grants,
          definitionSha256: fn.definition_sha256,
        })),
      publicRelationAclSummary: {
        anonGrantedRelations: manifest.catalog.relationAcls.filter(
          (row) => row.schema_name === "public" && row.acl?.includes("anon=")
        ).length,
        authenticatedGrantedRelations: manifest.catalog.relationAcls.filter(
          (row) =>
            row.schema_name === "public" && row.acl?.includes("authenticated=")
        ).length,
      },
      triggers: manifest.catalog.triggers.map((trigger) => ({
        schema: trigger.schema_name,
        table: trigger.table_name,
        name: trigger.trigger_name,
        enabled: trigger.enabled,
        function: `${trigger.function_schema}.${trigger.function_name}`,
      })),
      eventTriggers: manifest.catalog.eventTriggers,
      defaultAclCount: manifest.catalog.defaultAcls.length,
      publications: manifest.catalog.publications,
    })}\n`
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
    })}\n`
  );
  process.exitCode = 2;
}
