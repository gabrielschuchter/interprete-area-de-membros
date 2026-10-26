import { readFileSync } from "node:fs";
import {
  ContentStatus,
  database,
  FocusTimerMode,
  MemberRole,
  type Prisma,
  StudyActivityKind,
  StudyCampaignRenewalMode,
} from "@repo/database";
import {
  CommunityGoalConflictError,
  getCommunityGoalSummary,
  saveCommunityGoal,
} from "../../lib/community-goal";

interface GoalDatabaseRequest {
  readonly input: Record<string, string>;
  readonly operation: string;
}

interface IntervalSpec {
  readonly offsetSeconds: number;
  readonly seconds: number;
}

const runId = process.env.COMMUNITY_QA_RUN_ID ?? "missing-run-id";
const runIdPattern = /^\d{8}-\d{6}-[a-f0-9]{8}$/;
const prefix = `community-goal-qa-${runId}`;
const campaignTitlePrefix = `Meta coletiva QA ${runId}`;

const assertLocalQa = () => {
  const databaseUrl = new URL(
    process.env.DATABASE_URL ?? "http://invalid.local"
  );
  if (
    !runIdPattern.test(runId) ||
    process.env.COMMUNITY_QA_ISOLATED !== "true" ||
    databaseUrl.hostname !== "127.0.0.1" ||
    databaseUrl.port !== "54325" ||
    databaseUrl.pathname.slice(1) !== "interprete_community_v2_qa"
  ) {
    throw new Error(
      "The Community V2 collective-goal QA helper only supports its guarded local PostgreSQL database."
    );
  }
};

const requiredInput = (input: Record<string, string>, name: string) => {
  const value = input[name];
  if (!value) {
    throw new Error(`Missing QA database input: ${name}`);
  }
  return value;
};

const requireActiveMember = async (memberId: string) => {
  const member = await database.member.findFirst({
    where: { id: memberId, deactivatedAt: null },
    select: { id: true, role: true },
  });
  if (!member) {
    throw new Error("A configured Clerk Development QA member is unavailable.");
  }
  return member;
};

