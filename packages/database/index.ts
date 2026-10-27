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
// A page render fans out into 5 to 15 independent reads. Two sockets serialize
// that fan-out, so every extra round trip lands on the click-to-content path.
// The Supabase transaction pooler holds a server connection only while a
// statement runs, so a few client sockets per instance are cheap.
const DEFAULT_RUNTIME_POOL_MAX = 6;
const resolveRuntimePoolMax = (value: string | undefined) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12
    ? parsed
    : DEFAULT_RUNTIME_POOL_MAX;
};
const runtimePoolMax = resolveRuntimePoolMax(process.env.DATABASE_POOL_MAX);

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
export * from "./library-catalog";
