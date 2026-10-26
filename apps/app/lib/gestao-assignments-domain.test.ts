import { describe, expect, it } from "vitest";
import {
  assignmentState,
  matchesAssignmentDue,
  parseAssignmentDue,
  parseAssignmentTab,
} from "./gestao-assignments-domain";

const now = new Date("2026-10-25T12:00:00Z");
const day = 86_400_000;
const base = {
  availableAt: null,
  completed: 0,
  dueAt: null,
  expiresAt: null,
  live: 4,
};

describe("assignmentState", () => {
  it("marca como revogada quando não resta destinatário ativo", () => {
    expect(assignmentState({ ...base, live: 0 }, now)).toMatchObject({
      key: "revoked",
      tab: "closed",
    });
  });

  it("agenda quando a liberação está no futuro", () => {
    const state = assignmentState(
      { ...base, availableAt: new Date(now.getTime() + day) },
      now
    );
    expect(state).toMatchObject({ key: "scheduled", tab: "scheduled" });
  });

  it("marca atraso apenas quando o prazo passou e há pendentes", () => {
    const late = { ...base, dueAt: new Date(now.getTime() - day) };
    expect(assignmentState(late, now).key).toBe("late");
    expect(assignmentState({ ...late, completed: 4 }, now).key).toBe("done");
  });

  it("encerra quando o acesso expirou", () => {
    const expired = { ...base, expiresAt: new Date(now.getTime() - 1) };
    expect(assignmentState(expired, now)).toMatchObject({
      key: "expired",
      tab: "closed",
    });
  });
});

describe("filtros", () => {
  it("cai na aba de ativas para valores desconhecidos", () => {
    expect(parseAssignmentTab("x")).toBe("active");
    expect(parseAssignmentTab("closed")).toBe("closed");
    expect(parseAssignmentDue("x")).toBeNull();
  });

  it("filtra por prazo", () => {
    const row = {
      dueAt: null,
      state: assignmentState(base, now),
    };
    expect(matchesAssignmentDue(row, "without")).toBe(true);
    expect(matchesAssignmentDue(row, "with")).toBe(false);
    expect(matchesAssignmentDue(row, "late")).toBe(false);
  });
});