const findPublishedLesson = async () => {
  const lesson = await database.lesson.findFirst({
    where: {
      status: ContentStatus.PUBLISHED,
      module: {
        is: {
          status: ContentStatus.PUBLISHED,
          course: {
            is: {
              status: ContentStatus.PUBLISHED,
              experience: "ASYNC",
              OR: [
                { learningPathId: null },
                { learningPath: { is: { status: ContentStatus.PUBLISHED } } },
              ],
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (!lesson) {
    throw new Error(
      "The local QA database has no published lesson to use as a real study source."
    );
  }
  return lesson.id;
};

const intervalRows = (startedAt: Date, specs: readonly IntervalSpec[]) =>
  specs.map(({ offsetSeconds, seconds }) => {
    if (seconds <= 0 || seconds > 30) {
      throw new Error(
        "QA study intervals must use their real 1–30 second contract."
      );
    }
    const intervalStart = new Date(startedAt.getTime() + offsetSeconds * 1000);
    return {
      startedAt: intervalStart,
      endedAt: new Date(intervalStart.getTime() + seconds * 1000),
      seconds,
      isPlayback: false,
    };
  });

const createTrackingSession = async (
  transaction: Prisma.TransactionClient,
  details: {
    readonly activityKind: StudyActivityKind;
    readonly clientSessionId: string;
    readonly endedAt: Date;
    readonly intervals: readonly IntervalSpec[];
    readonly memberId: string;
    readonly resourceId: string;
    readonly startedAt: Date;
  }
) => {
  const session = await transaction.studyTrackingSession.create({
    data: {
      memberId: details.memberId,
      clientSessionId: details.clientSessionId,
      activityKind: details.activityKind,
      resourceId: details.resourceId,
      lastSequence: details.intervals.length - 1,
      lastHeartbeatAt: details.endedAt,
      startedAt: details.startedAt,
      endedAt: details.endedAt,
    },
    select: { id: true },
  });
  await transaction.studyActivityInterval.createMany({
    data: intervalRows(details.startedAt, details.intervals).map(
      (interval, sequence) => ({
        ...interval,
        memberId: details.memberId,
        sessionId: session.id,
        sequence,
      })
    ),
  });
  return session.id;
};

const createRaceCampaign = async (
  teacherId: string,
  now: Date,
  suffix: string
) =>
  saveCommunityGoal(
    {
      title: `${campaignTitlePrefix} ${suffix}`,
      targetMinutes: 15,
      startsAt: new Date(now.getTime() - 30 * 60_000),
      endsAt: new Date(now.getTime() + 30 * 86_400_000),
      renewalMode: StudyCampaignRenewalMode.MANUAL,
    },
    teacherId,
    now
  );

const createCampaignRace = async () => {
  const [teacher, published] = await Promise.all([
    requireActiveMember(process.env.COMMUNITY_QA_TEACHER_ID ?? ""),
    database.studyCampaign.findFirst({
      where: { publishedAt: { not: null }, archivedAt: null },
      select: { id: true, title: true },
    }),
  ]);
  if (teacher.role !== MemberRole.TEACHER) {
    throw new Error("The configured local QA identity is not a TEACHER.");
  }
  if (published) {
    throw new Error(
      "Local QA did not create a test goal because another published campaign already exists; existing campaign data was preserved."
    );
  }

  const now = new Date();
  const attempts = await Promise.allSettled([
    createRaceCampaign(teacher.id, now, "A"),
    createRaceCampaign(teacher.id, now, "B"),
  ]);
  const created = attempts.flatMap((attempt) =>
    attempt.status === "fulfilled" ? [attempt.value] : []
  );
  if (created.length !== 1) {
    if (created.length > 0) {
      await database.studyCampaign.deleteMany({
        where: {
          id: { in: created.map(({ id }) => id) },
          title: { startsWith: campaignTitlePrefix },
        },
      });
    }
    const failures = attempts.flatMap((attempt) =>
      attempt.status === "rejected" &&
      !(attempt.reason instanceof CommunityGoalConflictError)
        ? [attempt.reason]
        : []
    );
    if (failures.length > 0) {
      throw failures[0];
    }
    throw new Error(
      `Concurrent goal creation should persist exactly one campaign; it persisted ${created.length}.`
    );
  }

  const activeCount = await database.studyCampaign.count({
    where: { publishedAt: { not: null }, archivedAt: null },
  });
  if (activeCount !== 1) {
    throw new Error(
      "The concurrent goal test did not leave exactly one published campaign."
    );
  }
  return {
    campaignId: created[0].id,
    campaignTitle: created[0].title,
    updatedAt: created[0].updatedAt.toISOString(),
  };
};

const seedStudyRecords = async (campaignId: string) => {
  const [member, secondaryMember, campaign] = await Promise.all([
    requireActiveMember(process.env.COMMUNITY_QA_MEMBER_ID ?? ""),
    requireActiveMember(process.env.COMMUNITY_QA_SECONDARY_MEMBER_ID ?? ""),
    database.studyCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, title: true, startsAt: true, endsAt: true },
    }),
  ]);
  if (
    !campaign?.title.startsWith(campaignTitlePrefix) ||
    campaign.startsAt >= new Date() ||
    campaign.endsAt <= new Date()
  ) {
    throw new Error(
      "Study-record QA can only seed the newly-created active campaign."
    );
  }
  const lessonId = await findPublishedLesson();
  const periodStart = campaign.startsAt;
  const periodEnd = campaign.endsAt;
  const base = new Date(periodStart.getTime() + 5 * 60_000);
  const intervals = (offsetSeconds: number, count: number, lastSeconds = 30) =>
    Array.from({ length: count }, (_, index) => ({
      offsetSeconds: offsetSeconds + index * 30,
      seconds: index === count - 1 ? lastSeconds : 30,
    }));

  await database.$transaction(async (transaction) => {
    const lessonSession = async (
      key: string,
      startedAt: Date,
      specs: readonly IntervalSpec[],
      endedAt = new Date(
        startedAt.getTime() +
          specs.reduce((total, { seconds }) => total + seconds, 0) * 1000
      )
    ) =>
      createTrackingSession(transaction, {
        activityKind: StudyActivityKind.LESSON,
        clientSessionId: `${prefix}-${key}`,
        endedAt,
        intervals: specs,
        memberId: member.id,
        resourceId: lessonId,
        startedAt,
      });

    const boundaryStart = new Date(periodStart.getTime() - 10_000);
    await lessonSession("boundary-start", boundaryStart, intervals(0, 3));

    const lessonStart = base;
    const lessonSpecs = intervals(0, 4);
    await lessonSession("lesson-main", lessonStart, lessonSpecs);
    await lessonSession(
      "lesson-overlap",
      new Date(lessonStart.getTime() + 60_000),
      intervals(0, 4)
    );

    await lessonSession(
      "session-60",
      new Date(base.getTime() + 360_000),
      intervals(0, 2)
    );
    await lessonSession(
      "session-59",
      new Date(base.getTime() + 480_000),
      intervals(0, 2, 29)
    );
    await lessonSession(
      "session-61",
      new Date(base.getTime() + 600_000),
      intervals(0, 3, 1)
    );

    const timerId = `${prefix}-focus-timer`;
    const timerStart = new Date(base.getTime() + 720_000);
    const timerEnd = new Date(timerStart.getTime() + 120_000);
    await transaction.focusTimerSession.create({
      data: {
        id: timerId,
        memberId: secondaryMember.id,
        mode: FocusTimerMode.FOCUS,
        title: `${prefix} timer fixture`,
        startedAt: timerStart,
        endedAt: timerEnd,
        completedAt: timerEnd,
        elapsedBeforePause: 120,
        needsReview: false,
        studyLoggedAt: timerEnd,
        segments: {
          create: [
            {
              startedAt: timerStart,
              endedAt: timerEnd,
            },
          ],
        },
      },
    });
    await createTrackingSession(transaction, {
      activityKind: StudyActivityKind.PERSONAL_TIMER,
      clientSessionId: timerId,
      endedAt: timerEnd,
      intervals: intervals(0, 4),
      memberId: secondaryMember.id,
      resourceId: timerId,
      startedAt: timerStart,
    });

    const periodEndSessionStart = new Date(periodEnd.getTime() - 90_000);
    await lessonSession(
      "boundary-end",
      periodEndSessionStart,
      intervals(0, 3),
      periodEnd
    );
    const afterPeriodStart = periodEnd;
    const afterPeriodEnd = new Date(afterPeriodStart.getTime() + 90_000);
    await lessonSession(
      "after-period",
      afterPeriodStart,
      intervals(0, 3),
      afterPeriodEnd
    );
  });

  const goal = await getCommunityGoalSummary();
  if (!goal || goal.campaignId !== campaignId) {
    throw new Error(
      "The seeded campaign could not be read back as the community goal."
    );
  }
  return {
    campaignId,
    expectedTotalSeconds: 531,
    goal: {
      sourceKinds: goal.sourceKinds,
      state: goal.state,
      totalSeconds: goal.totalSeconds,
    },
    lessonId,
  };
};

const setManualExpired = async (campaignId: string) => {
  const campaign = await database.studyCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, title: true, startsAt: true },
  });
  if (!campaign?.title.startsWith(campaignTitlePrefix)) {
    throw new Error("The QA helper refused to expire a non-test campaign.");
  }
  const endedAt = new Date(Date.now() - 60_000);
  const updated = await database.studyCampaign.updateMany({
    where: { id: campaign.id },
    data: {
      renewalMode: StudyCampaignRenewalMode.MANUAL,
      startsAt: campaign.startsAt,
      endsAt: endedAt,
    },
  });
  if (updated.count !== 1) {
    throw new Error(
      "The local QA campaign could not be moved into its manual ended state."
    );
  }
  return {
    endedAt: endedAt.toISOString(),
    summary: await getCommunityGoalSummary(),
  };
};

const expireAutomaticCampaign = async (campaignId: string) => {
  const campaign = await database.studyCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, title: true },
  });
  if (!campaign?.title.startsWith(campaignTitlePrefix)) {
    throw new Error("The QA helper refused to expire a non-test campaign.");
  }
  const startsAt = new Date(Date.now() - 2 * 86_400_000);
  const endsAt = new Date(startsAt.getTime() + 86_400_000);
  await database.studyCampaign.update({
    where: { id: campaign.id },
    data: {
      renewalMode: StudyCampaignRenewalMode.AUTOMATIC,
      startsAt,
      endsAt,
    },
  });
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
};

