import "server-only";

import {
  database,
  Prisma,
  StudyActivityKind,
  StudyCampaignRenewalMode,
} from "@repo/database";
import { tracePerformance } from "@repo/observability/performance";

const CAMPAIGN_LOCK_CLASS = 74_291;
const CAMPAIGN_LOCK_ID = 9;
const MAX_CATCH_UP_PERIODS = 20_000;

const campaignSelect = {
  id: true,
  title: true,
  description: true,
  targetMinutes: true,
  startsAt: true,
  endsAt: true,
  renewalMode: true,
  publishedAt: true,
  archivedAt: true,
  updatedAt: true,
} satisfies Prisma.StudyCampaignSelect;

type Campaign = Prisma.StudyCampaignGetPayload<{
  select: typeof campaignSelect;
}>;

interface GoalPeriod {
  readonly endsAt: Date;
  readonly startsAt: Date;
}

interface PeriodProgress {
  readonly sourceKinds: StudyActivityKind[];
  readonly totalSeconds: bigint;
}

interface RawPeriodProgress {
  readonly periodIndex: number;
  readonly sourceKinds: string[];
  readonly totalSeconds: bigint;
}

export type CommunityGoalState = "empty" | "active" | "ended" | "scheduled";

export interface CommunityGoalSummary {
  readonly campaignId: string;
  readonly description: string | null;
  readonly endsAt: Date;
  readonly renewalMode: StudyCampaignRenewalMode;
  readonly snapshottedAt: Date | null;
  readonly sourceKinds: readonly StudyActivityKind[];
  readonly startsAt: Date;
  readonly state: CommunityGoalState;
  readonly targetMinutes: number;
  readonly title: string;
  readonly totalSeconds: number;
  readonly updatedAt: Date;
}

export interface CommunityGoalManagement {
  readonly goal: CommunityGoalSummary | null;
  readonly history: Array<{
    readonly endsAt: Date;
    readonly snapshottedAt: Date;
    readonly sourceKinds: StudyActivityKind[];
    readonly startsAt: Date;
    readonly targetMinutes: number;
    readonly totalSeconds: number;
  }>;
}

export class CommunityGoalConflictError extends Error {
  constructor(
    message = "A meta foi alterada em outra sessão. Atualize a página."
  ) {
    super(message);
    this.name = "CommunityGoalConflictError";
  }
}

export class CommunityGoalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommunityGoalValidationError";
  }
}

const isRetryableTransactionError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error.code === "P2034" || error.code === "P2002");

const acquireCampaignLock = async (transaction: Prisma.TransactionClient) => {
  await transaction.$queryRaw`
    SELECT pg_advisory_xact_lock(${CAMPAIGN_LOCK_CLASS}, ${CAMPAIGN_LOCK_ID})::text AS "locked"
  `;
};

const normalizeSourceKinds = (sourceKinds: readonly string[]) => {
  const knownKinds = new Set<string>(Object.values(StudyActivityKind));
  return sourceKinds.filter((kind): kind is StudyActivityKind =>
    knownKinds.has(kind)
  );
};

