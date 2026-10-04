import { describe, expect, it } from "vitest";
import { resolveMeetingAttendance } from "./meeting-attendance";

describe("resolveMeetingAttendance", () => {
  it("records an explicit result for every eligible participant", () => {
    expect(
      resolveMeetingAttendance(["member-a"], ["member-a", "member-b"])
    ).toEqual([
      { memberId: "member-a", isPresent: true },
      { memberId: "member-b", isPresent: false },
    ]);
  });

  it("deduplicates participant and submitted IDs", () => {
    expect(
      resolveMeetingAttendance(
        ["member-a", "member-a"],
        ["member-a", "member-b", "member-b"]
      )
    ).toEqual([
      { memberId: "member-a", isPresent: true },
      { memberId: "member-b", isPresent: false },
    ]);
  });

  it("rejects submitted members outside the meeting roster", () => {
    expect(resolveMeetingAttendance(["other-member"], ["member-a"])).toBeNull();
  });
});
