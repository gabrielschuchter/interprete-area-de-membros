import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const runtimeDatabaseUrl =
  process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL;

export const keys = () =>
  createEnv({
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
    server: {
      DATABASE_URL: z.url(),
    },
    runtimeEnv: {
      DATABASE_URL: runtimeDatabaseUrl,
    },
  });