const queryPeriodProgress = async (
  transaction: Prisma.TransactionClient | typeof database,
  periods: readonly GoalPeriod[]
): Promise<PeriodProgress[]> => {
  if (periods.length === 0) {
    return [];
  }

  const requestedPeriods = Prisma.join(
    periods.map(
      ({ startsAt, endsAt }, periodIndex) =>
        Prisma.sql`(${periodIndex}, CAST(${startsAt} AS TIMESTAMP(3)), CAST(${endsAt} AS TIMESTAMP(3)))`
    )
  );
  const rows = await transaction.$queryRaw<RawPeriodProgress[]>(Prisma.sql`
    WITH requested_periods ("periodIndex", "periodStartsAt", "periodEndsAt") AS (
      VALUES ${requestedPeriods}
    ), eligible_sessions AS (
      SELECT
        session."id",
        session."memberId",
        session."activityKind",
        session."startedAt",
        session."endedAt"
      FROM "StudyTrackingSession" AS session
      CROSS JOIN LATERAL (
        SELECT COALESCE(SUM(source_interval."seconds"), 0) AS "recordedSeconds"
        FROM "StudyActivityInterval" AS source_interval
        WHERE source_interval."sessionId" = session."id"
          AND source_interval."memberId" = session."memberId"
      ) AS source_activity
      WHERE session."endedAt" IS NOT NULL
        AND source_activity."recordedSeconds" > 60
        AND session."startedAt" < (
          SELECT MAX("periodEndsAt") FROM requested_periods
        )
        AND session."endedAt" > (
          SELECT MIN("periodStartsAt") FROM requested_periods
        )
        AND (
          session."activityKind" <> 'PERSONAL_TIMER'::"StudyActivityKind"
          OR EXISTS (
            SELECT 1
            FROM "FocusTimerSession" AS timer
            WHERE timer."id" = session."clientSessionId"
              AND timer."memberId" = session."memberId"
              AND timer."endedAt" IS NOT NULL
              AND timer."needsReview" = false
              AND timer."studyLoggedAt" IS NOT NULL
              AND timer."mode" IN (
                'FOCUS'::"FocusTimerMode",
                'COUNTDOWN'::"FocusTimerMode",
                'STOPWATCH'::"FocusTimerMode"
              )
          )
        )
    ), eligible_intervals AS (
      SELECT
        period."periodIndex",
        activity_interval."memberId",
        session."activityKind",
        GREATEST(
          activity_interval."startedAt",
          session."startedAt",
          period."periodStartsAt"
        ) AS "rangeStart",
        LEAST(
          activity_interval."endedAt",
          activity_interval."startedAt" + activity_interval."seconds" * INTERVAL '1 second',
          session."endedAt",
          period."periodEndsAt"
        ) AS "rangeEnd"
      FROM requested_periods AS period
      JOIN "StudyActivityInterval" AS activity_interval
        ON activity_interval."startedAt" >= period."periodStartsAt" - INTERVAL '31 seconds'
        AND activity_interval."startedAt" < period."periodEndsAt"
        AND activity_interval."endedAt" > period."periodStartsAt"
        AND activity_interval."seconds" > 0
      JOIN eligible_sessions AS session
        ON session."id" = activity_interval."sessionId"
        AND session."memberId" = activity_interval."memberId"
      WHERE GREATEST(
        activity_interval."startedAt",
        session."startedAt",
        period."periodStartsAt"
      ) < LEAST(
        activity_interval."endedAt",
        activity_interval."startedAt" + activity_interval."seconds" * INTERVAL '1 second',
        session."endedAt",
        period."periodEndsAt"
      )
    ), member_ranges AS (
      SELECT
        "periodIndex",
        "memberId",
        range_agg(tsrange("rangeStart", "rangeEnd", '[)')) AS "mergedRanges"
      FROM eligible_intervals
      GROUP BY "periodIndex", "memberId"
    ), period_totals AS (
      SELECT
        member_ranges."periodIndex",
        SUM(
          FLOOR(EXTRACT(EPOCH FROM upper(duration_range) - lower(duration_range)))::bigint
        ) AS "totalSeconds"
      FROM member_ranges
      CROSS JOIN LATERAL unnest(member_ranges."mergedRanges") AS merged(duration_range)
      GROUP BY member_ranges."periodIndex"
    ), period_sources AS (
      SELECT
        "periodIndex",
        array_agg(DISTINCT "activityKind"::text ORDER BY "activityKind"::text) AS "sourceKinds"
      FROM eligible_intervals
      GROUP BY "periodIndex"
    )
    SELECT
      period."periodIndex",
      COALESCE(totals."totalSeconds", 0)::bigint AS "totalSeconds",
      COALESCE(sources."sourceKinds", ARRAY[]::text[]) AS "sourceKinds"
    FROM requested_periods AS period
    LEFT JOIN period_totals AS totals USING ("periodIndex")
    LEFT JOIN period_sources AS sources USING ("periodIndex")
    ORDER BY period."periodIndex"
  `);

  return rows.map((row) => ({
    totalSeconds: row.totalSeconds,
    sourceKinds: normalizeSourceKinds(row.sourceKinds),
  }));
};

const findActiveCampaign = (
  transaction: Prisma.TransactionClient | typeof database
) =>
  transaction.studyCampaign.findFirst({
    where: { publishedAt: { not: null }, archivedAt: null },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: campaignSelect,
  });

