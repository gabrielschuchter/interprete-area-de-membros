import type { Prisma, PrismaClient } from "@repo/database";
import { expect, test, vi } from "vitest";
import { processOutboxBatch } from "./outbox-worker";

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray) => ({
      sql: strings.reduce(
        (query, part, index) => `${query}${index > 0 ? "?" : ""}${part}`,
        ""
      ),
    }),
    join: (values: readonly unknown[]) => values.map(() => "?").join(", "),
  },
}));

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
