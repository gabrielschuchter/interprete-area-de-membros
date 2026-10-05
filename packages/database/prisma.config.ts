import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const configuredMigrationDatabaseUrl =
  process.env.DIRECT_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? "";
const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const configuredMigrationCaPath = process.env.DATABASE_CA_CERT_PATH?.trim();
const migrationCaPath = path.resolve(
  configuredMigrationCaPath ||
    path.join(configDirectory, "certs/supabase-prod-ca-2021.crt")
);

const migrationDatabaseUrl = (() => {
  if (!configuredMigrationDatabaseUrl) {
    return "";
  }

  const url = new URL(configuredMigrationDatabaseUrl);
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
    url.searchParams.delete(key);
  }
  url.searchParams.set("sslmode", "verify-full");
  url.searchParams.set("sslrootcert", migrationCaPath);
  return url.toString();
})();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationDatabaseUrl,
  },
});
