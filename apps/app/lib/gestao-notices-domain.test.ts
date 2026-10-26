import { describe, expect, it } from "vitest";
import {
  gestaoNoticeAudienceKind,
  gestaoNoticeAudienceLabel,
  gestaoNoticeEndOfDay,
  gestaoNoticeHref,
  gestaoNoticePeriodLabel,
  gestaoNoticeStartOfDay,
  gestaoNoticeState,
} from "./gestao-notices-domain";

const at = (iso: string) => new Date(iso);

describe("gestaoNoticeState", () => {
  const now = at("2026-10-10T12:00:00-03:00");
  it("treats drafts as drafts whatever the dates", () => {
    expect(
      gestaoNoticeState({ endsAt: null, startsAt: null, status: "DRAFT" }, now)
    ).toBe("draft");
  });
  it("ends archived or expired notices", () => {
    expect(
      gestaoNoticeState(
        { endsAt: null, startsAt: null, status: "ARCHIVED" },
        now
      )
    ).toBe("ended");
    expect(
      gestaoNoticeState(
        {
          endsAt: at("2026-10-09T00:00:00-03:00"),
          startsAt: null,
          status: "PUBLISHED",
        },
        now
      )
    ).toBe("ended");
  });
  it("schedules notices that start later", () => {
    expect(
      gestaoNoticeState(
        {
          endsAt: null,
          startsAt: at("2026-10-11T00:00:00-03:00"),
          status: "PUBLISHED",
        },
        now
      )
    ).toBe("scheduled");
  });
  it("publishes the rest", () => {
    expect(
      gestaoNoticeState(
        { endsAt: null, startsAt: null, status: "PUBLISHED" },
        now
      )
    ).toBe("published");
  });
});

describe("gestaoNoticePeriodLabel", () => {
  it("shows a range inside one month", () => {
    expect(
      gestaoNoticePeriodLabel(
        gestaoNoticeStartOfDay("2026-10-01"),
        gestaoNoticeEndOfDay("2026-10-17")
      )
    ).toContain("1 a 17 out");
  });
  it("shows the hours of a same-day window", () => {
    expect(
      gestaoNoticePeriodLabel(
        at("2026-10-10T06:00:00-03:00"),
        at("2026-10-10T08:00:00-03:00")
      )
    ).toContain("06h–08h");
  });
  it("handles open ends and no period", () => {
    expect(gestaoNoticePeriodLabel(null, null)).toBe("Sem período");
    expect(
      gestaoNoticePeriodLabel(at("2026-10-10T09:00:00-03:00"), null)
    ).toContain("a partir de 10 out");
    expect(
      gestaoNoticePeriodLabel(null, at("2026-10-10T09:00:00-03:00"))
    ).toContain("até 10 out");
  });
});

describe("gestaoNoticeHref", () => {
  it("accepts platform paths and http(s) addresses only", () => {
    expect(gestaoNoticeHref("")).toEqual({ ok: true, value: null });
    expect(gestaoNoticeHref("/encontros")).toEqual({
      ok: true,
      value: "/encontros",
    });
    expect(gestaoNoticeHref("https://exemplo.com/a")).toEqual({
      ok: true,
      value: "https://exemplo.com/a",
    });
    expect(gestaoNoticeHref("//evil.com").ok).toBe(false);
    expect(gestaoNoticeHref("javascript:alert(1)").ok).toBe(false);
  });
});

describe("audience labels", () => {
  it("names the audience by kind", () => {
    expect(
      gestaoNoticeAudienceLabel({ audience: "ALL", cohortNames: [], people: 0 })
    ).toBe("Todos os membros");
    expect(
      gestaoNoticeAudienceLabel({
        audience: "SELECTED",
        cohortNames: ["Mentoria PBE"],
        people: 18,
      })
    ).toBe("Mentoria PBE");
    expect(
      gestaoNoticeAudienceLabel({
        audience: "SELECTED",
        cohortNames: ["A", "B", "C"],
        people: 9,
      })
    ).toBe("A e mais 2");
    expect(
      gestaoNoticeAudienceLabel({
        audience: "SELECTED",
        cohortNames: [],
        people: 1,
      })
    ).toBe("1 pessoa");
    expect(
      gestaoNoticeAudienceKind({ audience: "SELECTED", cohortNames: ["A"] })
    ).toBe("cohorts");
    expect(
      gestaoNoticeAudienceKind({ audience: "STAFF", cohortNames: [] })
    ).toBe("staff");
  });
});
