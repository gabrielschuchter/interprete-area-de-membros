import { describe, expect, test } from "vitest";
import {
  currentStudyStreakDays,
  studyLocalDayKey,
  studyPeriodKey,
  studyWeekStartKey,
} from "./study-periods";

describe("study periods in the academic timezone", () => {
  test("changes the local day at midnight in Sao Paulo", () => {
    expect(studyLocalDayKey(new Date("2026-10-05T02:59:00.000Z"))).toBe(
      "2026-10-04"
    );
    expect(studyLocalDayKey(new Date("2026-10-05T03:00:00.000Z"))).toBe(
      "2026-10-05"
    );
  });

  test("starts weekly periods on Monday and keeps daily/monthly keys stable", () => {
    const sunday = new Date("2026-10-04T12:00:00-03:00");
    expect(studyWeekStartKey("2026-10-04")).toBe("2026-09-28");
    expect(studyPeriodKey("WEEKLY", sunday)).toBe("week:2026-09-28");
    expect(studyPeriodKey("DAILY", sunday)).toBe("day:2026-10-04");
    expect(studyPeriodKey("MONTHLY", sunday)).toBe("month:2026-10");
    expect(studyPeriodKey("ONCE", sunday)).toBe("once");
  });

  test("continues a current streak through yesterday and stops at a gap", () => {
    expect(
      currentStudyStreakDays(["2026-10-02", "2026-10-03"], "2026-10-04")
    ).toBe(2);
    expect(
      currentStudyStreakDays(
        ["2026-10-01", "2026-10-02", "2026-10-04"],
        "2026-10-04"
      )
    ).toBe(1);
    expect(currentStudyStreakDays([], "2026-10-04")).toBe(0);
  });
});
