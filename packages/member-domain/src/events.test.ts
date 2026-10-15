import type { Prisma } from "@repo/database";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  enqueueDomainEvent,
  isOutboxJobClaimable,
  makeOutboxIdempotencyKey,
  nextOutboxRetryAt,
  resolveOutboxConsumerKey,
} from "./events";
import { enqueueNotificationBatch } from "./notifications";

describe("member domain outbox primitives", () => {
  const now = new Date("2026-10-03T15:00:00.000Z");

  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("OUTBOX_QUEUE_NAMESPACE", "");
    vi.stubEnv(
      "OUTBOX_PREVIEW_MEMBER_IDS",
      "member_preview_1,member_preview_2"
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("uses a Preview queue namespace and keeps Production on legacy keys", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("OUTBOX_QUEUE_NAMESPACE", "");
    vi.stubEnv(
      "OUTBOX_PREVIEW_MEMBER_IDS",
      "member_preview_1,member_preview_2"
    );
    expect(resolveOutboxConsumerKey("notifications.create.v1")).toBe(
      "notifications.create.v1"
    );

    vi.stubEnv("VERCEL_ENV", "preview");
    expect(resolveOutboxConsumerKey("notifications.create.v1")).toBe(
      "preview.notifications.create.v1"
    );

    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("OUTBOX_QUEUE_NAMESPACE", "preview");
    expect(() => resolveOutboxConsumerKey("notifications.create.v1")).toThrow(
      "Preview outbox namespace cannot be used in Production."
    );
  });

  test("claims pending work only when it is due", () => {
    expect(
      isOutboxJobClaimable(
        { status: "PENDING", availableAt: now, leaseExpiresAt: null },
        now
      )
    ).toBe(true);
    expect(
      isOutboxJobClaimable(
        {
          status: "RETRY",
          availableAt: new Date(now.getTime() + 1),
          leaseExpiresAt: null,
        },
        now
      )
    ).toBe(false);
  });

  test("reclaims expired leases but keeps live and terminal work closed", () => {
    expect(
      isOutboxJobClaimable(
        {
          status: "PROCESSING",
          availableAt: now,
          leaseExpiresAt: new Date(now.getTime() - 1),
        },
        now
      )
    ).toBe(true);
    expect(
      isOutboxJobClaimable(
        {
          status: "PROCESSING",
          availableAt: now,
          leaseExpiresAt: new Date(now.getTime() + 1),
        },
        now
      )
    ).toBe(false);
    expect(
      isOutboxJobClaimable(
        { status: "SUCCEEDED", availableAt: now, leaseExpiresAt: null },
        now
      )
    ).toBe(false);
  });

  test("uses stable keys and bounded exponential retry delay", () => {
    expect(makeOutboxIdempotencyKey("event-1", "notifications.v1")).toBe(
      "event-1:notifications.v1"
    );
    expect(nextOutboxRetryAt(0, now).getTime() - now.getTime()).toBe(1000);
    expect(nextOutboxRetryAt(5, now).getTime() - now.getTime()).toBe(32_000);
    expect(nextOutboxRetryAt(50, now).getTime() - now.getTime()).toBe(
      15 * 60 * 1000
    );
  });

  test("writes idempotent event work through the caller transaction", async () => {
    const persistedEvent = {
      id: "event_123",
      eventType: "learning.content.assigned",
      schemaVersion: 1,
      actorId: "teacher_1",
      aggregateType: "assignment",
      aggregateId: "assignment_1",
      idempotencyKey: "assignment_1:created",
      payload: { targetId: "lesson_1", memberId: "member_1" },
      occurredAt: now,
      createdAt: now,
    };
    const tx = {
      domainEvent: { upsert: vi.fn().mockResolvedValue(persistedEvent) },
      outboxJob: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    } as unknown as Prisma.TransactionClient;

    await enqueueDomainEvent(tx, {
      eventType: "learning.content.assigned",
      actorId: "teacher_1",
      aggregateType: "assignment",
      aggregateId: "assignment_1",
      idempotencyKey: "assignment_1:created",
      payload: { targetId: "lesson_1", memberId: "member_1" },
      occurredAt: now,
      consumers: ["notifications.v1", "study-progress.v1", "notifications.v1"],
    });

    expect(tx.domainEvent.upsert).toHaveBeenCalledOnce();
    expect(tx.outboxJob.createMany).toHaveBeenCalledWith({
      data: [
        {
          eventId: "event_123",
          consumerKey: "notifications.v1",
          idempotencyKey: "event_123:notifications.v1",
        },
        {
          eventId: "event_123",
          consumerKey: "study-progress.v1",
          idempotencyKey: "event_123:study-progress.v1",
        },
      ],
      skipDuplicates: true,
    });
  });

  test("enqueues Preview jobs without changing the persisted event contract", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("OUTBOX_QUEUE_NAMESPACE", "");
    vi.stubEnv(
      "OUTBOX_PREVIEW_MEMBER_IDS",
      "member_preview_1,member_preview_2"
    );
    const persistedEvent = {
      id: "event_preview_1",
      eventType: "notifications.batch_requested",
      schemaVersion: 1,
      actorId: "member_preview_1",
      aggregateType: "community_post",
      aggregateId: "post_preview_1",
      idempotencyKey: "post_preview_1:comment:1",
      payload: { notifications: [{ recipientId: "member_preview_2" }] },
      occurredAt: now,
      createdAt: now,
    };
    const tx = {
      domainEvent: { upsert: vi.fn().mockResolvedValue(persistedEvent) },
      outboxJob: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    } as unknown as Prisma.TransactionClient;

    await enqueueDomainEvent(tx, {
      eventType: persistedEvent.eventType,
      actorId: persistedEvent.actorId,
      aggregateType: persistedEvent.aggregateType,
      aggregateId: persistedEvent.aggregateId,
      idempotencyKey: persistedEvent.idempotencyKey,
      payload: persistedEvent.payload,
      occurredAt: now,
      consumers: ["notifications.create.v1"],
    });

    expect(tx.domainEvent.upsert).toHaveBeenCalledOnce();
    expect(tx.outboxJob.createMany).toHaveBeenCalledWith({
      data: [
        {
          eventId: "event_preview_1",
          consumerKey: "preview.notifications.create.v1",
          idempotencyKey: "event_preview_1:preview.notifications.create.v1",
        },
      ],
      skipDuplicates: true,
    });
  });

  test("rejects Preview notification recipients before any event is persisted", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("OUTBOX_PREVIEW_MEMBER_IDS", "qa_actor,qa_recipient");
    const tx = {
      domainEvent: { upsert: vi.fn() },
      outboxJob: { createMany: vi.fn() },
    } as unknown as Prisma.TransactionClient;
    const input = {
      eventType: "notifications.batch_requested",
      actorId: "qa_actor",
      aggregateType: "qa.foundation",
      aggregateId: "qa_1",
      idempotencyKey: "qa.notification:1",
      payload: { notifications: [{ recipientId: "production_member" }] },
      occurredAt: now,
      consumers: ["notifications.create.v1"],
    };
    await expect(enqueueDomainEvent(tx, input)).rejects.toThrow(
      "Preview notifications require an authorized QA audience."
    );
    expect(tx.domainEvent.upsert).not.toHaveBeenCalled();
    expect(tx.outboxJob.createMany).not.toHaveBeenCalled();

    vi.stubEnv("OUTBOX_PREVIEW_MEMBER_IDS", "");
    await expect(
      enqueueDomainEvent(tx, {
        ...input,
        payload: { notifications: [{ recipientId: "qa_recipient" }] },
      })
    ).rejects.toThrow(
      "Preview notifications require an authorized QA audience."
    );
    expect(tx.domainEvent.upsert).not.toHaveBeenCalled();
  });
  test("rejects reusing an event key for a different fact", async () => {
    const tx = {
      domainEvent: {
        upsert: vi.fn().mockResolvedValue({
          id: "event_123",
          eventType: "learning.content.assigned",
          schemaVersion: 1,
          actorId: "teacher_1",
          aggregateType: "assignment",
          aggregateId: "assignment_1",
          idempotencyKey: "assignment_1:created",
          payload: { targetId: "lesson_1" },
          occurredAt: now,
          createdAt: now,
        }),
      },
      outboxJob: { createMany: vi.fn() },
    } as unknown as Prisma.TransactionClient;

    await expect(
      enqueueDomainEvent(tx, {
        eventType: "learning.content.assigned",
        actorId: "teacher_1",
        aggregateType: "assignment",
        aggregateId: "assignment_1",
        idempotencyKey: "assignment_1:created",
        payload: { targetId: "lesson_2" },
        occurredAt: now,
        consumers: ["notifications.v1"],
      })
    ).rejects.toThrow("Domain event idempotency key was reused with new data.");
    expect(tx.outboxJob.createMany).not.toHaveBeenCalled();
  });

  test("notification retries keep the first persisted event timestamp", async () => {
    const tx = {
      domainEvent: {
        upsert: vi.fn().mockResolvedValue({
          id: "event_123",
          eventType: "learning.content.assigned",
          schemaVersion: 1,
          actorId: "teacher_1",
          aggregateType: "assignment",
          aggregateId: "assignment_1",
          idempotencyKey: "assignment_1:created",
          payload: { targetId: "lesson_1" },
          occurredAt: now,
          createdAt: now,
        }),
      },
      outboxJob: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    } as unknown as Prisma.TransactionClient;

    await expect(
      enqueueDomainEvent(tx, {
        eventType: "learning.content.assigned",
        actorId: "teacher_1",
        aggregateType: "assignment",
        aggregateId: "assignment_1",
        idempotencyKey: "assignment_1:created",
        payload: { targetId: "lesson_1" },
        occurredAt: new Date(now.getTime() + 30_000),
        consumers: ["notifications.v1"],
      })
    ).resolves.toMatchObject({ occurredAt: now });
  });

  test("splits notification fan-out into idempotent batches of 100", async () => {
    let eventNumber = 0;
    const domainEventUpsert = vi.fn((value: unknown) => {
      const create = (value as { create: Record<string, unknown> }).create;
      eventNumber += 1;
      return { ...create, id: `event_${eventNumber}`, createdAt: now };
    });
    const tx = {
      domainEvent: { upsert: domainEventUpsert },
      outboxJob: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    } as unknown as Prisma.TransactionClient;

    const result = await enqueueNotificationBatch(tx, {
      actorId: "teacher_1",
      aggregateType: "learning_assignment",
      aggregateId: "assignment_1",
      idempotencyKey: "assignment_1:notifications",
      occurredAt: now,
      notifications: Array.from({ length: 101 }, (_, index) => ({
        recipientId: `member_${index}`,
        type: "ACTIVITY_ASSIGNED",
        dedupeKey: `activity-assigned:member_${index}:assignment_1`,
        href: "/atividades",
      })),
    });

    expect(result).toHaveLength(2);
    expect(result.map(({ notifications }) => notifications.length)).toEqual([
      100, 1,
    ]);
    expect(domainEventUpsert).toHaveBeenCalledTimes(2);
    expect(tx.outboxJob.createMany).toHaveBeenCalledTimes(2);
  });

  test("rejects external notification links before queuing work", async () => {
    const tx = {
      domainEvent: { upsert: vi.fn() },
      outboxJob: { createMany: vi.fn() },
    } as unknown as Prisma.TransactionClient;

    await expect(
      enqueueNotificationBatch(tx, {
        aggregateType: "community_post",
        aggregateId: "post_1",
        idempotencyKey: "post_1:notifications",
        occurredAt: now,
        notifications: [
          {
            recipientId: "member_1",
            type: "MENTION",
            dedupeKey: "mention:member_1:post_1",
            href: "//external.example",
          },
        ],
      })
    ).rejects.toThrow();
    expect(tx.domainEvent.upsert).not.toHaveBeenCalled();
  });
});
