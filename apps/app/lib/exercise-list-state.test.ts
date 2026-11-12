import { expect, test } from "vitest";
import {
  exerciseListStateLabel,
  exerciseListStateProgress,
  summarizeExerciseListStates,
} from "./exercise-list-state";

const answered = { answer: { id: "a" } };
const pending = { answer: null };

test("listas sem sessão ficam de fora e viram 'Nova'", () => {
  const states = summarizeExerciseListStates([]);
  expect(states.get("l1")).toBeUndefined();
  expect(exerciseListStateLabel(states.get("l1"))).toBe("Nova");
  expect(exerciseListStateProgress(states.get("l1"))).toBe(0);
});

test("sessão em andamento mostra respondidas de total", () => {
  const states = summarizeExerciseListStates([
    {
      listId: "l1",
      status: "IN_PROGRESS",
      questions: [answered, answered, pending, pending],
    },
  ]);
  expect(exerciseListStateLabel(states.get("l1"))).toBe("2 de 4");
  expect(exerciseListStateProgress(states.get("l1"))).toBe(50);
});

test("sessão concluída marca a lista como concluída", () => {
  const states = summarizeExerciseListStates([
    { listId: "l1", status: "COMPLETED", questions: [answered] },
  ]);
  expect(exerciseListStateLabel(states.get("l1"))).toBe("Concluída");
  expect(exerciseListStateProgress(states.get("l1"))).toBe(100);
});

test("em andamento vale mais que concluída, em qualquer ordem", () => {
  const completed = {
    listId: "l1",
    status: "COMPLETED",
    questions: [answered],
  };
  const inProgress = {
    listId: "l1",
    status: "IN_PROGRESS",
    questions: [answered, pending],
  };
  for (const sessions of [
    [completed, inProgress],
    [inProgress, completed],
  ]) {
    const states = summarizeExerciseListStates(sessions);
    expect(states.get("l1")).toEqual({
      kind: "in-progress",
      answered: 1,
      total: 2,
    });
  }
});

test("sessão em andamento sem questões não divide por zero", () => {
  const states = summarizeExerciseListStates([
    { listId: "l1", status: "IN_PROGRESS", questions: [] },
  ]);
  expect(exerciseListStateProgress(states.get("l1"))).toBe(0);
});
