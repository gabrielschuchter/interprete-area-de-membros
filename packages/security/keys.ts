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

export const keys = () =>
  createEnv({
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
    server: {
      ARCJET_KEY: optionalPrefixedString("ajkey_"),
    },
    runtimeEnv: {
      ARCJET_KEY: process.env.ARCJET_KEY,
    },
  });
