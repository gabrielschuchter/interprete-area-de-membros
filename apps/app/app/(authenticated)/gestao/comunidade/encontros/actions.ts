"use server";

import {
  BadgeCriterion,
  ContentStatus,
  database,
  MeetingKind,
  Prisma,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { evaluateMemberBadges } from "@/lib/badges";
import { recordAuditEvent } from "@/lib/gestao-audit";
import {
  type GestaoActor,
  requireGestaoAction,
} from "@/lib/gestao-authorization";
import { notifyGestaoMeetingPublished } from "@/lib/gestao-meeting-notifications";
import { getGestaoMeetingCohorts } from "@/lib/gestao-meetings";
import {
  type GestaoMeetingRecurrence,
  gestaoMeetingDateTime,
  gestaoMeetingJoinUrl,
  gestaoMeetingRecording,
  gestaoMeetingTimezoneIsValid,
} from "@/lib/gestao-meetings-domain";
import { getLearningAssignmentRecipientScope } from "@/lib/learning-assignment-scope";
import { resolveMeetingAttendance } from "@/lib/meeting-attendance";
import { readIdempotencyKey } from "@/lib/mutation-contract";
import {
  consumeMutationRateLimit,
  isUniqueConstraintError,
} from "@/lib/mutation-reliability";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";

export interface GestaoMeetingFormState {
  readonly error: string | null;
}

const listPath = "/gestao/comunidade/encontros";
const maxPeople = 200;
const recurrences = new Set(["DAILY", "MONTHLY", "NONE", "WEEKLY"]);

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const list = (formData: FormData, key: string) => [
  ...new Set(
    formData
      .getAll(key)
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean)
  ),
];

const revalidateMeetings = (meetingId?: string) => {
  revalidatePath(listPath);
  revalidatePath("/encontros");
  revalidatePath("/planejamento");
  revalidatePath("/gestao/alunos/turmas", "layout");
  if (meetingId) {
    revalidatePath(`/encontros/${meetingId}`);
  }
};

interface MeetingFields {
  readonly courseId: string | null;
  readonly description: string | null;
  readonly endsAt: Date | null;
  readonly joinUrl: string;
  readonly kind: MeetingKind;
  readonly recordingUrl: string | null;
  readonly recurrenceRule: GestaoMeetingRecurrence | null;
  readonly recurrenceUntil: Date | null;
  readonly relatedActivityId: string | null;
  readonly relatedLibraryItemId: string | null;
  readonly startsAt: Date;
  readonly timezone: string;
  readonly title: string;
}

const readKind = (value: string) =>
  Object.values(MeetingKind).find((kind) => kind === value) ??
  MeetingKind.OTHER;

interface Schedule {
  readonly endsAt: Date | null;
  readonly recurrenceRule: GestaoMeetingRecurrence | null;
  readonly recurrenceUntil: Date | null;
  readonly startsAt: Date;
}

const readSchedule = (
  formData: FormData,
  timezone: string
): { readonly error: string } | Schedule => {
  const startsAt = gestaoMeetingDateTime(
    text(formData, "date"),
    text(formData, "start"),
    timezone
  );
  if (!startsAt) {
    return { error: "Informe a data e o horário de início." } as const;
  }
  const rawEnd = text(formData, "end");
  const endsAt = rawEnd
    ? gestaoMeetingDateTime(text(formData, "date"), rawEnd, timezone)
    : null;
  if (rawEnd && !endsAt) {
    return { error: "O horário de término não é válido." } as const;
  }
  if (endsAt && endsAt <= startsAt) {
    return { error: "O término precisa ser depois do início." } as const;
  }
  const recurrence = text(formData, "recurrence") || "NONE";
  if (!recurrences.has(recurrence)) {
    return { error: "Escolha uma repetição válida." } as const;
  }
  const rawUntil = text(formData, "until");
  const recurrenceUntil =
    recurrence !== "NONE" && rawUntil
      ? gestaoMeetingDateTime(rawUntil, "23:59", timezone)
      : null;
  if (recurrence !== "NONE" && rawUntil && !recurrenceUntil) {
    return { error: "A data final da repetição não é válida." } as const;
  }
  if (recurrenceUntil && recurrenceUntil < startsAt) {
    return {
      error: "A repetição precisa terminar depois do primeiro encontro.",
    } as const;
  }
  return {
    endsAt,
    recurrenceRule:
      recurrence === "NONE" ? null : (recurrence as GestaoMeetingRecurrence),
    recurrenceUntil,
    startsAt,
  } as const;
};

