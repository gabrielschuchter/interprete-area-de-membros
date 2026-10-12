import { keys as analytics } from "@repo/analytics/keys";
import { keys as auth } from "@repo/auth/keys";
import { keys as database } from "@repo/database/keys";
import { keys as core } from "@repo/next-config/keys";
import { keys as observability } from "@repo/observability/keys";
import { keys as security } from "@repo/security/keys";
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
    observability(),
    security(),
  ],
  server: {
    YOUTUBE_API_KEY: z.string().min(1).optional(),
    YOUTUBE_DEVELOPMENT_ADAPTER: z.enum(["true", "false"]).default("false"),
    CRON_SECRET: z.string().min(32).optional(),
    APP_WRITE_FREEZE: z.enum(["true", "false"]).default("false"),
    GESTAO_V2_ENABLED: z.enum(["true", "false"]).default("false"),
    UPLOADS_PAUSED_FOR_ROLLBACK: z.enum(["true", "false"]).default("false"),
  },
  client: {},
  runtimeEnv: {
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    YOUTUBE_DEVELOPMENT_ADAPTER: process.env.YOUTUBE_DEVELOPMENT_ADAPTER,
    CRON_SECRET: process.env.CRON_SECRET,
    APP_WRITE_FREEZE: process.env.APP_WRITE_FREEZE,
    GESTAO_V2_ENABLED: process.env.GESTAO_V2_ENABLED,
    UPLOADS_PAUSED_FOR_ROLLBACK: process.env.UPLOADS_PAUSED_FOR_ROLLBACK,
  },
});
