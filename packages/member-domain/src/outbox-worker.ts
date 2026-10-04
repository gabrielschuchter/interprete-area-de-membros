import { Prisma, type PrismaClient } from "@repo/database";
import { z } from "zod";
import { nextOutboxRetryAt } from "./events";

const workerOptionsSchema = z.object({
  batchSize: z.number().int().min(1).max(100).default(25),
  leaseMilliseconds: z.number().int().min(5000).max(300_000).default(60_000),
  maxAttempts: z.number().int().min(1).max(20).default(8),
  workerId: z.string().trim().min(1).max(160),
});

interface ClaimedJob {
  readonly attemptCount: number;
  readonly consumerKey: string;
  readonly eventId: string;
  readonly id: string;
  readonly idempotencyKey: string;
}

interface OutboxEvent {
  readonly actorId: string | null;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly eventType: string;
  readonly id: string;
  readonly occurredAt: Date;
  readonly payload: Prisma.JsonValue;
  readonly schemaVersion: number;
}

export interface OutboxJobContext {
  readonly attemptCount: number;
  readonly consumerKey: string;
  readonly id: string;
  readonly idempotencyKey: string;
}

export interface OutboxConsumer {
  readonly handle: (
    transaction: Prisma.TransactionClient,
    event: OutboxEvent,
    job: OutboxJobContext
  ) => Promise<void>;
}

export interface OutboxBatchResult {
  readonly claimed: number;
  readonly dead: number;
  readonly retried: number;
  readonly stale: number;
  readonly succeeded: number;
}

const claimOutboxJobs = (
  database: PrismaClient,
  consumerKeys: readonly string[],
  options: z.infer<typeof workerOptionsSchema>
): Promise<ClaimedJob[]> => {
  if (consumerKeys.length === 0) {
    return Promise.resolve([]);
  }

  return database.$queryRaw<ClaimedJob[]>(Prisma.sql`
    WITH candidates AS (
      SELECT "id"
      FROM "public"."OutboxJob"
      WHERE "consumerKey" IN (${Prisma.join(consumerKeys)})
        AND (
          (
            "status" IN (
              'PENDING'::"public"."OutboxJobStatus",
              'RETRY'::"public"."OutboxJobStatus"
            )
            AND "availableAt" <= CURRENT_TIMESTAMP
          )
          OR (
            "status" = 'PROCESSING'::"public"."OutboxJobStatus"
            AND "leaseExpiresAt" <= CURRENT_TIMESTAMP
          )
        )
      ORDER BY "availableAt" ASC, "createdAt" ASC, "id" ASC
      LIMIT ${options.batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "public"."OutboxJob" AS job
    SET
      "status" = 'PROCESSING'::"public"."OutboxJobStatus",
      "attemptCount" = job."attemptCount" + 1,
      "leaseOwner" = ${options.workerId},
      "leaseExpiresAt" = CURRENT_TIMESTAMP +
        (${options.leaseMilliseconds} * INTERVAL '1 millisecond'),
      "lastError" = NULL,
      "updatedAt" = CURRENT_TIMESTAMP
    FROM candidates
    WHERE job."id" = candidates."id"
    RETURNING
      job."id",
      job."eventId",
      job."consumerKey",
      job."idempotencyKey",
      job."attemptCount"
  `);
};

const sanitizeError = (error: unknown) => {
  const rawMessage = error instanceof Error ? error.message : "Unknown error";
  return rawMessage
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/password=[^\s&]+/gi, "password=[REDACTED]")
    .slice(0, 2000);
};

const getOutboxEvents = async (
  database: PrismaClient,
  jobs: readonly ClaimedJob[]
) => {
  if (jobs.length === 0) {
    return new Map<string, OutboxEvent>();
  }
  const events = await database.domainEvent.findMany({
    where: { id: { in: jobs.map((job) => job.eventId) } },
    select: {
      id: true,
      eventType: true,
      schemaVersion: true,
      actorId: true,
      aggregateType: true,
      aggregateId: true,
      payload: true,
      occurredAt: true,
    },
  });
  return new Map<string, OutboxEvent>(events.map((event) => [event.id, event]));
};

const processClaimedJob = async (input: {
  readonly database: PrismaClient;
  readonly job: ClaimedJob;
  readonly event: OutboxEvent | undefined;
  readonly consumer: OutboxConsumer | undefined;
  readonly options: z.infer<typeof workerOptionsSchema>;
}): Promise<"succeeded" | "stale" | "retried" | "dead"> => {
  const { database, job, event, consumer, options } = input;
  try {
    if (!(event && consumer)) {
      throw new Error("Outbox job has no event or registered consumer.");
    }
    const outcome = await database.$transaction(async (transaction) => {
      const currentJob = await transaction.outboxJob.findUnique({
        where: { id: job.id },
        select: { leaseOwner: true, status: true },
      });
      if (
        currentJob?.status !== "PROCESSING" ||
        currentJob.leaseOwner !== options.workerId
      ) {
        return "stale" as const;
      }

      await consumer.handle(transaction, event, {
        attemptCount: job.attemptCount,
        consumerKey: job.consumerKey,
        id: job.id,
        idempotencyKey: job.idempotencyKey,
      });
      const completed = await transaction.outboxJob.updateMany({
        where: {
          id: job.id,
          leaseOwner: options.workerId,
          status: "PROCESSING",
        },
        data: {
          completedAt: new Date(),
          leaseExpiresAt: null,
          leaseOwner: null,
          status: "SUCCEEDED",
        },
      });
      if (completed.count !== 1) {
        throw new Error("Outbox lease changed while processing the job.");
      }
      return "succeeded" as const;
    });
    return outcome;
  } catch (error) {
    const isDead = job.attemptCount >= options.maxAttempts;
    const now = new Date();
    await database.outboxJob.updateMany({
      where: {
        id: job.id,
        leaseOwner: options.workerId,
        status: "PROCESSING",
      },
      data: {
        availableAt: isDead
          ? now
          : nextOutboxRetryAt(job.attemptCount - 1, now),
        completedAt: isDead ? now : null,
        lastError: sanitizeError(error),
        leaseExpiresAt: null,
        leaseOwner: null,
        status: isDead ? "DEAD" : "RETRY",
      },
    });
    return isDead ? "dead" : "retried";
  }
};

export const processOutboxBatch = async (
  database: PrismaClient,
  consumers: Readonly<Record<string, OutboxConsumer>>,
  input: z.input<typeof workerOptionsSchema>
): Promise<OutboxBatchResult> => {
  const options = workerOptionsSchema.parse(input);
  const keys = Object.keys(consumers);
  const claimedJobs = await claimOutboxJobs(database, keys, options);
  const eventsById = await getOutboxEvents(database, claimedJobs);
  const result = {
    claimed: claimedJobs.length,
    dead: 0,
    retried: 0,
    stale: 0,
    succeeded: 0,
  };

  for (const claimedJob of claimedJobs) {
    const outcome = await processClaimedJob({
      database,
      job: claimedJob,
      event: eventsById.get(claimedJob.eventId),
      consumer: consumers[claimedJob.consumerKey],
      options,
    });
    result[outcome] += 1;
  }

  return result;
};