const readMeetingFields = (
  formData: FormData,
  intent: string
): { error: string } | MeetingFields => {
  const title = text(formData, "title").slice(0, 140);
  if (!title) {
    return { error: "Informe o título do encontro." };
  }
  const timezone = text(formData, "timezone") || "America/Sao_Paulo";
  if (!gestaoMeetingTimezoneIsValid(timezone)) {
    return { error: "Escolha um fuso horário válido." };
  }
  const schedule = readSchedule(formData, timezone);
  if ("error" in schedule) {
    return { error: schedule.error };
  }
  const rawJoin = text(formData, "joinUrl");
  const join = rawJoin ? gestaoMeetingJoinUrl(rawJoin) : null;
  if (join && !join.ok) {
    return { error: "O link da sala precisa começar com http:// ou https://." };
  }
  if (!join && intent !== "draft") {
    return { error: "Informe o link da sala para publicar o encontro." };
  }
  const recording = gestaoMeetingRecording(text(formData, "recordingUrl"));
  if (!recording.ok) {
    return { error: "A gravação precisa ser um link do YouTube." };
  }
  return {
    courseId: text(formData, "courseId") || null,
    description: text(formData, "description").slice(0, 4000) || null,
    joinUrl: join?.ok ? join.value : "",
    kind: readKind(text(formData, "kind")),
    recordingUrl: recording.value,
    relatedActivityId: text(formData, "relatedActivityId") || null,
    relatedLibraryItemId: text(formData, "relatedLibraryItemId") || null,
    timezone,
    title,
    ...schedule,
  };
};

const relationsExist = async (fields: MeetingFields) => {
  const [course, activity, item] = await Promise.all([
    fields.courseId
      ? database.course.count({ where: { id: fields.courseId } })
      : 1,
    fields.relatedActivityId
      ? database.activity.count({ where: { id: fields.relatedActivityId } })
      : 1,
    fields.relatedLibraryItemId
      ? database.libraryItem.count({
          where: { id: fields.relatedLibraryItemId },
        })
      : 1,
  ]);
  return Boolean(course && activity && item);
};

interface Participants {
  readonly cohortIds: readonly string[];
  readonly memberIds: readonly string[];
}

const resolveParticipants = async (
  actor: GestaoActor,
  formData: FormData
): Promise<{ error: string } | Participants> => {
  const requestedCohorts = list(formData, "cohortId");
  const allowed = new Set(
    (await getGestaoMeetingCohorts(actor)).map((cohort) => cohort.id)
  );
  const cohortIds = requestedCohorts.filter((id) => allowed.has(id));
  if (cohortIds.length !== requestedCohorts.length) {
    return { error: "Uma das turmas escolhidas não está no seu escopo." };
  }
  const requested = list(formData, "personId").slice(0, maxPeople);
  const members = requested.length
    ? await database.member.findMany({
        where: {
          AND: [
            { id: { in: requested } },
            getLearningAssignmentRecipientScope({
              role: actor.role === "ADMIN" ? "ADMIN" : "TEACHER",
              userId: actor.userId,
            }),
          ],
        },
        select: { id: true },
      })
    : [];
  if (members.length !== requested.length) {
    return { error: "Um dos alunos escolhidos não está no seu escopo." };
  }
  return { cohortIds, memberIds: members.map(({ id }) => id) };
};

type Transaction = Prisma.TransactionClient;

