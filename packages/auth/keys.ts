import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const optionalPrefixedString = (prefix: string) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const normalized = value.trim();
    return normalized || undefined;
  }, z.string().startsWith(prefix).optional());

const optionalPath = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}, z.string().startsWith("/").optional());

export const keys = () =>
  createEnv({
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
    server: {
      CLERK_SECRET_KEY: optionalPrefixedString("sk_"),
      CLERK_WEBHOOK_SIGNING_SECRET: optionalPrefixedString("whsec_"),
    },
    client: {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: optionalPrefixedString("pk_"),
      NEXT_PUBLIC_CLERK_SIGN_IN_URL: optionalPath,
      NEXT_PUBLIC_CLERK_SIGN_UP_URL: optionalPath,
      NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: optionalPath,
      NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: optionalPath,
    },
    runtimeEnv: {
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
      CLERK_WEBHOOK_SIGNING_SECRET: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
      NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
      NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL:
        process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
      NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL:
        process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL,
    },
  });
