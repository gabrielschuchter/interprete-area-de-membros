import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";
import { keys } from "./keys";
import { databaseSsl } from "./ssl";

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

const databaseWithConnection = DATABASE_URL
  ? new PrismaClient({
      adapter: new PrismaPg({
        connectionString: DATABASE_URL,
        max: 1,
        ssl: databaseSsl,
      }),
    })
  : createUnavailableDatabase();

export const database = globalForPrisma.prisma ?? databaseWithConnection;

if (process.env.NODE_ENV !== "production" && DATABASE_URL) {
  globalForPrisma.prisma = database;
}

export * from "./generated/client";
