import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ member: vi.fn(), cohort: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  database: {
    member: { findUnique: mocks.member },
    cohort: { findFirst: mocks.cohort },
  },
}));

import { canEnterGestaoRoute } from "./gestao-route-authorization";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.member.mockResolvedValue({ role: "TEACHER", deactivatedAt: null });
  mocks.cohort.mockResolvedValue({ id: "cohort-qa" });
});
test.each([
  null,
  { role: "MEMBER", deactivatedAt: null },
  { role: "ADMIN", deactivatedAt: new Date() },
])("denies an unavailable staff identity before resource queries", async (member) => {
  mocks.member.mockResolvedValue(member);
  expect(await canEnterGestaoRoute("qa", "/gestao")).toBe(false);
  expect(mocks.cohort).not.toHaveBeenCalled();
});
test("uses current Member role on every request without shared cache", async () => {
  expect(await canEnterGestaoRoute("qa", "/gestao/administracao/membros")).toBe(
    false
  );
  mocks.member.mockResolvedValue({ role: "ADMIN", deactivatedAt: null });
  expect(await canEnterGestaoRoute("qa", "/gestao/administracao/membros")).toBe(
    true
  );
  expect(mocks.member).toHaveBeenCalledTimes(2);
});
test("only projects an authorized cohort id and applies current responsibility", async () => {
  expect(
    await canEnterGestaoRoute(
      "qa",
      "/gestao/alunos/turmas/cohort-qa/calendario"
    )
  ).toBe(true);
  expect(mocks.cohort).toHaveBeenCalledWith({
    where: { id: "cohort-qa", teachers: { some: { memberId: "qa" } } },
    select: { id: true },
  });
  mocks.cohort.mockResolvedValue(null);
  expect(
    await canEnterGestaoRoute("qa", "/gestao/alunos/turmas/cohort-qa")
  ).toBe(false);
});
test("does not mistake the create route for a cohort", async () => {
  expect(await canEnterGestaoRoute("qa", "/gestao/alunos/turmas/nova")).toBe(
    true
  );
  expect(mocks.cohort).not.toHaveBeenCalled();
});

test("checks a cohort selected by the overview URL instead of widening to all", async () => {
  mocks.cohort.mockResolvedValue(null);
  expect(await canEnterGestaoRoute("qa", "/gestao", "cohort-foreign")).toBe(
    false
  );
  expect(mocks.cohort).toHaveBeenCalledWith({
    where: {
      id: "cohort-foreign",
      archivedAt: null,
      teachers: { some: { memberId: "qa" } },
    },
    select: { id: true },
  });
});
