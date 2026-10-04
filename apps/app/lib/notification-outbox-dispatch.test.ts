import { expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumer: { handle: vi.fn() },
  database: { client: "database" },
  processOutboxBatch: vi.fn(),
}));
const workerIdPattern = /^app:[\da-f-]+$/;

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({ database: mocks.database }));
vi.mock("@repo/member-domain/server", () => ({
  notificationOutboxConsumerKey: "notifications.create.v1",
  processOutboxBatch: mocks.processOutboxBatch,
}));
vi.mock("@repo/member-domain/notification-consumer", () => ({
  notificationOutboxConsumer: mocks.consumer,
}));

import { dispatchPendingNotifications } from "./notification-outbox-dispatch";

test("dispatches a bounded batch with the shared notification consumer", async () => {
  const result = {
    claimed: 1,
    dead: 0,
    retried: 0,
    stale: 0,
    succeeded: 1,
  };
  mocks.processOutboxBatch.mockReset().mockResolvedValue(result);

  await expect(dispatchPendingNotifications()).resolves.toEqual(result);
  expect(mocks.processOutboxBatch).toHaveBeenCalledTimes(1);
  const [database, consumers, options] =
    mocks.processOutboxBatch.mock.calls[0] ?? [];
  expect(database).toBe(mocks.database);
  expect(consumers).toEqual({
    "notifications.create.v1": mocks.consumer,
  });
  expect(options).toMatchObject({ batchSize: 5 });
  expect(options.workerId).toMatch(workerIdPattern);
});

test("keeps the committed mutation successful when immediate dispatch fails", async () => {
  mocks.processOutboxBatch
    .mockReset()
    .mockRejectedValue(new Error("A database connection failed."));
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

  await expect(dispatchPendingNotifications()).resolves.toBeNull();
  expect(error).toHaveBeenCalledWith(
    "[notifications/outbox] immediate dispatch failed",
    "Error"
  );
  error.mockRestore();
});