const snapshotPeriod = async (
  transaction: Prisma.TransactionClient,
  campaign: Campaign,
  period: GoalPeriod,
  progress: PeriodProgress
) => {
  await transaction.studyCampaignSnapshot.createMany({
    data: [
      {
        campaignId: campaign.id,
        periodStartsAt: period.startsAt,
        periodEndsAt: period.endsAt,
        targetMinutes: campaign.targetMinutes,
        totalSeconds: progress.totalSeconds,
        sourceKinds: progress.sourceKinds,
      },
    ],
    skipDuplicates: true,
  });
  return transaction.studyCampaignSnapshot.findUniqueOrThrow({
    where: {
      campaignId_periodStartsAt_periodEndsAt: {
        campaignId: campaign.id,
        periodStartsAt: period.startsAt,
        periodEndsAt: period.endsAt,
      },
    },
    select: {
      periodStartsAt: true,
      periodEndsAt: true,
      targetMinutes: true,
      totalSeconds: true,
      sourceKinds: true,
      snapshottedAt: true,
    },
  });
};

const ensureEndedManualSnapshot = async (campaignId: string, now: Date) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await database.$transaction(
        async (transaction) => {
          await acquireCampaignLock(transaction);
          const campaign = await transaction.studyCampaign.findFirst({
            where: {
              id: campaignId,
              publishedAt: { not: null },
              archivedAt: null,
            },
            select: campaignSelect,
          });
          if (!campaign || campaign.endsAt > now) {
            return null;
          }
          const existing = await transaction.studyCampaignSnapshot.findUnique({
            where: {
              campaignId_periodStartsAt_periodEndsAt: {
                campaignId: campaign.id,
                periodStartsAt: campaign.startsAt,
                periodEndsAt: campaign.endsAt,
              },
            },
            select: {
              periodStartsAt: true,
              periodEndsAt: true,
              targetMinutes: true,
              totalSeconds: true,
              sourceKinds: true,
              snapshottedAt: true,
            },
          });
          if (existing) {
            return existing;
          }
          const [progress] = await queryPeriodProgress(transaction, [
            { startsAt: campaign.startsAt, endsAt: campaign.endsAt },
          ]);
          if (!progress) {
            return null;
          }
          return snapshotPeriod(
            transaction,
            campaign,
            { startsAt: campaign.startsAt, endsAt: campaign.endsAt },
            progress
          );
        },
        { isolationLevel: "Serializable" }
      );
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === 2) {
        throw error;
      }
    }
  }
  return null;
};

const advanceAutomaticCampaign = async (campaignId: string, now: Date) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await database.$transaction(
        async (transaction) => {
          await acquireCampaignLock(transaction);
          const campaign = await transaction.studyCampaign.findFirst({
            where: {
              id: campaignId,
              publishedAt: { not: null },
              archivedAt: null,
              renewalMode: StudyCampaignRenewalMode.AUTOMATIC,
              endsAt: { lte: now },
            },
            select: campaignSelect,
          });
          if (!campaign) {
            return;
          }

          const periodLength =
            campaign.endsAt.getTime() - campaign.startsAt.getTime();
          if (periodLength <= 0) {
            throw new CommunityGoalValidationError(
              "O período salvo para a meta não é válido."
            );
          }

          const periods: GoalPeriod[] = [];
          let startsAt = campaign.startsAt;
          let endsAt = campaign.endsAt;
          while (endsAt <= now) {
            if (periods.length >= MAX_CATCH_UP_PERIODS) {
              throw new CommunityGoalValidationError(
                "Há períodos demais para renovar automaticamente. Ajuste o período da meta."
              );
            }
            periods.push({ startsAt, endsAt });
            startsAt = endsAt;
            endsAt = new Date(startsAt.getTime() + periodLength);
          }

          const progressByPeriod = await queryPeriodProgress(
            transaction,
            periods
          );
          await transaction.studyCampaignSnapshot.createMany({
            data: periods.flatMap((period, index) => {
              const progress = progressByPeriod[index];
              return progress
                ? [
                    {
                      campaignId: campaign.id,
                      periodStartsAt: period.startsAt,
                      periodEndsAt: period.endsAt,
                      targetMinutes: campaign.targetMinutes,
                      totalSeconds: progress.totalSeconds,
                      sourceKinds: progress.sourceKinds,
                    },
                  ]
                : [];
            }),
            skipDuplicates: true,
          });

          await transaction.studyCampaign.updateMany({
            where: { id: campaign.id, updatedAt: campaign.updatedAt },
            data: { startsAt, endsAt },
          });
        },
        { isolationLevel: "Serializable" }
      );
      return;
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === 2) {
        throw error;
      }
    }
  }
};

