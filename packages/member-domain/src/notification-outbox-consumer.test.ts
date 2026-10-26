import type { Prisma } from "@repo/database";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { notificationOutboxConsumer } from "./notification-outbox-consumer";

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  AnnouncementAudience: {
    ALL: "ALL",
    COHORT: "COHORT",
    SELECTED: "SELECTED",
    STAFF: "STAFF",
  },
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  MemberRole: { ADMIN: "ADMIN", TEACHER: "TEACHER" },
}));

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("OUTBOX_QUEUE_NAMESPACE", "");
  vi.stubEnv("OUTBOX_PREVIEW_MEMBER_IDS", "qa_actor,qa_recipient");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const event = {
  id: "qa_event",
  eventType: "notifications.batch_requested",
  schemaVersion: 1,
  actorId: "qa_actor",
  aggregateType: "qa.foundation",
  aggregateId: "qa_1",
  occurredAt: new Date(),
  payload: {
    notifications: [
      {
        recipientId: "production_member",
        type: "MENTION",
        dedupeKey: "qa.notification:1",
      },
    ],
  },
};
const job = {
  id: "qa_job",
  attemptCount: 1,
  consumerKey: "preview.notifications.create.v1",
  idempotencyKey: "qa_event:preview.notifications.create.v1",
};

test("refuses a forged Preview payload before querying or writing notifications", async () => {
  const findMany = vi.fn();
  const createMany = vi.fn();
  const transaction = {
    notificationPreference: { findMany },
    notification: { createMany },
  } as unknown as Prisma.TransactionClient;
  await expect(
    notificationOutboxConsumer.handle(transaction, event, job)
  ).rejects.toThrow("Preview notifications require an authorized QA audience.");
  expect(findMany).not.toHaveBeenCalled();
  expect(createMany).not.toHaveBeenCalled();
});

test("requires an authorized Preview actor as well as an authorized recipient", async () => {
  const transaction = {} as Prisma.TransactionClient;
  await expect(
    notificationOutboxConsumer.handle(
      transaction,
      {
        ...event,
        actorId: "production_actor",
        payload: {
          notifications: [
            {
              recipientId: "qa_recipient",
              type: "MENTION",
              dedupeKey: "qa.notification:2",
            },
          ],
        },
      },
      job
    )
  ).rejects.toThrow("Preview notifications require an authorized QA audience.");
});
