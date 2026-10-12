import { describe, expect, it } from "vitest";
import { canReadMeetingCohortTarget } from "./meeting-cohort-access";

const day = (value: number) => new Date(Date.UTC(2026, 9, value, 12));
const meeting = {
  createdAt: day(1),
  publishedAt: day(2),
  startsAt: day(21),
  endsAt: day(22),
};
const target = { assignedAt: day(3) };
const membership = {
  joinedAt: day(10),
  lateJoinPolicy: "ALL_ACTIVE" as const,
  includePastReadOnly: false,
};

describe("meeting cohort entry policy", () => {
  it("includes a future meeting for ALL_ACTIVE", () => {
    expect(canReadMeetingCohortTarget(meeting, target, membership)).toBe(true);
  });
  it("excludes a meeting published before entry for FROM_JOIN", () => {
    expect(
      canReadMeetingCohortTarget(meeting, target, {
        ...membership,
        lateJoinPolicy: "FROM_JOIN",
      })
    ).toBe(false);
  });
  it("includes a draft created before entry but published after it", () => {
    expect(
      canReadMeetingCohortTarget({ ...meeting, publishedAt: day(11) }, target, {
        ...membership,
        lateJoinPolicy: "FROM_JOIN",
      })
    ).toBe(true);
  });
  it("includes a newly assigned meeting for FROM_JOIN", () => {
    expect(
      canReadMeetingCohortTarget(
        meeting,
        { assignedAt: day(11) },
        { ...membership, lateJoinPolicy: "FROM_JOIN" }
      )
    ).toBe(true);
  });
  it("does not infer a recent publication for a legacy row", () => {
    expect(
      canReadMeetingCohortTarget({ ...meeting, publishedAt: null }, target, {
        ...membership,
        lateJoinPolicy: "FROM_JOIN",
      })
    ).toBe(false);
  });
  it("keeps history available when the member joined before the meeting", () => {
    expect(
      canReadMeetingCohortTarget(meeting, target, {
        ...membership,
        joinedAt: day(1),
      })
    ).toBe(true);
  });
  it("requires includePastReadOnly for meetings ended before entry", () => {
    const past = { ...meeting, startsAt: day(4), endsAt: day(5) };
    expect(canReadMeetingCohortTarget(past, target, membership)).toBe(false);
    expect(
      canReadMeetingCohortTarget(past, target, {
        ...membership,
        includePastReadOnly: true,
      })
    ).toBe(true);
  });
  it("does not let includePastReadOnly bypass FROM_JOIN", () => {
    expect(
      canReadMeetingCohortTarget(meeting, target, {
        ...membership,
        lateJoinPolicy: "FROM_JOIN",
        includePastReadOnly: true,
      })
    ).toBe(false);
  });
  it("permits an ongoing series but filters occurrences before entry", () => {
    const series = {
      ...meeting,
      startsAt: day(1),
      endsAt: day(2),
      recurrenceRule: "WEEKLY",
    };
    expect(canReadMeetingCohortTarget(series, target, membership)).toBe(true);
    expect(canReadMeetingCohortTarget(series, target, membership, day(1))).toBe(
      false
    );
    expect(
      canReadMeetingCohortTarget(series, target, membership, day(15))
    ).toBe(true);
  });
  it("fails closed without current membership or publication metadata", () => {
    expect(canReadMeetingCohortTarget(meeting, target, undefined)).toBe(false);
    expect(canReadMeetingCohortTarget({}, target, membership)).toBe(false);
    expect(canReadMeetingCohortTarget(meeting, {}, membership)).toBe(false);
  });
});
