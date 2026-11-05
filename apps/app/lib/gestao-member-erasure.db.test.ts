/**
 * Integration check of member erasure against a real, disposable local
 * PostgreSQL. Runs only when COMMUNITY_GOAL_DB_TEST_URL points at 127.0.0.1
 * (same switch as community-goal.db.test.ts); skipped everywhere else.
 */
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

const url = process.env.COMMUNITY_GOAL_DB_TEST_URL;
const isLocal = Boolean(url && new URL(url).hostname === "127.0.0.1");

vi.mock("server-only", () => ({}));

describe.skipIf(!isLocal)("member erasure (database)", () => {
  const prefix = `erasure-db-test-${Date.now()}`;
  const admin = `${prefix}-admin`;
  const teacher = `${prefix}-teacher`;
  const heir = `${prefix}-heir`;
  const late = `${prefix}-late`;
  let cohortId = "";
  let spaceId = "";
  let lonelySpaceId = "";
  // Carregado depois de apontar DATABASE_URL para o banco local.
  let database: typeof import("@repo/database")["database"];

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.DIRECT_URL = url;
    ({ database } = await import("@repo/database"));
    await database.member.createMany({
      data: [
        { id: admin, role: "ADMIN" },
        { id: teacher, role: "TEACHER" },
        { id: heir },
        { id: late },
      ],
    });
    cohortId = (
      await database.cohort.create({
        data: {
          name: `${prefix} turma`,
          normalizedName: `${prefix} turma`,
          slug: `${prefix}-turma`,
          startsAt: new Date(),
          createdByMemberId: teacher,
        },
      })
    ).id;
    spaceId = (
      await database.communitySpace.create({
        data: {
          title: `${prefix} grupo`,
          normalizedTitle: `${prefix} grupo`,
          slug: `${prefix}-grupo`,
          ownerId: teacher,
          visibility: "PRIVATE",
          members: {
            create: [
              { memberId: teacher, role: "OWNER", joinedAt: new Date(1000) },
              { memberId: heir, joinedAt: new Date(2000) },
              { memberId: late, joinedAt: new Date(3000) },
            ],
          },
        },
      })
    ).id;
    lonelySpaceId = (
      await database.communitySpace.create({
        data: {
          title: `${prefix} vazio`,
          normalizedTitle: `${prefix} vazio`,
          slug: `${prefix}-vazio`,
          ownerId: teacher,
          members: { create: [{ memberId: teacher, role: "OWNER" }] },
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (!database) {
      return;
    }
    await database.communitySpace.deleteMany({
      where: { id: { in: [spaceId, lonelySpaceId] } },
    });
    await database.cohort.deleteMany({ where: { id: cohortId } });
    await database.member.deleteMany({
      where: { id: { in: [admin, teacher, heir, late] } },
    });
  });

  test("a teacher can be erased; staff records and shared groups are handed over", async () => {
    const { eraseMemberRecords, getErasurePreview } = await import(
      "./gestao-member-erasure"
    );
    const preview = await getErasurePreview(teacher, admin);
    expect(preview?.blockers).toEqual([]);
    expect(preview?.counts.staffRecords).toBe(1);
    expect(preview?.counts.sharedSpaces).toBe(1);
    expect((await getErasurePreview(admin, admin))?.blockers).toContain("self");

    await database.$transaction((transaction) =>
      eraseMemberRecords(transaction, teacher, admin)
    );

    expect(await database.member.count({ where: { id: teacher } })).toBe(0);
    expect(
      (await database.cohort.findUnique({ where: { id: cohortId } }))
        ?.createdByMemberId
    ).toBe(admin);
    const space = await database.communitySpace.findUnique({
      where: { id: spaceId },
      select: {
        ownerId: true,
        members: { select: { memberId: true, role: true } },
      },
    });
    expect(space?.ownerId).toBe(heir);
    expect(space?.members).toContainEqual({ memberId: heir, role: "OWNER" });
    expect(
      await database.communitySpace.count({ where: { id: lonelySpaceId } })
    ).toBe(0);
  });
});
