import "server-only";

import { randomUUID } from "node:crypto";
import { database, Prisma } from "@repo/database";
import type { MutationAction } from "./mutation-contract";
import { mutationLimits } from "./mutation-contract";

export class MutationRateLimitError extends Error {
  readonly action: MutationAction;
  readonly retryAfterSeconds: number;

  constructor(action: MutationAction, retryAfterSeconds: number) {
    super("Muitas ações em sequência.");
    this.name = "MutationRateLimitError";
    this.action = action;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const isUniqueConstraintError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

const windowStartFor = (now: number, windowMs: number) =>
  new Date(Math.floor(now / windowMs) * windowMs);

const cleanupBefore = (now: number) => new Date(now - 24 * 60 * 60_000);

export const consumeMutationRateLimit = async ({
  action,
  memberId,
}: {
  readonly action: MutationAction;
  readonly memberId: string;
}) => {
  const config = mutationLimits[action];
  const now = Date.now();
  const windowStart = windowStartFor(now, config.windowMs);
  const rows = await database.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "MutationRateLimit" ("id", "memberId", "action", "windowStart", "count", "updatedAt")
    VALUES (${randomUUID()}, ${memberId}, ${action}, ${windowStart}, 1, NOW())
    ON CONFLICT ("memberId", "action", "windowStart")
    DO UPDATE SET "count" = "MutationRateLimit"."count" + 1, "updatedAt" = NOW()
    RETURNING "count"
  `);
  const count = Number(rows[0]?.count ?? 0);

  if (count === 1) {
    await database.$executeRaw(Prisma.sql`
      DELETE FROM "MutationRateLimit"
      WHERE "memberId" = ${memberId}
        AND "action" = ${action}
        AND "windowStart" < ${cleanupBefore(now)}
    `);
  }

  if (count > config.max) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowStart.getTime() + config.windowMs - now) / 1000)
    );
    mutationLog({
      action,
      memberId,
      status: "rate_limited",
      durationMs: 0,
    });
    throw new MutationRateLimitError(action, retryAfterSeconds);
  }

  return {
    count,
    limit: config.max,
    remaining: Math.max(0, config.max - count),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((windowStart.getTime() + config.windowMs - now) / 1000)
    ),
  };
};

export const mutationLog = (event: {
  readonly action: MutationAction | string;
  readonly memberId?: string | null;
  readonly requestId?: string | null;
  readonly idempotencyKey?: string | null;
  readonly status: "success" | "error" | "rate_limited" | "duplicate";
  readonly resource?: string;
  readonly durationMs?: number;
}) => {
  console.info(
    JSON.stringify({
      event: "interprete_mutation",
      ...event,
      at: new Date().toISOString(),
    })
  );
};

export const isMutationRateLimitError = (
  error: unknown
): error is MutationRateLimitError => error instanceof MutationRateLimitError;