const campaignState = async (campaignId: string) => {
  const [campaign, snapshots, summary] = await Promise.all([
    database.studyCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        targetMinutes: true,
        renewalMode: true,
        updatedAt: true,
      },
    }),
    database.studyCampaignSnapshot.findMany({
      where: { campaignId },
      orderBy: [{ periodStartsAt: "asc" }, { periodEndsAt: "asc" }],
      select: {
        periodStartsAt: true,
        periodEndsAt: true,
        totalSeconds: true,
        targetMinutes: true,
        sourceKinds: true,
        snapshottedAt: true,
      },
    }),
    getCommunityGoalSummary(),
  ]);
  if (!campaign?.title.startsWith(campaignTitlePrefix)) {
    throw new Error("The QA helper refused to inspect a non-test campaign.");
  }
  return {
    campaign: campaign
      ? {
          id: campaign.id,
          title: campaign.title,
          startsAt: campaign.startsAt.toISOString(),
          endsAt: campaign.endsAt.toISOString(),
          targetMinutes: campaign.targetMinutes,
          renewalMode: campaign.renewalMode,
          updatedAt: campaign.updatedAt.toISOString(),
        }
      : null,
    snapshots: snapshots.map((snapshot) => ({
      startsAt: snapshot.periodStartsAt.toISOString(),
      endsAt: snapshot.periodEndsAt.toISOString(),
      totalSeconds: Number(snapshot.totalSeconds),
      targetMinutes: snapshot.targetMinutes,
      sourceKinds: snapshot.sourceKinds,
      snapshottedAt: snapshot.snapshottedAt.toISOString(),
    })),
    summary: summary
      ? {
          state: summary.state,
          startsAt: summary.startsAt.toISOString(),
          endsAt: summary.endsAt.toISOString(),
          totalSeconds: summary.totalSeconds,
          sourceKinds: summary.sourceKinds,
        }
      : null,
  };
};

