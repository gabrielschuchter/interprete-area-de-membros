/**
 * Integration check of the collective-goal SQL against a real PostgreSQL.
 * Runs only when COMMUNITY_GOAL_DB_TEST_URL points at a disposable local
 * database (127.0.0.1); it is skipped everywhere else, including CI.
 *
 *   COMMUNITY_GOAL_DB_TEST_URL=postgresql://…@127.0.0.1:…/db \
 *     NODE_ENV=test bunx vitest run lib/community-goal.db.test.ts --environment node
 */
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

const url = process.env.COMMUNITY_GOAL_DB_TEST_URL;
const isLocal = Boolean(url && new URL(url).hostname === "127.0.0.1");

vi.mock("server-only", () => ({}));

describe.skipIf(!isLocal)("collective goal progress (database)", () => {
  const prefix = `goal-db-test-${Date.now()}`;
  const memberA = `${prefix}-a`;
  const memberB = `${prefix}-b`;
  const now = new Date();
  const startsAt = new Date(now.getTime() - 24 * 3600 * 1000);
  const endsAt = new Date(now.getTime() + 24 * 3600 * 1000);
  const at = (minutesAgo: number) =>
    new Date(now.getTime() - minutesAgo * 60 * 1000);
  // Carregado depois de apontar DATABASE_URL para o banco local.
  let database: typeof import("@repo/database")["database"];
  let campaignId = "";
  const otherCampaigns: string[] = [];

  const session = async (input: {
    readonly endedAt: Date | null;
    readonly kind:
      | "COMMUNITY"
      | "EXERCISE"
      | "LESSON"
      | "LIBRARY_ITEM"
      | "PERSONAL_TIMER";
    readonly memberId: string;
    readonly minutes: number;
    readonly startMinutesAgo: number;
    readonly timerId?: string;
  }) => {
    const startedAt = at(input.startMinutesAgo);
    const created = await database.studyTrackingSession.create({
      data: {
        memberId: input.memberId,
        clientSessionId: input.timerId ?? `${prefix}-${Math.random()}`,
        activityKind: input.kind,
        startedAt,
        lastHeartbeatAt: at(input.startMinutesAgo - input.minutes),
        endedAt: input.endedAt,
      },
    });
    const intervals = Math.round((input.minutes * 60) / 30);
    await database.studyActivityInterval.createMany({
      data: Array.from({ length: intervals }, (_, index) => ({
        memberId: input.memberId,
        sessionId: created.id,
        sequence: index + 1,
        startedAt: new Date(startedAt.getTime() + index * 30_000),
        endedAt: new Date(startedAt.getTime() + (index + 1) * 30_000),
        seconds: 30,
      })),
    });
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.DIRECT_URL = url;
    ({ database } = await import("@repo/database"));
    const active = await database.studyCampaign.findMany({
      where: { publishedAt: { not: null }, archivedAt: null },
      select: { id: true },
    });
    otherCampaigns.push(...active.map(({ id }) => id));
    await database.studyCampaign.updateMany({
      where: { id: { in: otherCampaigns } },
      data: { archivedAt: now },
    });
    await database.member.createMany({
      data: [
        { id: memberA, displayName: "Goal A" },
        { id: memberB, displayName: "Goal B" },
      ],
    });
    campaignId = (
      await database.studyCampaign.create({
        data: {
          title: `${prefix} meta`,
          targetMinutes: 600,
          startsAt,
          endsAt,
          publishedAt: startsAt,
        },
      })
    ).id;

    // A: 10 min of a closed lesson session.
    await session({
      memberId: memberA,
      kind: "LESSON",
      minutes: 10,
      startMinutesAgo: 120,
      endedAt: at(110),
    });
    // A: 5 min in the community overlapping the lesson; merged, adds nothing.
    await session({
      memberId: memberA,
      kind: "COMMUNITY",
      minutes: 5,
      startMinutesAgo: 118,
      endedAt: at(113),
    });
    // B: 6 min, never closed (tab crashed); counts up to its last heartbeat.
    await session({
      memberId: memberB,
      kind: "EXERCISE",
      minutes: 6,
      startMinutesAgo: 60,
      endedAt: null,
    });
    // B: 1 min only; below the 60 s noise floor, ignored.
    await session({
      memberId: memberB,
      kind: "LIBRARY_ITEM",
      minutes: 1,
      startMinutesAgo: 30,
      endedAt: at(29),
    });
    // B: a timer that was not logged as study is ignored; a logged one counts.
    const unlogged = await database.focusTimerSession.create({
      data: {
        memberId: memberB,
        mode: "FOCUS",
        endedAt: at(15),
        startedAt: at(20),
      },
    });
    await session({
      memberId: memberB,
      kind: "PERSONAL_TIMER",
      minutes: 5,
      startMinutesAgo: 20,
      endedAt: at(15),
      timerId: unlogged.id,
    });
    const logged = await database.focusTimerSession.create({
      data: {
        memberId: memberB,
        mode: "COUNTDOWN",
        endedAt: at(5),
        startedAt: at(13),
        studyLoggedAt: at(5),
      },
    });
    await session({
      memberId: memberB,
      kind: "PERSONAL_TIMER",
      minutes: 8,
      startMinutesAgo: 13,
      endedAt: at(5),
      timerId: logged.id,
    });
    // A: outside the campaign window, ignored.
    await session({
      memberId: memberA,
      kind: "LESSON",
      minutes: 20,
      startMinutesAgo: 60 * 30,
      endedAt: at(60 * 30 - 20),
    });
  });

  afterAll(async () => {
    if (!database) {
      return;
    }
    const members = { in: [memberA, memberB] };
    await database.studyActivityInterval.deleteMany({
      where: { memberId: members },
    });
    await database.studyTrackingSession.deleteMany({
      where: { memberId: members },
    });
    await database.focusTimerSession.deleteMany({
      where: { memberId: members },
    });
    await database.studyCampaignSnapshot.deleteMany({ where: { campaignId } });
    await database.studyCampaign.deleteMany({ where: { id: campaignId } });
    await database.member.deleteMany({ where: { id: members } });
    await database.studyCampaign.updateMany({
      where: { id: { in: otherCampaigns } },
      data: { archivedAt: null },
    });
  });

  test("counts background presence without double-counting measured study", async () => {
    const { getCommunityGoalSummary } = await import("./community-goal");
    const hour = new Date(now);
    hour.setUTCMinutes(0, 0, 0);
    const earlier = new Date(hour.getTime() - 3 * 3600 * 1000);
    const earlierStill = new Date(hour.getTime() - 5 * 3600 * 1000);
    await database.memberPresenceHour.createMany({
      data: [
        // 20 min de presença em hora sem estudo medido: soma.
        {
          memberId: memberA,
          hourStart: earlier,
          seconds: 1200,
          lastBeatAt: earlier,
        },
        // Hora do estudo medido de A (10 min): vale o maior, 10 min < 40 min.
        {
          memberId: memberA,
          hourStart: earlierStill,
          seconds: 2400,
          lastBeatAt: earlierStill,
        },
      ],
    });
    const before = await getCommunityGoalSummary(now);
    expect(before?.totalSeconds).toBeGreaterThan(24 * 60);
    await database.memberPresenceHour.deleteMany({
      where: { memberId: { in: [memberA, memberB] } },
    });
  });

  test("adds every member's study once, including unclosed sessions", async () => {
    const { getCommunityGoalSummary } = await import("./community-goal");
    const goal = await getCommunityGoalSummary(now);
    expect(goal?.campaignId).toBe(campaignId);
    // 10 (A, merged) + 6 (B, unclosed) + 8 (B, logged timer) minutes.
    expect(goal?.totalSeconds).toBe(24 * 60);
    expect([...(goal?.sourceKinds ?? [])].sort()).toEqual([
      "COMMUNITY",
      "EXERCISE",
      "LESSON",
      "PERSONAL_TIMER",
    ]);
  });
});
