import { expect, test } from "vitest";
import {
  countGoalPresets,
  countGoalUnit,
  emptyCountGoals,
  isCountGoalKind,
} from "./study-count-goals-model";

test("presets incluem o valor atual sem repetir e em ordem", () => {
  expect(countGoalPresets("LESSONS", 7)).toEqual([3, 5, 7, 8, 12]);
  expect(countGoalPresets("LESSONS", 5)).toEqual([3, 5, 8, 12]);
  expect(countGoalPresets("READINGS", null)).toEqual([2, 4, 6, 10]);
});

test("unidade concorda no singular e no plural", () => {
  expect(countGoalUnit("EXERCISES", 1)).toBe("questão");
  expect(countGoalUnit("EXERCISES", 0)).toBe("questões");
  expect(countGoalUnit("LESSONS", 3)).toBe("aulas");
});

test("valida o tipo e começa vazio", () => {
  expect(isCountGoalKind("READINGS")).toBe(true);
  expect(isCountGoalKind("MINUTES")).toBe(false);
  expect(emptyCountGoals().LESSONS).toEqual({ done: 0, target: null });
});

import {
  aggregateWeekActivity,
  mergeCountGoals,
  weekActivitySummary,
} from "./study-count-goals-model";

const empty = {
  answersByDay: [],
  completedLessons: [],
  linked: [],
  tracked: [],
};

test("aula estudada e concluída conta uma vez, no primeiro dia", () => {
  const result = aggregateWeekActivity({
    ...empty,
    tracked: [
      {
        activityKind: "LESSON",
        dayKey: "2026-11-24",
        resourceId: "l1",
        seconds: 90,
      },
      {
        activityKind: "LESSON",
        dayKey: "2026-11-23",
        resourceId: "l1",
        seconds: 20,
      },
      {
        activityKind: "LESSON",
        dayKey: "2026-11-24",
        resourceId: "l2",
        seconds: 30,
      },
    ],
    completedLessons: [
      { dayKey: "2026-11-25", lessonId: "l1" },
      { dayKey: "2026-11-25", lessonId: "l3" },
    ],
  });
  expect(result.week.LESSONS).toBe(2);
  expect(result.perDay["2026-11-23"]?.LESSONS).toBe(1);
  expect(result.perDay["2026-11-25"]?.LESSONS).toBe(1);
});

test("cronômetro ligado a leitura conta com 10 s; heartbeat de leitura exige 60 s", () => {
  const result = aggregateWeekActivity({
    ...empty,
    tracked: [
      {
        activityKind: "LIBRARY_ITEM",
        dayKey: "2026-11-24",
        resourceId: "b1",
        seconds: 59,
      },
      {
        activityKind: "LIBRARY_ITEM",
        dayKey: "2026-11-24",
        resourceId: "b2",
        seconds: 61,
      },
    ],
    linked: [
      {
        dayKey: "2026-11-25",
        linkedType: "LIBRARY_ITEM",
        resourceId: "b3",
        seconds: 12,
      },
      {
        dayKey: "2026-11-25",
        linkedType: "LESSON",
        resourceId: "l9",
        seconds: 15,
      },
    ],
  });
  expect(result.week).toEqual({ LESSONS: 1, READINGS: 2, EXERCISES: 0 });
});

test("exercícios somam questões respondidas e atividades estudadas", () => {
  const result = aggregateWeekActivity({
    ...empty,
    answersByDay: [{ dayKey: "2026-11-26", count: 10 }],
    tracked: [
      {
        activityKind: "ACTIVITY",
        dayKey: "2026-11-26",
        resourceId: "a1",
        seconds: 80,
      },
    ],
  });
  expect(result.week.EXERCISES).toBe(11);
  expect(result.perDay["2026-11-26"]?.EXERCISES).toBe(11);
});

test("junta metas salvas e resume a semana", () => {
  const week = { LESSONS: 3, READINGS: 1, EXERCISES: 0 };
  expect(
    mergeCountGoals([{ kind: "LESSONS", target: 5 }], week).LESSONS
  ).toEqual({ done: 3, target: 5 });
  expect(weekActivitySummary(week)).toBe("3 aulas · 1 leitura");
  expect(weekActivitySummary({ LESSONS: 0, READINGS: 0, EXERCISES: 0 })).toBe(
    "Nada registrado ainda"
  );
});
