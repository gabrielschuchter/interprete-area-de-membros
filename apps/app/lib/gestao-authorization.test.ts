import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cohortFindFirst: vi.fn(),
  env: { GESTAO_V2_ENABLED: "true" },
  member: vi.fn(),
  requireStaff: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  database: { cohort: { findFirst: mocks.cohortFindFirst } },
}));
vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("./auth", () => ({
  getMemberIdentitySnapshot: mocks.member,
}));
vi.mock("./authorization", () => ({
  requireStaff: mocks.requireStaff,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("navigation:not-found");
  },
  redirect: (href: string) => {
    throw new Error(`navigation:redirect:${href}`);
  },
}));

import {
  authorizeGestao,
  requireGestaoActor,
  requireGestaoAdmin,
  requireGestaoCohortActor,
} from "./gestao-authorization";

describe("Gestão server authorization", () => {
  beforeEach(() => {
    mocks.env.GESTAO_V2_ENABLED = "true";
    mocks.member.mockReset().mockResolvedValue({
      avatarUrl: null,
      deactivatedAt: null,
      displayName: "Professora QA",
      email: "teacher@example.test",
      onboardingStatus: "COMPLETED",
      role: "TEACHER",
    });
    mocks.requireStaff.mockReset().mockResolvedValue({
      role: "TEACHER",
      userId: "teacher-qa",
    });
    mocks.cohortFindFirst.mockReset().mockResolvedValue({
      id: "cohort-1",
      version: 1,
    });
  });

  it("loads the current staff identity from the server session", async () => {
    await expect(requireGestaoActor()).resolves.toEqual({
      avatarUrl: null,
      displayName: "Professora QA",
      email: "teacher@example.test",
      role: "TEACHER",
      userId: "teacher-qa",
    });
    expect(mocks.requireStaff).toHaveBeenCalledTimes(1);
    expect(mocks.member).toHaveBeenCalledWith("teacher-qa");
  });

  it("allows teacher work and rejects admin actions without querying admin data", async () => {
    await expect(authorizeGestao("content.manage")).resolves.toMatchObject({
      allowed: true,
      actor: { role: "TEACHER", userId: "teacher-qa" },
    });
    await expect(
      authorizeGestao("access.manage", { memberId: "member-private" })
    ).resolves.toMatchObject({
      allowed: false,
      actor: { role: "TEACHER" },
      resource: { memberId: "member-private" },
    });
  });

  it("blocks direct access to admin actions for a teacher", async () => {
    await expect(requireGestaoAdmin()).rejects.toThrow(
      "navigation:redirect:/gestao/administracao?restrito=1"
    );
  });

  it("limits a teacher to cohorts where their current responsibility exists", async () => {
    await requireGestaoCohortActor("cohort-1");
    expect(mocks.cohortFindFirst).toHaveBeenCalledWith({
      where: {
        id: "cohort-1",
        teachers: { some: { memberId: "teacher-qa" } },
      },
      select: { id: true, version: true },
    });

    mocks.cohortFindFirst.mockResolvedValue(null);
    await expect(requireGestaoCohortActor("cohort-private")).rejects.toThrow(
      "navigation:not-found"
    );
  });

  it("lets an administrator access any cohort without a teacher filter", async () => {
    mocks.requireStaff.mockResolvedValue({
      role: "ADMIN",
      userId: "admin-qa",
    });
    mocks.member.mockResolvedValue({
      avatarUrl: null,
      deactivatedAt: null,
      displayName: "Admin QA",
      email: "admin@example.test",
      onboardingStatus: "COMPLETED",
      role: "ADMIN",
    });

    await requireGestaoCohortActor("cohort-1");
    expect(mocks.cohortFindFirst).toHaveBeenCalledWith({
      where: { id: "cohort-1" },
      select: { id: true, version: true },
    });
  });

  it("uses the latest staff role to authorize administration", async () => {
    mocks.requireStaff.mockResolvedValue({
      role: "ADMIN",
      userId: "admin-qa",
    });
    mocks.member.mockResolvedValue({
      avatarUrl: null,
      deactivatedAt: null,
      displayName: "Admin QA",
      email: "admin@example.test",
      onboardingStatus: "COMPLETED",
      role: "ADMIN",
    });
    await expect(authorizeGestao("access.manage")).resolves.toMatchObject({
      allowed: true,
      actor: { role: "ADMIN", userId: "admin-qa" },
    });
  });

  it("does not resolve a staff identity while the feature flag is off", async () => {
    mocks.env.GESTAO_V2_ENABLED = "false";
    await expect(requireGestaoActor()).rejects.toThrow("navigation:not-found");
    expect(mocks.requireStaff).not.toHaveBeenCalled();
    expect(mocks.member).not.toHaveBeenCalled();
  });

  it("rejects a stale deactivated member snapshot", async () => {
    mocks.member.mockResolvedValue({
      avatarUrl: null,
      deactivatedAt: new Date(),
      displayName: "Desativado",
      email: null,
      onboardingStatus: "COMPLETED",
      role: "TEACHER",
    });
    await expect(requireGestaoActor()).rejects.toThrow(
      "navigation:redirect:/conta-desativada"
    );
  });
});
