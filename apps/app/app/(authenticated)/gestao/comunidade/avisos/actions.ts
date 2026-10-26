"use server";

import { AnnouncementAudience, ContentStatus, database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { queueAnnouncementNotifications } from "@/lib/announcement-notification-outbox";
import { resolveCohortStudents } from "@/lib/gestao-assignments";
import { recordAuditEvent } from "@/lib/gestao-audit";
import {
  type GestaoActor,
  requireGestaoAction,
} from "@/lib/gestao-authorization";
import { cohortNoticeCreated } from "@/lib/gestao-cohort-notices";
import { noticeAudienceEvent } from "@/lib/gestao-notices";
import {
  gestaoNoticeEndOfDay,
  gestaoNoticeHref,
  gestaoNoticeStartOfDay,
} from "@/lib/gestao-notices-domain";
import { getLearningAssignmentRecipientScope } from "@/lib/learning-assignment-scope";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";
import { dispatchPendingNotifications } from "@/lib/notification-outbox-dispatch";

export interface GestaoNoticeFormState {
  readonly error: string | null;
}

const listPath = "/gestao/comunidade/avisos";
const bodyLimit = 4000;
const maxPeople = 200;

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

const revalidateNotices = () => {
  revalidatePath(listPath);
  revalidatePath("/comunidade");
  revalidatePath("/notificacoes");
};

type ResolvedAudience =
  | {
      readonly audience: AnnouncementAudience;
      readonly cohortIds: readonly string[];
      readonly ok: true;
      readonly recipientIds: readonly string[];
    }
  | { readonly error: string; readonly ok: false };

const resolveAudience = async (
  actor: GestaoActor,
  formData: FormData
): Promise<ResolvedAudience> => {
  const mode = text(formData, "mode");
  if (mode === "all") {
    return {
      audience: AnnouncementAudience.ALL,
      cohortIds: [],
      ok: true,
      recipientIds: [],
    };
  }
  if (mode === "staff") {
    return {
      audience: AnnouncementAudience.STAFF,
      cohortIds: [],
      ok: true,
      recipientIds: [],
    };
  }
  if (mode === "cohorts") {
    const requested = list(formData, "cohortId");
    const resolved = await resolveCohortStudents(actor, requested);
    if (requested.length === 0 || resolved.cohorts.length === 0) {
      return { error: "Escolha ao menos uma turma.", ok: false };
    }
    if (resolved.memberIds.length === 0) {
      return {
        error: "As turmas escolhidas ainda não têm alunos ativos.",
        ok: false,
      };
    }
    return {
      audience: AnnouncementAudience.SELECTED,
      cohortIds: resolved.cohorts.map((cohort) => cohort.id),
      ok: true,
      recipientIds: resolved.memberIds,
    };
  }
  if (mode === "people") {
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
    if (members.length === 0) {
      return { error: "Escolha ao menos uma pessoa.", ok: false };
    }
    return {
      audience: AnnouncementAudience.SELECTED,
      cohortIds: [],
      ok: true,
      recipientIds: members.map(({ id }) => id),
    };
  }
  return { error: "Escolha quem vai ver o aviso.", ok: false };
};

/** Enfileira as notificações pelo mesmo caminho do restante da Comunidade. */
const dispatchNotice = async (id: string, actorId: string) => {
  await database.$transaction(async (transaction) => {
    const announcement = await transaction.announcement.findUniqueOrThrow({
      where: { id },
    });
    await queueAnnouncementNotifications(
      transaction,
      announcement,
      [],
      actorId
    );
  });
  await dispatchPendingNotifications();
};

const startsNow = (startsAt: Date | null, now: Date) =>
  !startsAt || startsAt <= now;

interface ParsedPeriod {
  readonly endsAt: Date | null;
  readonly startsAt: Date | null;
}

const readPeriod = (
  formData: FormData,
  now: Date,
  lenient: boolean
): { error: string } | ParsedPeriod => {
  const scheduling = text(formData, "when") === "schedule";
  const rawStart = text(formData, "startsAt");
  const rawEnd = text(formData, "endsAt");
  let startsAt: Date | null = null;
  if (scheduling) {
    startsAt = rawStart ? gestaoNoticeStartOfDay(rawStart) : null;
    if (!startsAt) {
      return { error: "Escolha a data em que o aviso começa a aparecer." };
    }
    if (startsAt <= now && !lenient) {
      return { error: "Para agendar, escolha uma data a partir de amanhã." };
    }
  }
  const endsAt = rawEnd ? gestaoNoticeEndOfDay(rawEnd) : null;
  if (rawEnd && !endsAt) {
    return { error: "A data final não é válida." };
  }
  if (endsAt && endsAt <= (startsAt ?? (lenient ? new Date(0) : now))) {
    return { error: "A data final precisa ser depois do início." };
  }
  return { endsAt, startsAt };
};

interface NoticeDraft {
  readonly body: string;
  readonly href: string | null;
  readonly id: string;
  readonly intent: string;
  readonly isPinned: boolean;
  readonly period: ParsedPeriod;
  readonly title: string;
}

interface ExistingNotice {
  readonly audience: AnnouncementAudience;
  readonly publishedAt: Date | null;
  readonly recipientIds: string[];
  readonly startsAt: Date | null;
  readonly status: ContentStatus;
}

const readDraft = (
  formData: FormData,
  now: Date,
  existing: ExistingNotice | null
): { error: string } | NoticeDraft => {
  const title = text(formData, "title").slice(0, 180);
  const body = text(formData, "body").slice(0, bodyLimit);
  const href = gestaoNoticeHref(text(formData, "href"));
  if (!(title && body)) {
    return { error: "Escreva o título e a mensagem do aviso." };
  }
  if (!href.ok) {
    return {
      error:
        "O link precisa ser uma página da plataforma ou um endereço http(s).",
    };
  }
  const intent = text(formData, "intent");
  const read = readPeriod(formData, now, intent === "save");
  if ("error" in read) {
    return { error: read.error };
  }
  // Aviso que já começou mantém o início original quando não é reagendado.
  const keepsStart =
    existing && existing.status !== ContentStatus.DRAFT && !read.startsAt;
  return {
    body,
    href: href.value,
    id: text(formData, "id"),
    intent,
    isPinned: text(formData, "isPinned") === "on",
    period: keepsStart
      ? { endsAt: read.endsAt, startsAt: existing.startsAt }
      : read,
    title,
  };
};

const noticeStatus = (intent: string, existing: ExistingNotice | null) => {
  if (intent === "publish") {
    return ContentStatus.PUBLISHED;
  }
  return intent === "save" && existing ? existing.status : ContentStatus.DRAFT;
};

const noticeResult = (draft: NoticeDraft, existing: boolean, now: Date) => {
  if (draft.intent === "publish") {
    return startsNow(draft.period.startsAt, now) ? "publicado" : "agendado";
  }
  return existing ? "salvo" : "rascunho";
};

interface AuditedAudience {
  readonly audience: Extract<ResolvedAudience, { ok: true }>;
  readonly noticeId: string;
}

const recordNoticeAudience = async (
  actorId: string,
  { audience, noticeId }: AuditedAudience,
  title: string
) => {
  await recordAuditEvent({
    actorId,
    aggregateId: noticeId,
    aggregateType: "Announcement",
    eventType: noticeAudienceEvent,
    payload: {
      audience: audience.audience,
      cohortIds: [...audience.cohortIds],
      recipients: audience.recipientIds.length,
    },
  });
  // A aba Avisos de cada turma lista os avisos pelo registro desta turma.
  for (const cohortId of audience.cohortIds) {
    await recordAuditEvent({
      actorId,
      aggregateId: noticeId,
      aggregateType: "Announcement",
      eventType: cohortNoticeCreated,
      payload: { cohortId, recipients: audience.recipientIds.length, title },
    });
  }
};

interface PersistInput {
  readonly actorId: string;
  readonly audience: Extract<ResolvedAudience, { ok: true }>;
  readonly draft: NoticeDraft;
  readonly existing: ExistingNotice | null;
  readonly fields: {
    readonly body: string;
    readonly endsAt: Date | null;
    readonly href: string | null;
    readonly isPinned: boolean;
    readonly startsAt: Date | null;
    readonly status: ContentStatus;
    readonly title: string;
  };
  readonly id: string;
  readonly locked: boolean;
  readonly now: Date;
  readonly status: ContentStatus;
}

const writeNotice = async ({
  audience,
  existing,
  fields,
  id,
  locked,
  now,
  status,
  actorId,
}: PersistInput) => {
  const published = status === ContentStatus.PUBLISHED;
  if (existing && !locked) {
    await database.announcementCohort.deleteMany({
      where: { announcementId: id },
    });
  }
  if (!existing) {
    return await database.announcement.create({
      data: {
        ...fields,
        audience: audience.audience,
        createdByMemberId: actorId,
        publishedAt: published ? now : null,
        recipientIds: [...audience.recipientIds],
      },
      select: { id: true },
    });
  }
  return await database.announcement.update({
    where: { id },
    data: {
      ...fields,
      ...(locked
        ? {}
        : {
            audience: audience.audience,
            recipientIds: [...audience.recipientIds],
          }),
      archivedAt: status === ContentStatus.ARCHIVED ? now : null,
      publishedAt: published
        ? (existing.publishedAt ?? now)
        : existing.publishedAt,
    },
    select: { id: true },
  });
};

/** Grava o aviso, registra a auditoria e entrega as notificações devidas. */
const persistNotice = async (input: PersistInput) => {
  const { actorId, audience, draft, existing, locked, status } = input;
  const saved = await writeNotice(input);
  if (!locked) {
    await recordNoticeAudience(
      actorId,
      { audience, noticeId: saved.id },
      draft.title
    );
  }
  await recordAuditEvent({
    actorId,
    aggregateId: saved.id,
    aggregateType: "Announcement",
    eventType: existing ? "gestao.notice.updated" : "gestao.notice.created",
    payload: { status, title: draft.title },
  });
  if (existing?.status === ContentStatus.PUBLISHED) {
    await database.notification.updateMany({
      where: { groupKey: `announcement:${saved.id}` },
      data: {
        body: draft.body,
        href: draft.href ?? "/comunidade",
        title: draft.title,
      },
    });
  } else if (status === ContentStatus.PUBLISHED) {
    await dispatchNotice(saved.id, actorId);
  }
  return saved;
};

export const saveGestaoNotice = async (
  _previous: GestaoNoticeFormState,
  formData: FormData
): Promise<GestaoNoticeFormState> => {
  const { actor } = await requireGestaoAction("community.moderate");
  const id = text(formData, "id");
  const existing = id
    ? await database.announcement.findFirst({
        where: { id, deletedAt: null },
        select: {
          audience: true,
          publishedAt: true,
          recipientIds: true,
          startsAt: true,
          status: true,
        },
      })
    : null;
  if (id && !existing) {
    return { error: "Este aviso não existe mais." };
  }
  const now = new Date();
  const draft = readDraft(formData, now, existing);
  if ("error" in draft) {
    return { error: draft.error };
  }
  // Depois de publicado o público não muda: as notificações já saíram.
  const locked = Boolean(existing && existing.status !== ContentStatus.DRAFT);
  const audience: ResolvedAudience =
    locked && existing
      ? {
          audience: existing.audience,
          cohortIds: [],
          ok: true,
          recipientIds: existing.recipientIds,
        }
      : await resolveAudience(actor, formData);
  if (!audience.ok) {
    return { error: audience.error };
  }
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });

  const status = noticeStatus(draft.intent, existing);
  const fields = {
    body: draft.body,
    endsAt: draft.period.endsAt,
    href: draft.href,
    isPinned: draft.isPinned,
    startsAt: draft.period.startsAt,
    status,
    title: draft.title,
  };
  await persistNotice({
    actorId: actor.userId,
    audience,
    draft,
    existing,
    fields,
    id,
    locked,
    now,
    status,
  });
  revalidateNotices();
  redirect(
    `${listPath}?resultado=${noticeResult(draft, Boolean(existing), now)}`
  );
};

