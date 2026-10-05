import { keys as analytics } from "@repo/analytics/keys";
import { keys as auth } from "@repo/auth/keys";
import { keys as database } from "@repo/database/keys";
import { keys as email } from "@repo/email/keys";
import { keys as core } from "@repo/next-config/keys";
import { keys as observability } from "@repo/observability/keys";
import { keys as payments } from "@repo/payments/keys";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  extends: [
    auth(),
    analytics(),
    core(),
    database(),
    email(),
    observability(),
    payments(),
  ],
  server: {
    CRON_SECRET: z.string().min(32).optional(),
    APP_WRITE_FREEZE: z.enum(["true", "false"]).default("false"),
  },
  client: {},
  runtimeEnv: {
    CRON_SECRET: process.env.CRON_SECRET,
    APP_WRITE_FREEZE: process.env.APP_WRITE_FREEZE,
  },
});
