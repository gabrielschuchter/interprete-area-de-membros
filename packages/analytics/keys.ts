import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const optionalUrl = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}, z.url().optional());

const optionalPrefixedString = (prefix: string) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const normalized = value.trim();
    return normalized || undefined;
  }, z.string().startsWith(prefix).optional());

export const keys = () =>
  createEnv({
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
    client: {
      NEXT_PUBLIC_POSTHOG_KEY: optionalPrefixedString("phc_"),
      NEXT_PUBLIC_POSTHOG_HOST: optionalUrl,
      NEXT_PUBLIC_GA_MEASUREMENT_ID: optionalPrefixedString("G-"),
    },
    runtimeEnv: {
      NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    },
  });
