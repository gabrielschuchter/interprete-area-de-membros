import { describe, expect, it } from "vitest";
import {
  gestaoCourseStatusWhere,
  normalizeGestaoCourseFilters,
  resolveGestaoCourseState,
} from "./gestao-course-catalog";

const now = new Date("2026-10-12T12:00:00.000Z");

describe("Gestao course catalog", () => {
  it("derives scheduled only from a future publication time on a draft", () => {
    expect(
      resolveGestaoCourseState(
        { status: "DRAFT", publishedAt: new Date("2026-10-13T12:00:00.000Z") },
        now
      )
    ).toBe("SCHEDULED");
    expect(
      resolveGestaoCourseState(
        { status: "DRAFT", publishedAt: new Date("2026-10-12T12:00:00.000Z") },
        now
      )
    ).toBe("DRAFT");
  });

  it("keeps published and archived states authoritative over their timestamps", () => {
    expect(
      resolveGestaoCourseState(
        {
          status: "PUBLISHED",
          publishedAt: new Date("2027-01-01T00:00:00.000Z"),
        },
        now
      )
    ).toBe("PUBLISHED");
    expect(
      resolveGestaoCourseState({ status: "ARCHIVED", publishedAt: null }, now)
    ).toBe("ARCHIVED");
  });

  it("normalizes URL filters and bounds user supplied values", () => {
    expect(
      normalizeGestaoCourseFilters({
        page: -4,
        pathId: ` ${"p".repeat(300)} `,
        query: ` ${"x".repeat(140)} `,
        status: "unexpected",
        view: "GRID",
      })
    ).toEqual({
      page: 1,
      pathId: "p".repeat(255),
      query: "x".repeat(120),
      status: "ALL",
      view: "GRID",
    });
  });

  it("filters scheduled drafts by time without changing published records", () => {
    expect(gestaoCourseStatusWhere("SCHEDULED", now)).toEqual({
      status: "DRAFT",
      publishedAt: { gt: now },
    });
    expect(gestaoCourseStatusWhere("PUBLISHED", now)).toEqual({
      status: "PUBLISHED",
    });
    expect(gestaoCourseStatusWhere("DRAFT", now)).toEqual({
      status: "DRAFT",
      OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
    });
  });
});