const syncParticipants = async (
  tx: Transaction,
  meetingId: string,
  actor: GestaoActor,
  participants: Participants,
  scopeCohortIds: readonly string[]
) => {
  await tx.meetingParticipant.deleteMany({ where: { meetingId } });
  if (participants.memberIds.length > 0) {
    await tx.meetingParticipant.createMany({
      data: participants.memberIds.map((memberId) => ({ meetingId, memberId })),
      skipDuplicates: true,
    });
  }
  const now = new Date();
  // Turmas fora do escopo de quem edita continuam como estão.
  await tx.meetingCohortTarget.updateMany({
    where: {
      meetingId,
      revokedAt: null,
      cohortId: {
        in: scopeCohortIds.filter((id) => !participants.cohortIds.includes(id)),
      },
    },
    data: { revokedAt: now },
  });
  for (const cohortId of participants.cohortIds) {
    await tx.meetingCohortTarget.upsert({
      where: { meetingId_cohortId: { cohortId, meetingId } },
      create: {
        assignedAt: now,
        cohortId,
        createdByMemberId: actor.userId,
        meetingId,
      },
      update: { revokedAt: null },
    });
  }
};

interface PublicationPlan {
  readonly publishedAt: Date | null;
  readonly result: "agendado" | "publicado" | "rascunho" | "salvo";
  readonly status: ContentStatus;
}

const readPublishAt = (
  formData: FormData,
  timezone: string,
  now: Date
): { readonly error: string } | { readonly when: Date } => {
  const when = gestaoMeetingDateTime(
    text(formData, "publishDate"),
    text(formData, "publishTime"),
    timezone
  );
  if (!when) {
    return {
      error: "Escolha a data e a hora em que o encontro será publicado.",
    };
  }
  return when > now
    ? { when }
    : { error: "Para agendar, escolha uma data e hora no futuro." };
};

const planPublication = (
  formData: FormData,
  intent: string,
  existing: { publishedAt: Date | null; status: ContentStatus } | null,
  timezone: string,
  now: Date
): { error: string } | PublicationPlan => {
  if (intent === "save" && existing) {
    return {
      publishedAt: existing.publishedAt,
      result: "salvo",
      status: existing.status,
    };
  }
  if (intent !== "publish") {
    return {
      publishedAt: null,
      result: "rascunho",
      status: ContentStatus.DRAFT,
    };
  }
  if (text(formData, "when") === "schedule") {
    const read = readPublishAt(formData, timezone, now);
    return "error" in read
      ? { error: read.error }
      : {
          publishedAt: read.when,
          result: "agendado",
          status: ContentStatus.DRAFT,
        };
  }
  return {
    publishedAt:
      existing?.status === ContentStatus.PUBLISHED
        ? (existing.publishedAt ?? now)
        : now,
    result: "publicado",
    status: ContentStatus.PUBLISHED,
  };
};

interface PersistInput {
  readonly actor: GestaoActor;
  readonly existingId: string | null;
  readonly fields: MeetingFields;
  readonly idempotencyKey: string | null;
  readonly participants: Participants;
  readonly plan: PublicationPlan;
  readonly scopeCohortIds: readonly string[];
}

const persistMeeting = async (input: PersistInput) => {
  const { actor, existingId, fields, idempotencyKey, plan } = input;
  const data = {
    ...fields,
    publishedAt: plan.publishedAt,
    status: plan.status,
  };
  return await database.$transaction(async (tx) => {
    const saved = existingId
      ? await tx.meeting.update({
          where: { id: existingId },
          data,
          select: { id: true },
        })
      : await tx.meeting.create({
          data: { ...data, idempotencyKey, teacherId: actor.userId },
          select: { id: true },
        });
    await syncParticipants(
      tx,
      saved.id,
      actor,
      input.participants,
      input.scopeCohortIds
    );
    return saved;
  });
};

const failure = (error: string): GestaoMeetingFormState => ({ error });

