import { describe, expect, it } from "vitest";
import {
  announcementDateTimeForInput,
  announcementTimeZone,
  parseAnnouncementDateTime,
} from "./announcement-time";

describe("community announcement local time", () => {
  it("converts Sao Paulo wall time to the matching instant", () => {
    expect(announcementTimeZone).toBe("America/Sao_Paulo");
    expect(parseAnnouncementDateTime("2026-10-22T09:15")?.toISOString()).toBe(
      "2026-10-22T12:15:00.000Z"
    );
  });

  it("formats stored instants back to Sao Paulo wall time", () => {
    expect(
      announcementDateTimeForInput(new Date("2026-10-22T12:15:00.000Z"))
    ).toBe("2026-10-22T09:15");
  });

  it("rejects malformed and impossible local dates", () => {
    expect(parseAnnouncementDateTime("2026-02-30T10:00")).toBeNull();
    expect(parseAnnouncementDateTime("2026-10-22T24:00")).toBeNull();
    expect(parseAnnouncementDateTime("2026-10-22")).toBeNull();
  });
});
