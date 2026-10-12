import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolveStudentFeed: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/observability/performance", () => ({
  tracePerformance: (_name: string, operation: () => unknown) => operation(),
}));
vi.mock("./student-feed", () => ({
  resolveStudentFeed: mocks.resolveStudentFeed,
}));

import { resolveCalendar } from "./student-calendar";

describe("resolveCalendar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("projects deduplicated due activities in range and hides scheduled items", async () => {
    const start = new Date("2026-10-01T00:00:00.000Z");
    const end = new Date("2026-11-01T00:00:00.000Z");
    const at = new Date("2026-10-12T12:00:00.000Z");
    const dueAt = new Date("2026-10-20T12:00:00.000Z");
    mocks.resolveStudentFeed.mockResolvedValue([
      {
        id: "cohort-activity:activity-a",
        targetId: "activity-a",
        title: "Atividade da turma",
        slug: "atividade-da-turma",
        href: "/atividades/atividade-da-turma",
        status: "NEW",
        message: null,
        availableAt: null,
        dueAt,
        assignedAt: new Date("2026-10-11T12:00:00.000Z"),
      },
      {
        id: "assignment-scheduled",
        targetId: "activity-scheduled",
        title: "Atividade agendada",
        slug: "atividade-agendada",
        href: "/aprender/atribuicoes/assignment-scheduled",
        status: "NEW",
        message: null,
        availableAt: new Date("2026-10-19T12:00:00.000Z"),
        dueAt,
        assignedAt: new Date("2026-10-11T12:00:00.000Z"),
      },
      {
        id: "outside-range",
        targetId: "activity-outside",
        title: "Fora do período",
        slug: "atividade-fora",
        href: "/atividades/atividade-fora",
        status: "NEW",
        message: null,
        availableAt: null,
        dueAt: new Date("2026-11-10T12:00:00.000Z"),
        assignedAt: new Date("2026-10-11T12:00:00.000Z"),
      },
    ]);

    await expect(
      resolveCalendar("member-a", { start, end }, at)
    ).resolves.toEqual([
      {
        id: "cohort-activity:activity-a",
        activityId: "activity-a",
        title: "Atividade da turma",
        slug: "atividade-da-turma",
        dueAt,
        status: "NEW",
        href: "/atividades/atividade-da-turma",
      },
    ]);
    expect(mocks.resolveStudentFeed).toHaveBeenCalledWith("member-a", at, {
      assignmentLimit: 200,
      dueRange: { start, end },
    });
  });

  it("rejects invalid or oversized ranges before querying learner data", async () => {
    await expect(
      resolveCalendar("member-a", {
        start: new Date("2026-10-12T00:00:00.000Z"),
        end: new Date("2028-01-01T00:00:00.000Z"),
      })
    ).rejects.toThrow("O período solicitado não é válido.");
    expect(mocks.resolveStudentFeed).not.toHaveBeenCalled();
  });
});