export const saveGestaoMeeting = async (
  _previous: GestaoMeetingFormState,
  formData: FormData
): Promise<GestaoMeetingFormState> => {
  const { actor } = await requireGestaoAction("community.moderate");
  const id = text(formData, "id");
  const intent = text(formData, "intent");
  const existing = id
    ? await database.meeting.findFirst({
        where: { id, demoKey: null },
        select: { publishedAt: true, status: true },
      })
    : null;
  if (id && !existing) {
    return failure("Este encontro não existe mais.");
  }
  const fields = readMeetingFields(formData, intent);
  if ("error" in fields) {
    return failure(fields.error);
  }
  const now = new Date();
  const plan = planPublication(
    formData,
    intent,
    existing,
    fields.timezone,
    now
  );
  if ("error" in plan) {
    return failure(plan.error);
  }
  const participants = await resolveParticipants(actor, formData);
  if ("error" in participants) {
    return failure(participants.error);
  }
  if (!(await relationsExist(fields))) {
    return failure("Curso, atividade ou leitura relacionada não existe mais.");
  }
  await consumeMutationRateLimit({
    action: "meeting.mutation",
    memberId: actor.userId,
  });

  const idempotencyKey = existing
    ? null
    : readIdempotencyKey(formData.get("idempotencyKey"));
  const scopeCohortIds = (await getGestaoMeetingCohorts(actor)).map(
    (cohort) => cohort.id
  );
  let savedId: string;
  try {
    savedId = (
      await persistMeeting({
        actor,
        existingId: existing ? id : null,
        fields,
        idempotencyKey,
        participants,
        plan,
        scopeCohortIds,
      })
    ).id;
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    // Envio repetido do mesmo formulário: o encontro já foi criado.
    revalidateMeetings();
    redirect(listPath);
  }
  await recordAuditEvent({
    actorId: actor.userId,
    aggregateId: savedId,
    aggregateType: "Meeting",
    eventType: existing ? "gestao.meeting.updated" : "gestao.meeting.created",
    payload: {
      cohorts: participants.cohortIds.length,
      people: participants.memberIds.length,
      status: plan.status,
      title: fields.title,
    },
  });
  if (
    plan.status === ContentStatus.PUBLISHED &&
    existing?.status !== ContentStatus.PUBLISHED
  ) {
    await notifyGestaoMeetingPublished(savedId, actor.userId);
  }
  revalidateMeetings(savedId);
  redirect(`${listPath}?resultado=${plan.result}`);
};

type MeetingOperation = "archive" | "publish" | "reopen";

const operationAudit = {
  archive: "gestao.meeting.archived",
  publish: "gestao.meeting.published",
  reopen: "gestao.meeting.reopened",
} as const satisfies Record<MeetingOperation, string>;

const readOperation = (value: string): MeetingOperation | null =>
  Object.keys(operationAudit).find(
    (operation) => operation === value
  ) as MeetingOperation | null;

const planOperation = (
  operation: MeetingOperation,
  meeting: { joinUrl: string; status: ContentStatus },
  now: Date
) => {
  if (operation === "publish") {
    return meeting.status === ContentStatus.DRAFT && meeting.joinUrl
      ? { publishedAt: now, status: ContentStatus.PUBLISHED }
      : null;
  }
  if (operation === "archive") {
    return meeting.status === ContentStatus.PUBLISHED
      ? { status: ContentStatus.ARCHIVED }
      : null;
  }
  return meeting.status === ContentStatus.ARCHIVED
    ? { publishedAt: null, status: ContentStatus.DRAFT }
    : null;
};

const runOperation = async (operation: MeetingOperation | null, id: string) => {
  const { actor } = await requireGestaoAction("community.moderate");
  if (!(id && operation)) {
    redirect(`${listPath}?resultado=invalido`);
  }
  await consumeMutationRateLimit({
    action: "meeting.mutation",
    memberId: actor.userId,
  });
  const meeting = await database.meeting.findFirst({
    where: { id, demoKey: null },
    select: { joinUrl: true, status: true, title: true },
  });
  const change = meeting ? planOperation(operation, meeting, new Date()) : null;
  if (!(meeting && change)) {
    redirect(`${listPath}?resultado=invalido`);
  }
  await database.meeting.update({ where: { id }, data: change });
  await recordAuditEvent({
    actorId: actor.userId,
    aggregateId: id,
    aggregateType: "Meeting",
    eventType: operationAudit[operation],
    payload: { title: meeting.title },
  });
  if (operation === "publish") {
    await notifyGestaoMeetingPublished(id, actor.userId);
  }
  revalidateMeetings(id);
  redirect(`${listPath}?resultado=${operation}`);
};

