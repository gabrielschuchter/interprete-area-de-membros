import type { Prisma, PrismaClient } from "@repo/database";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { processOutboxBatch } from "./outbox-worker";

const mocks = vi.hoisted(() => ({ joinedConsumerKeys: [] as string[][] }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray) => ({
      sql: strings.reduce(
        (query, part, index) => `${query}${index > 0 ? "?" : ""}${part}`,
        ""
      ),
    }),
    join: (values: readonly unknown[]) => {
      mocks.joinedConsumerKeys.push(values.map(String));
      return values.map(() => "?").join(", ");
    },
  },
}));

beforeEach(() => {
  mocks.joinedConsumerKeys.length = 0;
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("OUTBOX_QUEUE_NAMESPACE", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test("claims UTC-naive outbox timestamps independently of the session timezone", async () => {
  const queryRaw = vi.fn().mockResolvedValue([]);
  const database = { $queryRaw: queryRaw } as unknown as PrismaClient;

  await expect(
    processOutboxBatch(
      database,
      { "test.consumer": { handle: vi.fn() } },
      { workerId: "test-worker" }
    )
  ).resolves.toEqual({
    claimed: 0,
    dead: 0,
    retried: 0,
    stale: 0,
    succeeded: 0,
  });

  const [query] = queryRaw.mock.calls[0] as [Prisma.Sql];
  expect(mocks.joinedConsumerKeys).toEqual([["test.consumer"]]);
  expect(query.sql).toContain(
    `"availableAt" <= timezone('UTC', CURRENT_TIMESTAMP)`
  );
  expect(query.sql).toContain(
    `"leaseExpiresAt" <= timezone('UTC', CURRENT_TIMESTAMP)`
  );
  expect(query.sql).toContain(
    `"leaseExpiresAt" = timezone('UTC', CURRENT_TIMESTAMP)`
  );
  expect(query.sql).toContain(
    `"updatedAt" = timezone('UTC', CURRENT_TIMESTAMP)`
  );
});

test("Preview workers claim only the Preview-scoped consumer key", async () => {
  vi.stubEnv("VERCEL_ENV", "preview");
  const queryRaw = vi.fn().mockResolvedValue([]);
  const database = { $queryRaw: queryRaw } as unknown as PrismaClient;

  await processOutboxBatch(
    database,
    { "notifications.create.v1": { handle: vi.fn() } },
    { workerId: "preview-worker" }
  );

  expect(mocks.joinedConsumerKeys).toEqual([
    ["preview.notifications.create.v1"],
  ]);
});
