import "dotenv/config";
import { defineConfig } from "prisma/config";

const migrationDatabaseUrl =
  process.env.DIRECT_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationDatabaseUrl,
  },
});
