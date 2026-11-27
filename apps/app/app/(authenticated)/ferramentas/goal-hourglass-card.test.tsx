import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type CountGoalsOverview,
  emptyCountGoals,
} from "@/lib/study-count-goals-model";
import { GoalHourglassCard } from "./goal-hourglass-card";

vi.mock("./count-goal-actions", () => ({
  deleteCountGoalAction: vi.fn(),
  saveCountGoalAction: vi.fn(),
}));
vi.mock("./planner-actions", () => ({ savePlannerGoalAction: vi.fn() }));

const TICKET = /Ingresso do auditório/;
const SHELF = /Prateleira: cada livro/;
const SHEET = /Gabarito: cada bolinha/;
const HOURGLASS = /Ampulheta: faltam/;
const PER_PIECE = /cada bolinha = 3/;

const goals = (patch: Partial<CountGoalsOverview>): CountGoalsOverview => ({
  ...emptyCountGoals(),
  ...patch,
});

const renderCard = (countGoals = emptyCountGoals(), studied = 90) =>
  render(
    <GoalHourglassCard
      countGoals={countGoals}
      daysLeft={3}
      pending={false}
      run={vi.fn()}
      studiedMinutes={studied}
      targetMinutes={300}
    />
  );

afterEach(cleanup);

describe("GoalHourglassCard por tipo", () => {
  it("começa no tempo, com a ampulheta e o rótulo dela", () => {
    renderCard();
    expect(screen.getByText("Ampulheta da meta")).toBeTruthy();
    expect(screen.getByRole("img", { name: HOURGLASS })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Tempo" }).getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("troca rótulo e ilustração a cada tipo", () => {
    renderCard(
      goals({
        LESSONS: { target: 5, done: 2 },
        READINGS: { target: 4, done: 1 },
        EXERCISES: { target: 30, done: 10 },
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Aulas" }));
    expect(screen.getByText("Ingresso da meta")).toBeTruthy();
    expect(screen.getByRole("img", { name: TICKET })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Leituras" }));
    expect(screen.getByText("Prateleira da meta")).toBeTruthy();
    expect(screen.getByRole("img", { name: SHELF })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Exercícios" }));
    expect(screen.getByText("Gabarito da meta")).toBeTruthy();
    expect(screen.getByRole("img", { name: SHEET })).toBeTruthy();
  });

  it("meta batida mostra o fechamento do tipo", () => {
    renderCard(goals({ LESSONS: { target: 5, done: 5 } }));
    fireEvent.click(screen.getByRole("button", { name: "Aulas" }));
    expect(screen.getByText("Meta batida")).toBeTruthy();
    expect(screen.getByText("Ingresso completo")).toBeTruthy();
  });

  it("agrupa metas grandes e avisa quanto vale cada peça", () => {
    renderCard(goals({ EXERCISES: { target: 150, done: 20 } }));
    fireEvent.click(screen.getByRole("button", { name: "Exercícios" }));
    expect(screen.getByText(PER_PIECE)).toBeTruthy();
  });
});
