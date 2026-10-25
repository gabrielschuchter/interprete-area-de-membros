import "server-only";
import {
  ContentStatus,
  CourseExperience,
  database,
  LearningAssignmentStatus,
  LearningAssignmentTargetType,
  type Prisma,
} from "@repo/database";
import {
  type AssignmentTab,
  assignmentState,
  type GestaoAssignmentRow,
  matchesAssignmentDue,
  parseAssignmentDue,
  parseAssignmentTab,
  parseAssignmentType,
} from "./gestao-assignments-domain";
import type { GestaoActor } from "./gestao-authorization";
import { getGestaoCorrectionCohortScope } from "./gestao-correction-scope";
import { resolveLearningAssignmentTargets } from "./learning-assignments";

const pageSize = 20;
const batchWindow = 300;

const created = "gestao.assignment.created";

const readStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const readCohorts = (payload: Prisma.JsonValue) => {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return [];
  }
  return readStringArray(payload.cohortNames);
};

const countsByBatch = (
  grouped: readonly {
    readonly _count: { readonly _all: number };
    readonly batchId: string | null;
    readonly status: LearningAssignmentStatus;
  }[]
) => {
  const counts = new Map<
    string,
    { completed: number; live: number; total: number }
  >();
  for (const row of grouped) {
    if (!row.batchId) {
      continue;
    }
    const entry = counts.get(row.batchId) ?? {
      completed: 0,
      live: 0,
      total: 0,
    };
    entry.total += row._count._all;
    if (row.status !== LearningAssignmentStatus.REVOKED) {
      entry.live += row._count._all;
    }
    if (row.status === LearningAssignmentStatus.COMPLETED) {
      entry.completed += row._count._all;
    }
    counts.set(row.batchId, entry);
  }
  return counts;
};

const recipientLabel = (input: {
  readonly audienceSpace: string | null;
  readonly audienceType: string;
  readonly cohortNames: readonly string[];
  readonly firstName: string | null;
  readonly total: number;
}) => {
  if (input.audienceType === "ALL_MEMBERS") {
    return "Todos os alunos";
  }
  if (input.audienceSpace) {
    return `${input.audienceSpace} · ${input.total}`;
  }
  if (input.cohortNames.length > 0) {
    const [first, ...rest] = input.cohortNames;
    return `${first}${rest.length > 0 ? ` +${rest.length}` : ""} · ${input.total}`;
  }
  if (input.total === 1 && input.firstName) {
    return input.firstName;
  }
  return `${input.total} ${input.total === 1 ? "aluno" : "alunos"}`;
};

export interface GestaoAssignmentQuery {
  readonly due?: string;
  readonly page?: string;
  readonly query?: string;
  readonly tab?: string;
  readonly type?: string;
}

const matchesQuery = (row: GestaoAssignmentRow, query: string) =>
  !query ||
  row.title.toLowerCase().includes(query) ||
  row.recipients.toLowerCase().includes(query) ||
  row.recipientNames.some((name) => name.toLowerCase().includes(query));