const toGoalSummary = (
  campaign: Campaign,
  state: CommunityGoalState,
  progress: PeriodProgress,
  snapshottedAt: Date | null = null
): CommunityGoalSummary => ({
  campaignId: campaign.id,
  description: campaign.description,
  endsAt: campaign.endsAt,
  renewalMode: campaign.renewalMode,
  snapshottedAt,
  sourceKinds: progress.sourceKinds,
  startsAt: campaign.startsAt,
  state,
  targetMinutes: campaign.targetMinutes,
  title: campaign.title,
  totalSeconds: Number(progress.totalSeconds),
  updatedAt: campaign.updatedAt,
});

export const getCommunityGoalSummary = async (now = new Date()) => {
  let campaign = await findActiveCampaign(database);
  if (!campaign) {
    return null;
  }

  if (
    campaign.renewalMode === StudyCampaignRenewalMode.AUTOMATIC &&
    campaign.endsAt <= now
  ) {
    await advanceAutomaticCampaign(campaign.id, now);
    campaign = await findActiveCampaign(database);
    if (!campaign) {
      return null;
    }
  }

  if (campaign.endsAt <= now) {
    const snapshot = await ensureEndedManualSnapshot(campaign.id, now);
    if (snapshot) {
      return toGoalSummary(
        campaign,
        "ended",
        {
          totalSeconds: snapshot.totalSeconds,
          sourceKinds: snapshot.sourceKinds,
        },
        snapshot.snapshottedAt
      );
    }
    return toGoalSummary(campaign, "ended", {
      totalSeconds: 0n,
      sourceKinds: [],
    });
  }

  if (campaign.startsAt > now) {
    return toGoalSummary(campaign, "scheduled", {
      totalSeconds: 0n,
      sourceKinds: [],
    });
  }

  const [progress] = await tracePerformance(
    "member.community.goal.progress",
    () =>
      queryPeriodProgress(database, [
        { startsAt: campaign.startsAt, endsAt: campaign.endsAt },
      ])
  );
  return toGoalSummary(
    campaign,
    progress?.totalSeconds === 0n ? "empty" : "active",
    progress ?? { totalSeconds: 0n, sourceKinds: [] }
  );
};

export const getCommunityGoalManagement = async (
  now = new Date()
): Promise<CommunityGoalManagement> => {
  const goal = await getCommunityGoalSummary(now);
  const history = await database.studyCampaignSnapshot.findMany({
    orderBy: [{ snapshottedAt: "desc" }, { id: "desc" }],
    take: 12,
    select: {
      periodStartsAt: true,
      periodEndsAt: true,
      targetMinutes: true,
      totalSeconds: true,
      sourceKinds: true,
      snapshottedAt: true,
    },
  });
  return {
    goal,
    history: history.map((snapshot) => ({
      endsAt: snapshot.periodEndsAt,
      snapshottedAt: snapshot.snapshottedAt,
      sourceKinds: snapshot.sourceKinds,
      startsAt: snapshot.periodStartsAt,
      targetMinutes: snapshot.targetMinutes,
      totalSeconds: Number(snapshot.totalSeconds),
    })),
  };
};

export const validateCommunityGoalConfig = (input: {
  readonly endsAt: Date;
  readonly startsAt: Date;
  readonly targetMinutes: number;
  readonly title: string;
}) => {
  const periodLength = input.endsAt.getTime() - input.startsAt.getTime();
  if (
    !input.title.trim() ||
    input.title.trim().length > 180 ||
    !Number.isInteger(input.targetMinutes) ||
    input.targetMinutes < 15 ||
    input.targetMinutes > 100_800 ||
    periodLength < 86_400_000 ||
    periodLength > 366 * 86_400_000
  ) {
    throw new CommunityGoalValidationError(
      "Informe título, meta entre 15 e 100.800 minutos e período de 1 a 366 dias."
    );
  }
};

interface CommunityGoalConfigInput {
  readonly campaignId?: string;
  readonly endsAt: Date;
  readonly renewalMode: StudyCampaignRenewalMode;
  readonly startsAt: Date;
  readonly targetMinutes: number;
  readonly title: string;
  readonly updatedAt?: Date;
}

