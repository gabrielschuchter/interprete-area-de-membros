import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  database: {
    libraryItem: { findFirst: vi.fn() },
    libraryItemView: { upsert: vi.fn() },
  },
  hasPublishedLibraryItemAccess: vi.fn(),
  memberAssetUrl: vi.fn(),
  requireMemberId: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  database: mocks.database,
}));
vi.mock("@/lib/learning", () => ({
  requireMemberId: mocks.requireMemberId,
}));
vi.mock("@/lib/library", () => ({
  hasPublishedLibraryItemAccess: mocks.hasPublishedLibraryItemAccess,
}));
vi.mock("@/lib/member-storage", () => ({
  memberAssetUrl: mocks.memberAssetUrl,
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireMemberId.mockResolvedValue("member_1");
  mocks.hasPublishedLibraryItemAccess.mockResolvedValue(true);
  mocks.database.libraryItem.findFirst.mockResolvedValue({
    id: "item_1",
    storagePath: null,
    url: "https://example.org/material",
  });
  mocks.database.libraryItemView.upsert.mockResolvedValue({});
});

test("authorizes, records the open and returns a private uncached redirect", async () => {
  const response = await GET(
    new Request("https://app.test/biblioteca/abrir/item_1"),
    {
      params: Promise.resolve({ id: "item_1" }),
    }
  );

  expect(mocks.hasPublishedLibraryItemAccess).toHaveBeenCalledWith(
    "item_1",
    "member_1"
  );
  expect(mocks.database.libraryItemView.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { itemId_memberId: { itemId: "item_1", memberId: "member_1" } },
      create: expect.objectContaining({ openCount: 1 }),
      update: { lastViewedAt: expect.any(Date), openCount: { increment: 1 } },
    })
  );
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("https://example.org/material");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});

test("does not record or redirect a material without current access", async () => {
  mocks.hasPublishedLibraryItemAccess.mockResolvedValue(false);

  const response = await GET(
    new Request("https://app.test/biblioteca/abrir/item_1"),
    {
      params: Promise.resolve({ id: "item_1" }),
    }
  );

  expect(response.status).toBe(404);
  expect(mocks.database.libraryItem.findFirst).not.toHaveBeenCalled();
  expect(mocks.database.libraryItemView.upsert).not.toHaveBeenCalled();
});
