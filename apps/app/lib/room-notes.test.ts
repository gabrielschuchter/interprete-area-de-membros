import { describe, expect, test } from "vitest";
import { formatVideoTimestamp, sortRoomNotes } from "./room-notes";

const note = (
  id: string,
  createdAt: string,
  videoTimeSeconds: number | null,
  pinned = false
) => ({ createdAt: new Date(createdAt), id, pinned, videoTimeSeconds });

describe("sortRoomNotes", () => {
  test("pinned, then stamped by time, then unstamped newest first", () => {
    const notes = [
      note("old", "2026-10-20T10:00:00Z", null),
      note("late", "2026-10-21T10:00:00Z", 600),
      note("pin", "2026-10-19T10:00:00Z", null, true),
      note("new", "2026-10-22T10:00:00Z", null),
      note("early", "2026-10-22T11:00:00Z", 42),
    ];
    expect(sortRoomNotes(notes).map(({ id }) => id)).toEqual([
      "pin",
      "early",
      "late",
      "new",
      "old",
    ]);
  });
});

describe("formatVideoTimestamp", () => {
  test("uses mm:ss and adds hours only when needed", () => {
    expect(formatVideoTimestamp(0)).toBe("00:00");
    expect(formatVideoTimestamp(522)).toBe("08:42");
    expect(formatVideoTimestamp(3725)).toBe("1:02:05");
  });
});
