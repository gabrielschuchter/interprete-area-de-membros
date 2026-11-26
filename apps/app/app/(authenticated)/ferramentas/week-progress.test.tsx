import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { buildWeekTiles, WeekProgress } from "./week-progress";

const QUESTAO = /Cada questão respondida/;
const HISTORICO = /Histórico total: 18 aulas concluídas/;

afterEach(cleanup);

const props = {
  counts: { LESSONS: 3, READINGS: 1, EXERCISES: 10 },
  history: [{ count: 18, label: "aulas concluídas" }],
  minutes: 42,
  targetMinutes: 180,
};

test("mostra tempo, aulas, leituras e exercícios da semana com a regra de cada um", () => {
  render(<WeekProgress {...props} />);
  expect(screen.getByRole("heading", { name: "Esta semana" })).toBeTruthy();
  expect(screen.getByText("de 180 min")).toBeTruthy();
  expect(screen.getByText("aulas")).toBeTruthy();
  expect(screen.getByText("leitura")).toBeTruthy();
  expect(screen.getByText("questões")).toBeTruthy();
  expect(screen.getByText(QUESTAO)).toBeTruthy();
  expect(screen.getByText(HISTORICO)).toBeTruthy();
});

test("sem meta mostra só min e mantém quatro cartões", () => {
  const tiles = buildWeekTiles({ ...props, targetMinutes: null });
  expect(tiles).toHaveLength(4);
  expect(tiles[0]?.unit).toBe("min");
});
