import type { Prisma } from "@repo/database";
import { z } from "zod";
import { enqueueDomainEvent } from "./events";

export const notificationOutboxConsumerKey = "notifications.create.v1";
const aggregateTypePattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/;
const containsControlCharacter = (value: string) =>
  [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || (code >= 127 && code <= 159);
  });

const hrefSchema = z
  .string()
  .max(2000)
  .refine(
    (href) =>
      href.startsWith("/") &&
      !href.startsWith("//") &&
      !href.includes("\\") &&
      !containsControlCharacter(href)
  )
  .nullable()
  .optional();

const notificationRequestSchema = z.object({
  recipientId: z.string().trim().min(1).max(255),
  type: z.string().trim().min(1).max(64),
  entityType: z.string().trim().min(1).max(64).nullable().optional(),
  entityId: z.string().trim().min(1).max(255).nullable().optional(),
  parentEntityType: z.string().trim().min(1).max(64).nullable().optional(),
  parentEntityId: z.string().trim().min(1).max(255).nullable().optional(),
  groupKey: z.string().trim().min(1).max(255).nullable().optional(),
  dedupeKey: z.string().trim().min(1).max(255),
  priority: z.number().int().min(0).max(100).optional(),
  href: hrefSchema,
});

const notificationBatchPayloadSchema = z.object({
  notifications: z.array(notificationRequestSchema).min(1).max(100),
});
const jsonObjectSchema = z.record(z.string(), z.json());

export type NotificationOutboxRequest = z.input<
  typeof notificationRequestSchema
>;
export type NotificationOutboxPayload = z.output<
  typeof notificationBatchPayloadSchema
>;

export const parseNotificationOutboxPayload = (payload: Prisma.JsonValue) =>
  notificationBatchPayloadSchema.parse(payload);

export const enqueueNotificationBatch = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly actorId?: string | null;
    readonly aggregateType: string;
    readonly aggregateId: string;
    readonly idempotencyKey: string;
    readonly occurredAt: Date;
    readonly notifications: readonly NotificationOutboxRequest[];
  }
) => {
  const actorId =
    input.actorId === undefined || input.actorId === null
      ? null
      : z.string().min(1).max(255).parse(input.actorId);
  const aggregateType = z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(aggregateTypePattern)
    .parse(input.aggregateType);
  const aggregateId = z.string().min(1).max(255).parse(input.aggregateId);
  const idempotencyKey = z.string().min(1).max(140).parse(input.idempotencyKey);
  if (input.notifications.length > 10_000) {
    throw new Error("A notification batch is larger than the supported limit.");
  }
  const parsedRequests = input.notifications.map((request) =>
    notificationRequestSchema.parse(request)
  );
  const batches: NotificationOutboxPayload[] = [];

  for (let offset = 0; offset < parsedRequests.length; offset += 100) {
    const notifications = parsedRequests.slice(offset, offset + 100);
    const batchIndex = Math.floor(offset / 100);
    const payload = notificationBatchPayloadSchema.parse({ notifications });
    const jsonPayload = jsonObjectSchema.parse(
      JSON.parse(JSON.stringify(payload)) as unknown
    );
    batches.push(payload);
    await enqueueDomainEvent(transaction, {
      eventType: "notifications.batch_requested",
      actorId,
      aggregateType,
      aggregateId,
      idempotencyKey: `${idempotencyKey}:batch:${batchIndex}`,
      payload: jsonPayload,
      occurredAt: input.occurredAt,
      consumers: [notificationOutboxConsumerKey],
    });
  }

  return batches;
};