type NoticeOperation =
  | "delete"
  | "end"
  | "pin"
  | "publish"
  | "reopen"
  | "unpin";

const operationAudit = {
  delete: "gestao.notice.deleted",
  end: "gestao.notice.ended",
  pin: "gestao.notice.pin_changed",
  publish: "gestao.notice.published",
  reopen: "gestao.notice.reopened",
  unpin: "gestao.notice.pin_changed",
} as const satisfies Record<NoticeOperation, string>;

const readOperation = (value: string): NoticeOperation | null =>
  Object.keys(operationAudit).find(
    (operation) => operation === value
  ) as NoticeOperation | null;

interface NoticeSnapshot {
  readonly audience: AnnouncementAudience;
  readonly body: string;
  readonly endsAt: Date | null;
  readonly href: string | null;
  readonly publishedAt: Date | null;
  readonly recipientIds: string[];
  readonly startsAt: Date | null;
  readonly status: ContentStatus;
  readonly title: string;
}

/** Devolve a mudança no registro, ou null quando a operação não cabe no estado. */
const planOperation = (
  operation: NoticeOperation,
  notice: NoticeSnapshot,
  now: Date
) => {
  const live = notice.status === ContentStatus.PUBLISHED;
  switch (operation) {
    case "publish":
      return notice.status === ContentStatus.DRAFT &&
        !(notice.endsAt && notice.endsAt <= now)
        ? {
            archivedAt: null,
            publishedAt: notice.publishedAt ?? now,
            status: ContentStatus.PUBLISHED,
          }
        : null;
    case "end":
      // Aviso agendado ainda não começou: encerrar só arquiva, porque o fim
      // não pode vir antes do início (restrição do banco).
      return live
        ? {
            archivedAt: now,
            status: ContentStatus.ARCHIVED,
            ...(startsNow(notice.startsAt, now) ? { endsAt: now } : {}),
          }
        : null;
    case "reopen":
      return notice.status === ContentStatus.ARCHIVED
        ? { archivedAt: null, endsAt: null, status: ContentStatus.DRAFT }
        : null;
    case "pin":
    case "unpin":
      return { isPinned: operation === "pin" };
    case "delete":
      return {
        archivedAt: now,
        deletedAt: now,
        status: ContentStatus.ARCHIVED,
      };
    default:
      return null;
  }
};

export const setGestaoNoticeState = async (formData: FormData) => {
  const { actor } = await requireGestaoAction("community.moderate");
  const id = text(formData, "id");
  const operation = readOperation(text(formData, "operation"));
  if (!(id && operation)) {
    return;
  }
  const notice = await database.announcement.findFirst({
    where: { id, deletedAt: null },
    select: {
      audience: true,
      body: true,
      endsAt: true,
      href: true,
      publishedAt: true,
      recipientIds: true,
      startsAt: true,
      status: true,
      title: true,
    },
  });
  const now = new Date();
  const change = notice ? planOperation(operation, notice, now) : null;
  if (!(notice && change)) {
    return;
  }
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  await database.announcement.update({ where: { id }, data: change });
  if (operation === "publish") {
    await dispatchNotice(id, actor.userId);
  }
  await recordAuditEvent({
    actorId: actor.userId,
    aggregateId: id,
    aggregateType: "Announcement",
    eventType: operationAudit[operation],
    payload: { operation, title: notice.title },
  });
  revalidateNotices();
};
