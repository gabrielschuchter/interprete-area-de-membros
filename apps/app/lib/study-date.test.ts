import { describe, expect, it } from "vitest";
import { formatNoteListDate, formatStudyTimestamp } from "./study-date";

describe("study dates use the member timezone on server and client", () => {
  it("keeps a UTC-midnight timestamp on the Sao Paulo calendar day", () => {
    expect(
      formatNoteListDate(
        "2026-10-12T01:30:00Z",
        "America/Sao_Paulo",
        "2026-10-12T02:00:00Z"
      )
    ).toBe("Hoje, 22:30");
  });
  it("uses the configured timezone for yesterday", () => {
    expect(
      formatNoteListDate(
        "2026-10-12T01:30:00Z",
        "America/Sao_Paulo",
        "2026-10-12T04:00:00Z"
      )
    ).toBe("Ontem");
  });
  it("formats history with the configured timezone", () => {
    expect(
      formatStudyTimestamp("2026-10-12T01:30:00Z", "America/Sao_Paulo")
    ).toContain("22:30");
    expect(formatStudyTimestamp("2026-10-12T01:30:00Z", "UTC")).toContain(
      "01:30"
    );
  });
  it("handles invalid or absent dates", () => {
    expect(formatStudyTimestamp(null)).toBe("");
    expect(formatNoteListDate("invalid", "UTC", "2026-10-12T04:00:00Z")).toBe(
      ""
    );
  });
});
