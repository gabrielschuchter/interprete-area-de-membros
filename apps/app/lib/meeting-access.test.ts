import { describe, expect, test } from "vitest";
import {
  canReadMeeting,
  hasConfiguredExternalRecordingSource,
  safeMeetingRecordingUrl,
} from "./meeting-access";

const memberScope = {
  fullAccess: false,
  courseIds: new Set(["course-a"]),
};

describe("meeting visibility", () => {
  test("members may read a meeting when explicitly invited", () => {
    expect(
      canReadMeeting(
        {
          course: { id: "course-private" },
          participants: [{ memberId: "member-a" }],
          _count: { participants: 2 },
        },
        "member-a",
        memberScope
      )
    ).toBe(true);
  });

  test("invited meetings remain private from other members", () => {
    expect(
      canReadMeeting(
        {
          course: { id: "course-a" },
          participants: [{ memberId: "member-a" }],
          _count: { participants: 1 },
        },
        "member-b",
        memberScope
      )
    ).toBe(false);
  });

  test("course meetings require access when there is no participant list", () => {
    expect(
      canReadMeeting(
        {
          course: { id: "course-a" },
          participants: [],
          _count: { participants: 0 },
        },
        "member-a",
        memberScope
      )
    ).toBe(true);
    expect(
      canReadMeeting(
        {
          course: { id: "course-b" },
          participants: [],
          _count: { participants: 0 },
        },
        "member-a",
        memberScope
      )
    ).toBe(false);
  });

  test("published meetings without a course or invite list remain visible", () => {
    expect(
      canReadMeeting(
        { course: null, participants: [], _count: { participants: 0 } },
        "member-a",
        memberScope
      )
    ).toBe(true);
  });

  test("staff retain full meeting access", () => {
    expect(
      canReadMeeting(
        {
          course: { id: "course-private" },
          participants: [],
          _count: { participants: 0 },
        },
        "teacher",
        { fullAccess: true, courseIds: new Set() }
      )
    ).toBe(true);
  });
});

describe("meeting recording URLs", () => {
  test("accepts only valid HTTP(S) URLs", () => {
    expect(safeMeetingRecordingUrl(" https://video.example/recording ")).toBe(
      "https://video.example/recording"
    );
    expect(safeMeetingRecordingUrl("javascript:alert(1)")).toBeNull();
    expect(safeMeetingRecordingUrl("not a URL")).toBeNull();
    expect(safeMeetingRecordingUrl(null)).toBeNull();
  });

  test("requires a configured video source before suppressing a meeting link", () => {
    expect(
      hasConfiguredExternalRecordingSource({
        externalUrl: null,
        kind: "VIDEO",
        mediaExternalId: "dQw4w9WgXcQ",
        mediaProvider: "YOUTUBE",
      })
    ).toBe(true);
    expect(
      hasConfiguredExternalRecordingSource({
        externalUrl: null,
        kind: "VIDEO",
        mediaExternalId: null,
        mediaProvider: "YOUTUBE",
      })
    ).toBe(false);
    expect(
      hasConfiguredExternalRecordingSource({
        externalUrl: "javascript:alert(1)",
        kind: "VIDEO",
        mediaExternalId: null,
        mediaProvider: "EXTERNAL_URL",
      })
    ).toBe(false);
    expect(
      hasConfiguredExternalRecordingSource({
        externalUrl: "https://video.example/recording",
        kind: "VIDEO",
        mediaExternalId: null,
        mediaProvider: "EXTERNAL_URL",
      })
    ).toBe(true);
  });
});
