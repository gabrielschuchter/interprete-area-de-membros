import { describe, expect, test } from "vitest";
import {
  compareRecordingsByDate,
  isRecordingCompleted,
} from "./room-recording-rules";

const at = new Date("2026-01-09T12:00:00Z");

describe("isRecordingCompleted", () => {
  test("is false without progress", () => {
    expect(isRecordingCompleted(null)).toBe(false);
  });

  test("follows the 90% rule when the member made no choice", () => {
    expect(
      isRecordingCompleted({ completedPlaybackAt: at, manualCompletion: null })
    ).toBe(true);
    expect(
      isRecordingCompleted({
        completedPlaybackAt: null,
        manualCompletion: null,
      })
    ).toBe(false);
  });

  test("lets a manual mark count without playback", () => {
    expect(
      isRecordingCompleted({
        completedPlaybackAt: null,
        manualCompletion: true,
      })
    ).toBe(true);
  });

  test("lets a manual reopen win over the 90% rule", () => {
    expect(
      isRecordingCompleted({
        completedPlaybackAt: at,
        manualCompletion: false,
      })
    ).toBe(false);
  });
});

describe("compareRecordingsByDate", () => {
  test("orders newest first and undated last", () => {
    const rows = [
      { id: "a", meetingDate: null },
      { id: "b", meetingDate: new Date("2026-01-02T00:00:00Z") },
      { id: "c", meetingDate: new Date("2026-02-02T00:00:00Z") },
    ];
    expect([...rows].sort(compareRecordingsByDate).map(({ id }) => id)).toEqual(
      ["c", "b", "a"]
    );
  });

  test("breaks ties by id", () => {
    const date = new Date("2026-01-02T00:00:00Z");
    const rows = [
      { id: "a", meetingDate: date },
      { id: "b", meetingDate: date },
    ];
    expect([...rows].sort(compareRecordingsByDate).map(({ id }) => id)).toEqual(
      ["b", "a"]
    );
  });
});