const avatarProfileState = async (memberId: string) => {
  const [profile, eligibleCount] = await Promise.all([
    database.profile.findUnique({
      where: { clerkUserId: memberId },
      select: { showInCommunityAvatars: true },
    }),
    database.profile.count({
      where: {
        showInCommunityAvatars: true,
        member: { is: { deactivatedAt: null } },
      },
    }),
  ]);
  if (!profile) {
    throw new Error("The local QA member profile is unavailable.");
  }
  return {
    showInCommunityAvatars: profile.showInCommunityAvatars,
    eligibleCount,
  };
};

const restoreAvatarProfileState = async (
  memberId: string,
  showInCommunityAvatars: boolean
) => {
  if (memberId !== process.env.COMMUNITY_QA_MEMBER_ID) {
    throw new Error(
      "The QA helper only restores the configured test member profile."
    );
  }
  const updated = await database.profile.updateMany({
    where: { clerkUserId: memberId },
    data: { showInCommunityAvatars },
  });
  if (updated.count !== 1) {
    throw new Error("The QA test member profile could not be restored.");
  }
  return { restored: true };
};

const cleanupFixture = async (campaignId: string) => {
  const campaign = await database.studyCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, title: true },
  });
  if (!campaign?.title.startsWith(campaignTitlePrefix)) {
    return { deleted: false };
  }

  const studySessions = await database.studyTrackingSession.findMany({
    where: { clientSessionId: { startsWith: prefix } },
    select: { id: true },
  });
  await database.studyCampaignSnapshot.deleteMany({
    where: { campaignId },
  });
  if (studySessions.length > 0) {
    await database.studyActivityInterval.deleteMany({
      where: { sessionId: { in: studySessions.map(({ id }) => id) } },
    });
    await database.studyTrackingSession.deleteMany({
      where: { id: { in: studySessions.map(({ id }) => id) } },
    });
  }
  await database.focusTimerSession.deleteMany({
    where: { id: `${prefix}-focus-timer` },
  });
  await database.studyCampaign.delete({ where: { id: campaignId } });
  return {
    deleted: true,
    studySessions: studySessions.length,
  };
};

const query = ({ operation, input }: GoalDatabaseRequest) => {
  assertLocalQa();
  switch (operation) {
    case "create-race":
      return createCampaignRace();
    case "seed-study-records":
      return seedStudyRecords(requiredInput(input, "campaignId"));
    case "set-manual-expired":
      return setManualExpired(requiredInput(input, "campaignId"));
    case "expire-automatic":
      return expireAutomaticCampaign(requiredInput(input, "campaignId"));
    case "campaign-state":
      return campaignState(requiredInput(input, "campaignId"));
    case "avatar-profile-state":
      return avatarProfileState(requiredInput(input, "memberId"));
    case "restore-avatar":
      return restoreAvatarProfileState(
        requiredInput(input, "memberId"),
        requiredInput(input, "showInCommunityAvatars") === "true"
      );
    case "cleanup":
      return cleanupFixture(requiredInput(input, "campaignId"));
    default:
      throw new Error(`Unsupported community goal QA query: ${operation}`);
  }
};

try {
  const request = JSON.parse(readFileSync(0, "utf8")) as GoalDatabaseRequest;
  const result = await query(request);
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`
  );
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
