import { expect, test } from "vitest";
import {
  buildShelfDays,
  dayTotalMinutes,
  groupForActivity,
  hourglassRemainingFraction,
  isoWeekNumber,
  manualClientSessionId,
  parseManualGroup,
  shiftDayKey,
  weeklyGoalPresets,
} from "./study-week-shelf-model";

test("lançamentos manuais carregam o grupo no id da sessão", () => {
  const id = manualClientSessionId("exercise", "abc");
  expect(id).toBe("manual:exercise:abc");
  expect(parseManualGroup(id)).toBe("exercise");
  expect(parseManualGroup("manual:outro:abc")).toBeNull();
  expect(parseManualGroup("sessao-do-cronometro")).toBeNull();
  expect(parseManualGroup(null)).toBeNull();
});

test("agrupa cada tipo de atividade na prateleira certa", () => {
  expect(groupForActivity("LESSON", null)).toBe("lesson");
  expect(groupForActivity("RECORDING", null)).toBe("lesson");
  expect(groupForActivity("EXERCISE", null)).toBe("exercise");
  expect(groupForActivity("ACTIVITY", null)).toBe("exercise");
  expect(groupForActivity("LIBRARY_ITEM", null)).toBe("reading");
  expect(groupForActivity("PERSONAL_TIMER", "uuid")).toBe("reading");
  expect(groupForActivity("PERSONAL_TIMER", "manual:lesson:x")).toBe("lesson");
});

test("monta a semana de segunda a domingo e marca hoje e o futuro", () => {
  const days = buildShelfDays(
    [
      { dayKey: "2026-11-23", group: "lesson", seconds: 2400 },
      { dayKey: "2026-11-23", group: "reading", seconds: 125 },
      { dayKey: "2026-11-26", group: "exercise", seconds: 900 },
    ],
    "2026-11-23",
    "2026-11-26"
  );
  expect(days.map((day) => day.label)).toEqual([
    "SEG",
    "TER",
    "QUA",
    "QUI",
    "SEX",
    "SÁB",
    "DOM",
  ]);
  expect(days[0]?.minutes).toEqual({ lesson: 40, reading: 2, exercise: 0 });
  expect(dayTotalMinutes(days[3] as (typeof days)[number])).toBe(15);
  expect(days[3]?.today).toBe(true);
  expect(days[4]?.future).toBe(true);
  expect(days[2]?.future).toBe(false);
});

test("a ampulheta esvazia até a meta e nunca passa dos limites", () => {
  expect(hourglassRemainingFraction(0, 300)).toBe(1);
  expect(hourglassRemainingFraction(150, 300)).toBe(0.5);
  expect(hourglassRemainingFraction(900, 300)).toBe(0);
  expect(hourglassRemainingFraction(10, 0)).toBe(1);
});

test("calcula a semana ISO e desloca dias entre meses", () => {
  expect(isoWeekNumber("2026-11-23")).toBe(48);
  expect(isoWeekNumber("2026-01-05")).toBe(2);
  expect(shiftDayKey("2026-11-30", 1)).toBe("2026-12-01");
});

test("preserva a meta atual entre as opções rápidas", () => {
  expect(weeklyGoalPresets(null)).toEqual([180, 300, 420, 600]);
  expect(weeklyGoalPresets(360)).toEqual([180, 300, 360, 420, 600]);
  expect(weeklyGoalPresets(300)).toEqual([180, 300, 420, 600]);
});

test("cronômetro pessoal ligado a aula cai na prateleira de aula", async () => {
  const { groupForActivity } = await import("./study-week-shelf-model");
  expect(groupForActivity("PERSONAL_TIMER", "t1", "LESSON")).toBe("lesson");
  expect(groupForActivity("PERSONAL_TIMER", "t1", "LIBRARY_ITEM")).toBe(
    "reading"
  );
  expect(groupForActivity("PERSONAL_TIMER", "t1", null)).toBe("reading");
});