export const getGestaoAssignmentList = async (
  actor: GestaoActor,
  input: GestaoAssignmentQuery
) => {
  const tab = parseAssignmentTab(input.tab);
  const type = parseAssignmentType(input.type);
  const due = parseAssignmentDue(input.due);
  const query = (input.query ?? "").trim().slice(0, 120).toLowerCase();
  const now = new Date();
  const batches = await database.learningAssignmentBatch.findMany({
    where: actor.role === "ADMIN" ? {} : { createdByMemberId: actor.userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: batchWindow,
    select: {
      id: true,
      targetId: true,
      targetType: true,
      audienceType: true,
      audienceSpace: { select: { title: true } },
      availableAt: true,
      dueAt: true,
      expiresAt: true,
      createdAt: true,
      message: true,
    },
  });
  const ids = batches.map((batch) => batch.id);
  const [targets, grouped, events] = await Promise.all([
    resolveLearningAssignmentTargets(
      database,
      batches.map((batch) => ({ id: batch.targetId, type: batch.targetType }))
    ),
    database.activityAssignment.groupBy({
      by: ["batchId", "status"],
      where: { batchId: { in: ids } },
      _count: { _all: true },
    }),
    database.domainEvent.findMany({
      where: { eventType: created, aggregateId: { in: ids } },
      select: { aggregateId: true, payload: true },
    }),
  ]);
  const counts = countsByBatch(grouped);
  const cohortsByBatch = new Map(
    events.map((event) => [event.aggregateId, readCohorts(event.payload)])
  );
  const people = await database.activityAssignment.findMany({
    where: { batchId: { in: ids } },
    select: { batchId: true, member: { select: { displayName: true } } },
    orderBy: { assignedAt: "asc" },
    take: 4000,
  });
  const namesByBatch = new Map<string, string[]>();
  for (const person of people) {
    if (person.batchId && person.member.displayName) {
      const names = namesByBatch.get(person.batchId) ?? [];
      names.push(person.member.displayName);
      namesByBatch.set(person.batchId, names);
    }
  }

  const rows: GestaoAssignmentRow[] = batches.map((batch) => {
    const count = counts.get(batch.id) ?? { completed: 0, live: 0, total: 0 };
    const names = namesByBatch.get(batch.id) ?? [];
    const target = targets.get(`${batch.targetType}:${batch.targetId}`);
    return {
      id: batch.id,
      targetHref: target?.href ?? null,
      title: target?.title ?? "Conteúdo indisponível",
      type: batch.targetType,
      message: batch.message,
      createdAt: batch.createdAt,
      availableAt: batch.availableAt,
      dueAt: batch.dueAt,
      expiresAt: batch.expiresAt,
      completed: count.completed,
      live: count.live,
      total: count.total,
      recipientNames: names,
      recipients: recipientLabel({
        audienceSpace: batch.audienceSpace?.title ?? null,
        audienceType: batch.audienceType,
        cohortNames: cohortsByBatch.get(batch.id) ?? [],
        firstName: names[0] ?? null,
        total: count.total,
      }),
      state: assignmentState(
        {
          availableAt: batch.availableAt,
          dueAt: batch.dueAt,
          expiresAt: batch.expiresAt,
          live: count.live,
          completed: count.completed,
        },
        now
      ),
    };
  });
  const tabCounts: Record<AssignmentTab, number> = {
    active: 0,
    closed: 0,
    scheduled: 0,
  };
  for (const row of rows) {
    tabCounts[row.state.tab] += 1;
  }
  const filtered = rows.filter(
    (row) =>
      row.state.tab === tab &&
      (!type || row.type === type) &&
      matchesAssignmentDue(row, due) &&
      matchesQuery(row, query)
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(
    pageCount,
    Math.max(1, Math.trunc(Number(input.page) || 1))
  );
  return {
    due,
    page,
    pageCount,
    pageSize,
    query,
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    tab,
    tabCounts,
    total: filtered.length,
    type,
  };
};

export interface AssignmentContentOption {
  readonly id: string;
  readonly label: string;
  readonly meta: string;
  readonly type: LearningAssignmentTargetType;
}

export interface AssignmentCohortOption {
  readonly id: string;
  readonly name: string;
  readonly students: number;
}

export const getGestaoAssignmentOptions = async (actor: GestaoActor) => {
  const published = { status: ContentStatus.PUBLISHED };
  const [activities, courses, lessons, libraryItems, exerciseLists, cohorts] =
    await Promise.all([
      database.activity.findMany({
        where: published,
        orderBy: { title: "asc" },
        select: { id: true, title: true },
        take: 250,
      }),
      database.course.findMany({
        where: { ...published, experience: CourseExperience.ASYNC },
        orderBy: { title: "asc" },
        select: { id: true, title: true },
        take: 250,
      }),
      database.lesson.findMany({
        where: {
          ...published,
          module: {
            is: { ...published, course: { is: published } },
          },
        },
        orderBy: { title: "asc" },
        select: {
          id: true,
          title: true,
          module: { select: { course: { select: { title: true } } } },
        },
        take: 600,
      }),
      database.libraryItem.findMany({
        where: published,
        orderBy: { title: "asc" },
        select: { id: true, title: true },
        take: 400,
      }),
      database.exerciseList.findMany({
        where: { ...published, bank: { is: published } },
        orderBy: { title: "asc" },
        select: { id: true, title: true },
        take: 400,
      }),
      database.cohort.findMany({
        where: getGestaoCorrectionCohortScope(actor),
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: 200,
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              memberships: {
                where: {
                  status: "ACTIVE",
                  leftAt: null,
                  member: { is: { role: "MEMBER", deactivatedAt: null } },
                },
              },
            },
          },
        },
      }),
    ]);
  const content: AssignmentContentOption[] = [
    ...activities.map((item) => ({
      id: item.id,
      label: item.title,
      meta: "Atividade",
      type: LearningAssignmentTargetType.ACTIVITY,
    })),
    ...courses.map((item) => ({
      id: item.id,
      label: item.title,
      meta: "Curso",
      type: LearningAssignmentTargetType.COURSE,
    })),
    ...lessons.map((item) => ({
      id: item.id,
      label: item.title,
      meta: `Aula · ${item.module.course.title}`,
      type: LearningAssignmentTargetType.LESSON,
    })),
    ...libraryItems.map((item) => ({
      id: item.id,
      label: item.title,
      meta: "Material da biblioteca",
      type: LearningAssignmentTargetType.LIBRARY_ITEM,
    })),
    ...exerciseLists.map((item) => ({
      id: item.id,
      label: item.title,
      meta: "Lista de exercícios",
      type: LearningAssignmentTargetType.EXERCISE_LIST,
    })),
  ];
  return {
    cohorts: cohorts.map(
      (cohort): AssignmentCohortOption => ({
        id: cohort.id,
        name: cohort.name,
        students: cohort._count.memberships,
      })
    ),
    content,
  };
};

/** Alunos ativos das turmas escolhidas, dentro do escopo de quem atribui. */
export const resolveCohortStudents = async (
  actor: GestaoActor,
  cohortIds: readonly string[]
) => {
  if (cohortIds.length === 0) {
    return { cohorts: [], memberIds: [] as string[] };
  }
  const cohorts = await database.cohort.findMany({
    where: {
      AND: [
        getGestaoCorrectionCohortScope(actor),
        { id: { in: [...cohortIds] } },
      ],
    },
    select: {
      id: true,
      name: true,
      memberships: {
        where: {
          status: "ACTIVE",
          leftAt: null,
          member: { is: { role: "MEMBER", deactivatedAt: null } },
        },
        select: { memberId: true },
      },
    },
  });
  return {
    cohorts: cohorts.map((cohort) => ({ id: cohort.id, name: cohort.name })),
    memberIds: [
      ...new Set(
        cohorts.flatMap((cohort) =>
          cohort.memberships.map(({ memberId }) => memberId)
        )
      ),
    ],
  };
};
