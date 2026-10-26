import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST } from "../app/cron/outbox/route";

const mocks = vi.hoisted(() => ({
  batch: vi.fn(),
  recover: vi.fn(),
  env: {
    CRON_SECRET: "canonical-test-secret-with-more-than-32-characters" as
      | string
      | undefined,
    PREVIEW_OUTBOX_RECOVERY_ENABLED: "true",
    PREVIEW_OUTBOX_CRON_SECRET:
      "preview-test-secret-with-more-than-32-characters",
    OUTBOX_QUEUE_NAMESPACE: undefined,
  },
}));

vi.mock("@repo/database", () => ({ database: {} }));
vi.mock("@repo/member-domain", () => ({
  notificationOutboxConsumerKey: "notifications.create.v1",
}));
vi.mock("@repo/member-domain/server", () => ({
  processOutboxBatch: mocks.batch,
}));
vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@/lib/notification-outbox-consumer", () => ({
  notificationOutboxConsumer: {},
}));
vi.mock("@/lib/preview-outbox-recovery", () => ({
  recoverPreviewOutbox: mocks.recover,
}));

const canonicalResult = {
  claimed: 1,
  succeeded: 1,
  retried: 0,
  dead: 0,
  stale: 0,
};
const request = (secret = mocks.env.CRON_SECRET) =>
  new Request("https://canonical.example.test/cron/outbox", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://unused.example.test/test");
  vi.stubEnv("VERCEL_ENV", "production");
  mocks.env.CRON_SECRET = "canonical-test-secret-with-more-than-32-characters";
  mocks.batch.mockReset().mockResolvedValue(canonicalResult);
  mocks.recover.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("rejects unauthorized callers before either canonical work or Preview recovery", async () => {
  const response = await POST(request("wrong-bearer"));
  expect(response.status).toBe(401);
  expect(mocks.batch).not.toHaveBeenCalled();
  expect(mocks.recover).not.toHaveBeenCalled();
});

test("rejects an unconfigured canonical secret before Preview recovery", async () => {
  mocks.env.CRON_SECRET = undefined;
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(mocks.batch).not.toHaveBeenCalled();
  expect(mocks.recover).not.toHaveBeenCalled();
});

test("preserves canonical success and reports a separate Preview failure", async () => {
  mocks.recover.mockResolvedValue({
    status: "failed",
    reason: "http",
    httpStatus: 401,
  });
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toEqual({
    ...canonicalResult,
    previewRecovery: { status: "failed", reason: "http", httpStatus: 401 },
  });
  expect(mocks.batch.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.recover.mock.invocationCallOrder[0]
  );
});

test("does not run Preview recovery after a canonical batch failure", async () => {
  mocks.batch.mockRejectedValue(new Error("private failure detail"));
  const response = await POST(request());
  expect(response.status).toBe(500);
  expect(mocks.recover).not.toHaveBeenCalled();
});

test("keeps the canonical response contract unchanged when the optional hop is off", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(canonicalResult);
});
