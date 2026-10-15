import type { Prisma } from "@repo/database";
import { z } from "zod";

const keySchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
const outboxNamespaceSchema = z.enum(["preview"]);

/** Keep Vercel Preview work separate while preserving existing Production keys. */
export const resolveOutboxConsumerKey = (consumerKey: string) => {
  const safeConsumerKey = keySchema.parse(consumerKey);
  const configuredNamespace = process.env.OUTBOX_QUEUE_NAMESPACE?.trim();
  const namespace =
    configuredNamespace ||
    (process.env.VERCEL_ENV === "preview" ? "preview" : undefined);

  if (process.env.VERCEL_ENV === "production" && namespace) {
    throw new Error("Preview outbox namespace cannot be used in Production.");
  }

  const safeNamespace = outboxNamespaceSchema.optional().parse(namespace);
  return safeNamespace
    ? keySchema.parse(`${safeNamespace}.${safeConsumerKey}`)
    : safeConsumerKey;
};

const notificationRecipientsSchema = z
  .array(z.object({ recipientId: z.string().min(1).max(255) }))
  .min(1)
  .max(100);

export const assertPreviewNotificationAudience = (
  actorId: string | null,
  recipientIds: readonly string[]
) => {
  if (
    resolveOutboxConsumerKey("notifications.create.v1") ===
    "notifications.create.v1"
  ) {
    return;
  }
  const allowedIds = new Set(
    (process.env.OUTBOX_PREVIEW_MEMBER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
  if (
    allowedIds.size === 0 ||
    allowedIds.size > 50 ||
    (actorId !== null && !allowedIds.has(actorId)) ||
    recipientIds.some((id) => !allowedIds.has(id))
  ) {
    throw new Error("Preview notifications require an authorized QA audience.");
  }
};

const eventSchema = z.object({
  eventType: keySchema,
  schemaVersion: z.number().int().positive().default(1),
  actorId: z.string().min(1).nullable().default(null),
  aggregateType: keySchema,
  aggregateId: z.string().min(1),
  idempotencyKey: keySchema,
  payload: z.record(z.string(), z.json()).default({}),
  occurredAt: z.date(),
  consumers: z.array(keySchema).max(32).default([]),
});

export type DomainEventInput = z.input<typeof eventSchema>;

export interface OutboxJobSnapshot {
  availableAt: Date;
  leaseExpiresAt: Date | null;
  status: "PENDING" | "PROCESSING" | "RETRY" | "SUCCEEDED" | "DEAD";
}

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

export const makeOutboxIdempotencyKey = (
  eventId: string,
  consumerKey: string
) => {
  const safeEventId = z.string().min(1).max(200).parse(eventId);
  const safeConsumerKey = keySchema.parse(consumerKey);
  return `${safeEventId}:${safeConsumerKey}`;
};

export const isOutboxJobClaimable = (job: OutboxJobSnapshot, now: Date) => {
  if (job.status === "PENDING" || job.status === "RETRY") {
    return job.availableAt <= now;
  }

  return (
    job.status === "PROCESSING" &&
    job.leaseExpiresAt !== null &&
    job.leaseExpiresAt <= now
  );
};

export const nextOutboxRetryAt = (attemptCount: number, now: Date) => {
  const safeAttempt = z.number().int().nonnegative().parse(attemptCount);
  const delayMs = Math.min(
    1000 * 2 ** Math.min(safeAttempt, 16),
    15 * 60 * 1000
  );
  return new Date(now.getTime() + delayMs);
};

export const withMemberIdentityLock = async <T>(
  transaction: Prisma.TransactionClient,
  memberId: string,
  operation: () => Promise<T>
) => {
  const safeMemberId = z.string().min(1).max(255).parse(memberId);
  await transaction.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${safeMemberId}, 0))::text
  `;
  return operation();
};

export const enqueueDomainEvent = async (
  transaction: Prisma.TransactionClient,
  input: DomainEventInput
) => {
  const event = eventSchema.parse(input);
  if (event.eventType === "notifications.batch_requested") {
    const recipients = notificationRecipientsSchema.parse(
      event.payload.notifications
    );
    assertPreviewNotificationAudience(
      event.actorId,
      recipients.map(({ recipientId }) => recipientId)
    );
  }
  const { consumers: requestedConsumers, ...eventData } = event;
  const consumers = [
    ...new Set(requestedConsumers.map(resolveOutboxConsumerKey)),
  ];
  const persisted = await transaction.domainEvent.upsert({
    where: { idempotencyKey: eventData.idempotencyKey },
    create: {
      ...eventData,
      payload: eventData.payload as Prisma.InputJsonObject,
    },
    update: {},
  });

  // Retries may observe a later clock; the first persisted event timestamp wins.
  if (
    persisted.eventType !== eventData.eventType ||
    persisted.schemaVersion !== eventData.schemaVersion ||
    persisted.actorId !== eventData.actorId ||
    persisted.aggregateType !== eventData.aggregateType ||
    persisted.aggregateId !== eventData.aggregateId ||
    stableJson(persisted.payload) !== stableJson(eventData.payload)
  ) {
    throw new Error("Domain event idempotency key was reused with new data.");
  }

  if (consumers.length > 0) {
    await transaction.outboxJob.createMany({
      data: [...new Set(consumers)].map((consumerKey) => ({
        eventId: persisted.id,
        consumerKey,
        idempotencyKey: makeOutboxIdempotencyKey(persisted.id, consumerKey),
      })),
      skipDuplicates: true,
    });
  }

  return persisted;
};
