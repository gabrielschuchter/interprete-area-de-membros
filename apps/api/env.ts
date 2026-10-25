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
    OUTBOX_QUEUE_NAMESPACE: z.enum(["preview"]).optional(),
    OUTBOX_PREVIEW_MEMBER_IDS: z.string().optional(),
    PREVIEW_OUTBOX_RECOVERY_ENABLED: z.enum(["true", "false"]).default("false"),
    PREVIEW_OUTBOX_CRON_SECRET: z.string().min(32).optional(),
  },
  client: {},
  runtimeEnv: {
    CRON_SECRET: process.env.CRON_SECRET,
    APP_WRITE_FREEZE: process.env.APP_WRITE_FREEZE,
    OUTBOX_QUEUE_NAMESPACE: process.env.OUTBOX_QUEUE_NAMESPACE,
    OUTBOX_PREVIEW_MEMBER_IDS: process.env.OUTBOX_PREVIEW_MEMBER_IDS,
    PREVIEW_OUTBOX_RECOVERY_ENABLED:
      process.env.PREVIEW_OUTBOX_RECOVERY_ENABLED,
    PREVIEW_OUTBOX_CRON_SECRET: process.env.PREVIEW_OUTBOX_CRON_SECRET,
  },
});
