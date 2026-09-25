import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";
import { keys } from "./keys";
import { databaseSsl, normalizeRuntimeDatabaseUrl } from "./ssl";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const { DATABASE_URL } = keys();
const skipEnvValidation = process.env.SKIP_ENV_VALIDATION === "true";
const missingDatabaseMessage =
  "DATABASE_URL is required to use @repo/database. Configure the Supabase transaction pooler URL before running database queries.";

if (!(DATABASE_URL || skipEnvValidation)) {
  throw new Error(missingDatabaseMessage);
}

const createUnavailableDatabase = () =>
  new Proxy({} as PrismaClient, {
    get() {
      throw new Error(missingDatabaseMessage);
    },
  });

const runtimeDatabaseUrl = DATABASE_URL
  ? normalizeRuntimeDatabaseUrl(DATABASE_URL)
  : undefined;
const runtimePoolMax = 2;

const databaseWithConnection = runtimeDatabaseUrl
  ? new PrismaClient({
      adapter: new PrismaPg({
        connectionString: runtimeDatabaseUrl,
        max: runtimePoolMax,
        ssl: databaseSsl,
      }),
    })
  : createUnavailableDatabase();

export const database = globalForPrisma.prisma ?? databaseWithConnection;

if (process.env.NODE_ENV !== "production" && runtimeDatabaseUrl) {
  globalForPrisma.prisma = database;
}

export * from "./generated/client";
