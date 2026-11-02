import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { getClerkEnvironmentConfigurationError } from "./clerk-environment";

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

export const keys = (options?: { autoProxyGuardEnabled?: boolean }) => {
  const clerkConfigurationError = getClerkEnvironmentConfigurationError({
    autoProxyGuardEnabled: options?.autoProxyGuardEnabled,
    nodeEnv: process.env.NODE_ENV,
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
    vercelTargetEnv: process.env.VERCEL_TARGET_ENV,
    vercelProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    disableAutoProxy: process.env.CLERK_DISABLE_AUTO_PROXY,
    proxyVariables: [
      { name: "CLERK_PROXY_URL", value: process.env.CLERK_PROXY_URL },
      {
        name: "NEXT_PUBLIC_CLERK_PROXY_URL",
        value: process.env.NEXT_PUBLIC_CLERK_PROXY_URL,
      },
      { name: "CLERK_FAPI", value: process.env.CLERK_FAPI },
      {
        name: "NEXT_PUBLIC_CLERK_FAPI",
        value: process.env.NEXT_PUBLIC_CLERK_FAPI,
      },
    ]
      .filter(({ value }) => Boolean(value?.trim()))
      .map(({ name }) => name),
  });

  if (clerkConfigurationError) {
    throw new Error(clerkConfigurationError);
  }

  return createEnv({
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
};
