import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const optionalUrl = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  try {
    new URL(normalized);
    return normalized;
  } catch {
    // Optional observability must not prevent an application build.
    return undefined;
  }
}, z.url().optional());

export const keys = () =>
  createEnv({
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
    server: {
      BETTERSTACK_API_KEY: z.string().optional(),
      BETTERSTACK_URL: optionalUrl,

      // Added by Sentry Integration, Vercel Marketplace
      SENTRY_ORG: z.string().optional(),
      SENTRY_PROJECT: z.string().optional(),
    },
    client: {
      // Added by Sentry Integration, Vercel Marketplace
      NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
    },
    runtimeEnv: {
      BETTERSTACK_API_KEY: process.env.BETTERSTACK_API_KEY,
      BETTERSTACK_URL: process.env.BETTERSTACK_URL,
      SENTRY_ORG: process.env.SENTRY_ORG,
      SENTRY_PROJECT: process.env.SENTRY_PROJECT,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    },
  });