type ActiveGoalCampaign = NonNullable<
  Awaited<ReturnType<typeof findActiveCampaign>>
>;

const assertNoPublishedGoal = (current: ActiveGoalCampaign | null): void => {
  if (current) {
    throw new CommunityGoalConflictError(
      "Já existe uma meta ativa. Atualize a página antes de salvar."
    );
  }
};

const assertPublishedGoalIsCurrent = (
  current: ActiveGoalCampaign | null,
  input: CommunityGoalConfigInput,
  now: Date
): ActiveGoalCampaign => {
  if (
    !current ||
    current.id !== input.campaignId ||
    !input.updatedAt ||
    current.updatedAt.getTime() !== input.updatedAt.getTime()
  ) {
    throw new CommunityGoalConflictError();
  }
  if (current.endsAt <= now) {
    throw new CommunityGoalConflictError(
      "Este período terminou. Use a ação de renovação para preservar o histórico."
    );
  }
  return current;
};

const createPublishedGoal = (
  transaction: Prisma.TransactionClient,
  input: CommunityGoalConfigInput,
  createdByMemberId: string,
  now: Date
) =>
  transaction.studyCampaign.create({
    data: {
      createdByMemberId,
      title: input.title.trim(),
      targetMinutes: input.targetMinutes,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      renewalMode: input.renewalMode,
      publishedAt: now,
    },
    select: campaignSelect,
  });

const snapshotChangedGoalPeriod = async (
  transaction: Prisma.TransactionClient,
  current: ActiveGoalCampaign,
  input: CommunityGoalConfigInput
) => {
  const periodChanged =
    current.startsAt.getTime() !== input.startsAt.getTime() ||
    current.endsAt.getTime() !== input.endsAt.getTime();
  if (!periodChanged) {
    return;
  }
  const [progress] = await queryPeriodProgress(transaction, [
    { startsAt: current.startsAt, endsAt: current.endsAt },
  ]);
  if (progress) {
    await snapshotPeriod(
      transaction,
      current,
      { startsAt: current.startsAt, endsAt: current.endsAt },
      progress
    );
  }
};

const updatePublishedGoal = async (
  transaction: Prisma.TransactionClient,
  current: ActiveGoalCampaign,
  input: CommunityGoalConfigInput
) => {
  await snapshotChangedGoalPeriod(transaction, current, input);
  const updated = await transaction.studyCampaign.updateMany({
    where: { id: current.id, updatedAt: current.updatedAt },
    data: {
      title: input.title.trim(),
      targetMinutes: input.targetMinutes,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      renewalMode: input.renewalMode,
    },
  });
  if (updated.count !== 1) {
    throw new CommunityGoalConflictError();
  }
  return transaction.studyCampaign.findUniqueOrThrow({
    where: { id: current.id },
    select: campaignSelect,
  });
};

export const saveCommunityGoal = async (
  input: CommunityGoalConfigInput,
  createdByMemberId: string,
  now = new Date()
) => {
  validateCommunityGoalConfig(input);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await database.$transaction(
        async (transaction) => {
          await acquireCampaignLock(transaction);
          const current = await findActiveCampaign(transaction);
          if (!input.campaignId) {
            assertNoPublishedGoal(current);
            return createPublishedGoal(
              transaction,
              input,
              createdByMemberId,
              now
            );
          }
          const editableGoal = assertPublishedGoalIsCurrent(
            current,
            input,
            now
          );
          return updatePublishedGoal(transaction, editableGoal, input);
        },
        { isolationLevel: "Serializable" }
      );
    } catch (error) {
      if (error instanceof CommunityGoalConflictError) {
        throw error;
      }
      if (!isRetryableTransactionError(error) || attempt === 2) {
        throw error;
      }
    }
  }
  throw new CommunityGoalConflictError();
};

