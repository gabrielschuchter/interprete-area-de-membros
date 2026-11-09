import { describe, expect, test } from "vitest";
import {
  calendarGridDays,
  calendarGridRange,
  entryDateKeys,
  isWithinJoinWindow,
  meetingCategory,
  resolveCalendarMonth,
  shiftCalendarMonth,
} from "./community-meetings-calendar-domain";

describe("grade do calendário de Encontros", () => {
  test("começa no domingo anterior ao dia 1 e cobre seis semanas", () => {
    const days = calendarGridDays({ year: 2026, month: 11 });
    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2026-11-01");
    expect(days.at(-1)).toBe("2026-12-12");

    const february = calendarGridDays({ year: 2027, month: 2 });
    expect(february[0]).toBe("2027-01-31");
  });

  test("o período consultado vai da meia-noite de São Paulo do 1º ao 43º dia", () => {
    const range = calendarGridRange({ year: 2026, month: 11 });
    expect(range.start.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-12-13T03:00:00.000Z");
  });

  test("aceita só AAAA-MM válido e cai no mês corrente da escola", () => {
    const now = new Date("2026-12-01T01:30:00Z");
    expect(resolveCalendarMonth("2027-03", now)).toEqual({
      year: 2027,
      month: 3,
    });
    expect(resolveCalendarMonth("2027-13", now)).toEqual({
      year: 2026,
      month: 11,
    });
    expect(resolveCalendarMonth(undefined, now)).toEqual({
      year: 2026,
      month: 11,
    });
  });

  test("troca de mês atravessa o ano", () => {
    expect(shiftCalendarMonth({ year: 2026, month: 12 }, 1)).toEqual({
      year: 2027,
      month: 1,
    });
    expect(shiftCalendarMonth({ year: 2026, month: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
    });
  });
});

describe("dias de cada item", () => {
  const visible = new Set(calendarGridDays({ year: 2026, month: 11 }));

  test("evento de dia todo de cinco dias aparece em cada dia, sem invadir o sexto", () => {
    expect(
      entryDateKeys(
        new Date("2026-11-23T03:00:00Z"),
        new Date("2026-11-28T03:00:00Z"),
        visible
      )
    ).toEqual([
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
      "2026-11-27",
    ]);
  });

  test("encontro às 22h de São Paulo fica no próprio dia, não no seguinte em UTC", () => {
    expect(
      entryDateKeys(
        new Date("2026-11-10T01:00:00Z"),
        new Date("2026-11-10T02:00:00Z"),
        visible
      )
    ).toEqual(["2026-11-09"]);
  });

  test("dias fora da grade são descartados", () => {
    expect(
      entryDateKeys(new Date("2027-01-05T15:00:00Z"), null, visible)
    ).toEqual([]);
  });
});

describe("regras de exibição", () => {
  test("o link de entrada só existe de 15 min antes até o fim", () => {
    const startsAt = new Date("2026-11-09T22:00:00Z");
    const endsAt = new Date("2026-11-09T23:00:00Z");
    expect(
      isWithinJoinWindow(startsAt, endsAt, new Date("2026-11-09T21:40:00Z"))
    ).toBe(false);
    expect(
      isWithinJoinWindow(startsAt, endsAt, new Date("2026-11-09T21:46:00Z"))
    ).toBe(true);
    expect(
      isWithinJoinWindow(startsAt, endsAt, new Date("2026-11-09T23:01:00Z"))
    ).toBe(false);
  });

  test("aulas e workshops têm categoria própria; o resto é encontro", () => {
    expect(meetingCategory("LESSON")).toBe("lesson");
    expect(meetingCategory("WORKSHOP")).toBe("workshop");
    expect(meetingCategory("INDIVIDUAL")).toBe("meeting");
  });
});