export const setGestaoMeetingState = async (formData: FormData) =>
  await runOperation(
    readOperation(text(formData, "operation")),
    text(formData, "id")
  );

/** Botões dentro do editor: o envio do botão não leva a operação, então há uma ação por operação. */
export const archiveGestaoMeeting = async (formData: FormData) =>
  await runOperation("archive", text(formData, "id"));

export const reopenGestaoMeeting = async (formData: FormData) =>
  await runOperation("reopen", text(formData, "id"));

export interface GestaoAttendanceState {
  readonly error: string | null;
  readonly saved: boolean;
}

const attendanceTransaction = async (
  tx: Transaction,
  meetingId: string,
  actor: GestaoActor,
  selected: readonly string[],
  now: Date
) => {
  const locked = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT "id" FROM "Meeting" WHERE "id" = ${meetingId} FOR UPDATE`
  );
  const meeting = locked.length
    ? await tx.meeting.findFirst({
        where: {
          id: meetingId,
          status: { in: [ContentStatus.PUBLISHED, ContentStatus.ARCHIVED] },
          startsAt: { lte: now },
        },
        select: {
          participants: { select: { memberId: true } },
          cohortTargets: {
            where: { revokedAt: null },
            select: { cohortId: true },
          },
        },
      })
    : null;
  if (!meeting) {
    return "Registre a presença depois que o encontro publicado começar.";
  }
  const memberships = await tx.cohortMembership.findMany({
    where: {
      cohortId: { in: meeting.cohortTargets.map((t) => t.cohortId) },
      status: "ACTIVE",
      leftAt: null,
      member: { is: { role: "MEMBER", deactivatedAt: null } },
    },
    select: { memberId: true },
  });
  const eligible = [
    ...new Set([
      ...meeting.participants.map((entry) => entry.memberId),
      ...memberships.map((entry) => entry.memberId),
    ]),
  ];
  const attendance = resolveMeetingAttendance(selected, eligible);
  if (!attendance || attendance.length === 0) {
    return "A lista de presença não confere com os participantes.";
  }
  for (const entry of attendance) {
    const values = {
      isPresent: entry.isPresent,
      markedAt: now,
      markedByMemberId: actor.userId,
    };
    await tx.meetingAttendance.upsert({
      where: { meetingId_memberId: { meetingId, memberId: entry.memberId } },
      create: { meetingId, memberId: entry.memberId, ...values },
      update: values,
    });
    if (entry.isPresent) {
      await evaluateMemberBadges(tx, entry.memberId, now, {
        criteria: [BadgeCriterion.MEETINGS_ATTENDED],
        force: true,
      });
    }
  }
  return null;
};

export const saveGestaoMeetingAttendance = async (
  _previous: GestaoAttendanceState,
  formData: FormData
): Promise<GestaoAttendanceState> => {
  const { actor } = await requireGestaoAction("community.moderate");
  const meetingId = text(formData, "meetingId");
  const selected = list(formData, "attendeeId").slice(0, 500);
  if (!meetingId) {
    return { error: "Encontro não informado.", saved: false };
  }
  await consumeMutationRateLimit({
    action: "meeting.mutation",
    memberId: actor.userId,
  });
  const now = new Date();
  const problem = await database.$transaction((tx) =>
    attendanceTransaction(tx, meetingId, actor, selected, now)
  );
  if (problem) {
    return { error: problem, saved: false };
  }
  await recordAuditEvent({
    actorId: actor.userId,
    aggregateId: meetingId,
    aggregateType: "Meeting",
    eventType: "gestao.meeting.attendance_saved",
    payload: { present: selected.length },
  });
  if (selected.length > 0) {
    await dispatchPendingNotifications();
  }
  revalidateMeetings(meetingId);
  revalidatePath("/perfil");
  return { error: null, saved: true };
};