export const renewCommunityGoalManually = async (
  input: {
    readonly campaignId: string;
    readonly endsAt: Date;
    readonly startsAt: Date;
    readonly updatedAt: Date;
  },
  now = new Date()
) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await database.$transaction(
        async (transaction) => {
          await acquireCampaignLock(transaction);
          const campaign = await transaction.studyCampaign.findFirst({
            where: {
              id: input.campaignId,
              publishedAt: { not: null },
              archivedAt: null,
            },
            select: campaignSelect,
          });
          if (
            !campaign ||
            campaign.renewalMode !== StudyCampaignRenewalMode.MANUAL ||
            campaign.endsAt > now ||
            campaign.updatedAt.getTime() !== input.updatedAt.getTime() ||
            input.startsAt < campaign.endsAt
          ) {
            throw new CommunityGoalConflictError(
              "O período mudou ou ainda não terminou. Atualize a página antes de renovar."
            );
          }
          validateCommunityGoalConfig({
            title: campaign.title,
            targetMinutes: campaign.targetMinutes,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
          });

          const [progress] = await queryPeriodProgress(transaction, [
            { startsAt: campaign.startsAt, endsAt: campaign.endsAt },
          ]);
          if (progress) {
            await snapshotPeriod(
              transaction,
              campaign,
              { startsAt: campaign.startsAt, endsAt: campaign.endsAt },
              progress
            );
          }

          const updated = await transaction.studyCampaign.updateMany({
            where: { id: campaign.id, updatedAt: campaign.updatedAt },
            data: { startsAt: input.startsAt, endsAt: input.endsAt },
          });
          if (updated.count !== 1) {
            throw new CommunityGoalConflictError();
          }
          return transaction.studyCampaign.findUniqueOrThrow({
            where: { id: campaign.id },
            select: campaignSelect,
          });
        },
        { isolationLevel: "Serializable" }
      );
    } catch (error) {
      if (error instanceof CommunityGoalConflictError) {
        throw error;
      }
      if (!isRetryableTransactionError(error) || attempt === 2) {
        throw error;
      }
    }
  }
  throw new CommunityGoalConflictError();
};

export const createStudyCampaignSafely = async (
  input: {
    readonly createdByMemberId: string;
    readonly description: string | null;
    readonly endsAt: Date;
    readonly published: boolean;
    readonly renewalMode: StudyCampaignRenewalMode;
    readonly startsAt: Date;
    readonly targetMinutes: number;
    readonly title: string;
  },
  now = new Date()
) => {
  validateCommunityGoalConfig(input);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await database.$transaction(
        async (transaction) => {
          await acquireCampaignLock(transaction);
          if (input.published && (await findActiveCampaign(transaction))) {
            throw new CommunityGoalConflictError(
              "Já existe uma meta coletiva publicada. Edite ou retire a meta atual antes de publicar outra."
            );
          }
          return transaction.studyCampaign.create({
            data: {
              createdByMemberId: input.createdByMemberId,
              title: input.title.trim(),
              description: input.description,
              targetMinutes: input.targetMinutes,
              startsAt: input.startsAt,
              endsAt: input.endsAt,
              renewalMode: input.renewalMode,
              publishedAt: input.published ? now : null,
            },
            select: { id: true },
          });
        },
        { isolationLevel: "Serializable" }
      );
    } catch (error) {
      if (error instanceof CommunityGoalConflictError) {
        throw error;
      }
      if (!isRetryableTransactionError(error) || attempt === 2) {
        throw error;
      }
    }
  }
  throw new CommunityGoalConflictError();
};

export const setStudyCampaignPublicationSafely = async (
  campaignId: string,
  published: boolean,
  now = new Date()
) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await database.$transaction(
        async (transaction) => {
          await acquireCampaignLock(transaction);
          const current = await transaction.studyCampaign.findFirst({
            where: { id: campaignId, archivedAt: null },
            select: { id: true },
          });
          if (!current) {
            return false;
          }
          if (
            published &&
            (await transaction.studyCampaign.findFirst({
              where: {
                id: { not: campaignId },
                publishedAt: { not: null },
                archivedAt: null,
              },
              select: { id: true },
            }))
          ) {
            throw new CommunityGoalConflictError(
              "Já existe uma meta coletiva publicada. Retire-a antes de publicar outra."
            );
          }
          const updated = await transaction.studyCampaign.updateMany({
            where: { id: campaignId, archivedAt: null },
            data: { publishedAt: published ? now : null },
          });
          return updated.count === 1;
        },
        { isolationLevel: "Serializable" }
      );
    } catch (error) {
      if (error instanceof CommunityGoalConflictError) {
        throw error;
      }
      if (!isRetryableTransactionError(error) || attempt === 2) {
        throw error;
      }
    }
  }
  throw new CommunityGoalConflictError();
};
