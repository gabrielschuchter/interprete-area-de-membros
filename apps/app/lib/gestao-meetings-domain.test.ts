import { describe, expect, it } from "vitest";
import {
  gestaoMeetingAudienceLabel,
  gestaoMeetingDateTime,
  gestaoMeetingHourLabel,
  gestaoMeetingInputParts,
  gestaoMeetingIsUpcoming,
  gestaoMeetingRecording,
  gestaoMeetingRecurrenceOptions,
  gestaoMeetingState,
  gestaoMeetingSubline,
  gestaoMeetingTabMatches,
  gestaoMeetingTile,
} from "./gestao-meetings-domain";

const zone = "America/Sao_Paulo";
const friday = new Date("2026-10-16T22:00:00Z");

describe("gestao-meetings-domain", () => {
  it("shows the date tile and the hour in the meeting time zone", () => {
    expect(gestaoMeetingTile(friday, zone)).toEqual({
      day: "16",
      month: "out",
    });
    expect(gestaoMeetingHourLabel(friday, zone)).toBe("19h");
    expect(gestaoMeetingHourLabel(new Date("2026-10-16T22:30:00Z"), zone)).toBe(
      "19h30"
    );
  });

  it("round-trips the date and time inputs", () => {
    const parts = gestaoMeetingInputParts(friday, zone);
    expect(parts).toEqual({ date: "2026-10-16", time: "19:00" });
    expect(
      gestaoMeetingDateTime(parts.date, parts.time, zone)?.toISOString()
    ).toBe(friday.toISOString());
    expect(gestaoMeetingDateTime("", "19:00", zone)).toBeNull();
  });

  it("names the repeat options after the weekday", () => {
    const labels = gestaoMeetingRecurrenceOptions(friday, zone).map(
      ([, label]) => label
    );
    expect(labels).toEqual([
      "Não repetir",
      "Todo dia",
      "Toda semana, às sextas",
      "Todo mês, no dia 16",
    ]);
  });

  it("derives scheduled from a draft with a future publication date", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const later = new Date("2026-10-11T12:00:00Z");
    expect(
      gestaoMeetingState({ publishedAt: null, status: "DRAFT" }, now)
    ).toBe("draft");
    expect(
      gestaoMeetingState({ publishedAt: later, status: "DRAFT" }, now)
    ).toBe("scheduled");
    expect(
      gestaoMeetingState({ publishedAt: later, status: "PUBLISHED" }, now)
    ).toBe("published");
    expect(
      gestaoMeetingState({ publishedAt: null, status: "ARCHIVED" }, now)
    ).toBe("archived");
  });

  it("keeps open-ended series upcoming and places each state in a tab", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    const series = {
      endsAt: null,
      recurrenceRule: "WEEKLY",
      recurrenceUntil: null,
      startsAt: new Date("2026-09-01T12:00:00Z"),
    };
    expect(gestaoMeetingIsUpcoming(series, now)).toBe(true);
    expect(
      gestaoMeetingIsUpcoming(
        { ...series, recurrenceUntil: new Date("2026-10-01T12:00:00Z") },
        now
      )
    ).toBe(false);
    expect(gestaoMeetingTabMatches("agenda", "draft", true)).toBe(true);
    expect(gestaoMeetingTabMatches("agenda", "archived", true)).toBe(false);
    expect(gestaoMeetingTabMatches("drafts", "scheduled", true)).toBe(true);
    expect(gestaoMeetingTabMatches("published", "published", false)).toBe(
      false
    );
    expect(gestaoMeetingTabMatches("past", "archived", true)).toBe(true);
  });

  it("describes the audience and the subline", () => {
    expect(
      gestaoMeetingAudienceLabel({
        cohorts: ["Turma Mentoria PBE"],
        courseTitle: null,
        people: 0,
      })
    ).toBe("Turma Mentoria PBE");
    expect(
      gestaoMeetingAudienceLabel({ cohorts: [], courseTitle: null, people: 0 })
    ).toBe("todos os membros");
    expect(
      gestaoMeetingSubline({
        audience: "18 participantes",
        courseTitle: "Introdução à PBE",
        hour: "19h",
      })
    ).toBe("19h · online · 18 participantes · curso: Introdução à PBE");
  });

  it("accepts only YouTube links for the recording", () => {
    expect(gestaoMeetingRecording("")).toEqual({ ok: true, value: null });
    expect(gestaoMeetingRecording("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      ok: true,
      value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(gestaoMeetingRecording("https://example.com/video")).toEqual({
      ok: false,
    });
  });
});
