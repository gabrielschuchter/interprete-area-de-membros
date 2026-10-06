import { describe, expect, test } from "vitest";
import { recordingYearInTimezone, recordingYearRange } from "./recording-date";

describe("recordingYearInTimezone", () => {
  test("groups imported dates by the member-facing Sao Paulo year", () => {
    expect(recordingYearInTimezone(new Date("2025-01-01T01:00:00.000Z"))).toBe(
      "2024"
    );
  });

  test("supports the timezone attached to an external meeting recording", () => {
    expect(
      recordingYearInTimezone(
        new Date("2025-01-01T01:00:00.000Z"),
        "America/Sao_Paulo"
      )
    ).toBe("2024");
    expect(
      recordingYearInTimezone(new Date("2025-01-01T01:00:00.000Z"), "UTC")
    ).toBe("2025");
  });

  test("filters an imported year using Sao Paulo local midnight boundaries", () => {
    const range = recordingYearRange("2024");
    expect(range?.gte.toISOString()).toBe("2024-01-01T03:00:00.000Z");
    expect(range?.lt.toISOString()).toBe("2025-01-01T03:00:00.000Z");

    expect(recordingYearInTimezone(new Date(range?.gte ?? 0))).toBe("2024");
    expect(
      recordingYearInTimezone(new Date((range?.gte.getTime() ?? 1) - 1))
    ).toBe("2023");
    expect(
      recordingYearInTimezone(new Date((range?.lt.getTime() ?? 1) - 1))
    ).toBe("2024");
    expect(recordingYearInTimezone(new Date(range?.lt ?? 0))).toBe("2025");
  });

  test("supports the timezone stored with an external meeting", () => {
    const range = recordingYearRange("2024", "UTC");
    expect(range?.gte.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(range?.lt.toISOString()).toBe("2025-01-01T00:00:00.000Z");
  });

  test("returns no range for malformed years", () => {
    expect(recordingYearRange("202x")).toBeNull();
  });
});
