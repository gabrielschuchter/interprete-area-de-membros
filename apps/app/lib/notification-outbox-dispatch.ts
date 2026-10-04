import "server-only";

import { randomUUID } from "node:crypto";
import { database } from "@repo/database";
import { notificationOutboxConsumer } from "@repo/member-domain/notification-consumer";
import {
  notificationOutboxConsumerKey,
  processOutboxBatch,
} from "@repo/member-domain/server";

/**
 * Best-effort delivery for small user-facing notification batches. The
 * committed outbox remains authoritative; the scheduled worker recovers any
 * work that is deferred or fails here.
 */
export const dispatchPendingNotifications = async () => {
  try {
    return await processOutboxBatch(
      database,
      { [notificationOutboxConsumerKey]: notificationOutboxConsumer },
      { batchSize: 5, workerId: `app:${randomUUID()}` }
    );
  } catch (error) {
    console.error(
      "[notifications/outbox] immediate dispatch failed",
      error instanceof Error ? error.name : "UnknownError"
    );
    return null;
  }
};
