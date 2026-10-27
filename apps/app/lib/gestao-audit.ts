import "server-only";
import { database, type Prisma } from "@repo/database";
import { requireGestaoAction } from "./gestao-authorization";
import { medalCriterionLabels } from "./gestao-medals-domain";

const medalCriteria: Readonly<Record<string, string>> = medalCriterionLabels;

const pageSize = 25;
const maxExportRows = 5000;

export const gestaoAuditLabels: Readonly<Record<string, string>> = {
  "gestao.member.role_changed": "Papel alterado",
  "gestao.member.data_erased": "Dados do membro apagados",
  "gestao.access.granted": "Acesso concedido",
  "gestao.access.revoked": "Acesso revogado",
  "gestao.cohort.created": "Turma criada",
  "gestao.cohort.updated": "Turma editada",
  "gestao.cohort.archived": "Turma arquivada",
  "gestao.cohort.duplicated": "Turma duplicada",
  "gestao.cohort.members_added": "Alunos adicionados à turma",
  "gestao.cohort.members_removed": "Alunos removidos da turma",
  "gestao.cohort.members_moved": "Alunos movidos de turma",
  "gestao.cohort.members_imported": "Alunos importados por planilha",
  "gestao.cohort.invite_created": "Convite da turma criado",
  "gestao.cohort.invite_accepted": "Convite da turma aceito",
  "gestao.cohort.invite_revoked": "Convite da turma revogado",
  "gestao.cohort.event.published": "Evento da turma publicado",
  "gestao.cohort.event.saved": "Evento da turma salvo",
  "gestao.cohort.event.status_changed": "Situação do evento da turma alterada",
  "event.published": "Encontro publicado",
  "gestao.cohort.meeting.saved": "Encontro da turma salvo",
  "gestao.cohort.meeting.updated": "Encontro da turma editado",
  "gestao.cohort.calendar.copied": "Calendário copiado",
  "gestao.cohort.calendar.occurrence.changed": "Ocorrência alterada",
  "gestao.course.open_access.changed": "Acesso aberto do curso alterado",
  "gestao.course.cohort_access.changed": "Acesso do curso por turma alterado",
  "gestao.course.direct_access.granted": "Acesso direto ao curso concedido",
  "gestao.course.direct_access.revoked": "Acesso direto ao curso revogado",
  "gestao.course.status_changed": "Situação do curso alterada",
  "gestao.path.status_changed": "Situação do percurso alterada",
  "gestao.lesson.status_changed": "Situação da aula alterada",
  "gestao.lesson.edited": "Aula editada",
  "gestao.youtube.playlist.imported": "Playlist do YouTube importada",
  "gestao.collection.created": "Coleção criada",
  "gestao.collection.saved": "Coleção salva",
  "gestao.collection.status_changed": "Situação da coleção alterada",
  "gestao.collection.deleted": "Coleção excluída",
  "gestao.collection.item_added": "Item adicionado à coleção",
  "gestao.collection.item_removed": "Item removido da coleção",
  "gestao.collection.items_reordered": "Itens da coleção reordenados",
  "gestao.exercise-list.reordered": "Questões da lista reordenadas",
  "gestao.exercise-list.questions-removed": "Questões removidas da lista",
  "gestao.exercise-list.updated": "Lista de exercícios editada",
  "gestao.exercise-question.state-changed": "Situação da questão alterada",
  "gestao.activity.reminder_sent": "Lembrete de atividade enviado",
  "gestao.task.created": "Tarefa criada",
  "gestao.task.archived": "Tarefa arquivada",
  "gestao.goal.created": "Meta coletiva criada",
  "gestao.goal.published": "Meta coletiva publicada",
  "gestao.goal.unpublished": "Meta coletiva retirada de publicação",
  "gestao.goal.archived": "Meta coletiva arquivada",
  "gestao.cohort_notice.created": "Aviso da turma publicado",
  "gestao.cohort_notice.ended": "Aviso da turma encerrado",
  "gestao.cohort_notice.pin_changed": "Aviso da turma fixado ou solto",
  "gestao.notice.created": "Aviso criado",
  "gestao.notice.updated": "Aviso editado",
  "gestao.notice.audience": "Público do aviso definido",
  "gestao.notice.published": "Aviso publicado",
  "gestao.notice.ended": "Aviso encerrado",
  "gestao.notice.reopened": "Aviso reaberto como rascunho",
  "gestao.notice.pin_changed": "Aviso fixado ou solto",
  "gestao.notice.deleted": "Aviso excluído",
  "gestao.post.archived": "Publicação arquivada",
  "gestao.post.restored": "Publicação restaurada",
  "gestao.post.pinned": "Publicação fixada ou solta",
  "gestao.post.featured": "Destaque da publicação alterado",
  "gestao.post.removed": "Publicação removida",
  "gestao.meeting.created": "Encontro criado",
  "gestao.meeting.updated": "Encontro editado",
  "gestao.meeting.published": "Encontro publicado",
  "gestao.meeting.archived": "Encontro arquivado",
  "gestao.meeting.reopened": "Encontro reaberto como rascunho",
  "gestao.meeting.attendance_saved": "Presença do encontro registrada",
  "gestao.group.created": "Grupo criado",
  "gestao.group.updated": "Grupo editado",
  "gestao.group.status_changed": "Situação do grupo alterada",
  "gestao.assignment.created": "Atribuição criada",
  "gestao.assignment.revoked": "Atribuição revogada",
  "gestao.recording.assigned": "Gravações históricas vinculadas",
  "gestao.recording.revoked": "Vínculo de gravações revogado",
  "gestao.personalization.published": "Personalização publicada",
  "gestao.medal.created": "Medalha criada",
  "gestao.medal.updated": "Critério ou texto da medalha alterado",
  "gestao.medal.status_changed": "Situação da medalha alterada",
  "gestao.integration.updated": "Regras do YouTube alteradas",
  "learning.content.assigned": "Conteúdo atribuído",
};

const auditPrefixes = ["gestao."];
const auditExtraTypes = ["learning.content.assigned", "event.published"];

export interface RecordAuditInput {
  readonly actorId: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly eventType: keyof typeof gestaoAuditLabels & string;
  readonly payload: Prisma.InputJsonValue;
}

type AuditClient = Pick<typeof database, "domainEvent">;

export const recordAuditEvent = async (
  input: RecordAuditInput,
  client: AuditClient = database
) => {
  await client.domainEvent.create({
    data: {
      eventType: input.eventType,
      actorId: input.actorId,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      idempotencyKey: `audit:${input.eventType}:${crypto.randomUUID()}`,
      payload: input.payload,
      occurredAt: new Date(),
    },
  });
};

export interface AuditFilters {
  readonly action?: string;
  readonly actorId?: string;
  readonly from?: string;
  readonly page?: number;
  readonly periodDays?: number | null;
  readonly query?: string;
  readonly to?: string;
}

const parseDay = (value: string | undefined, endOfDay: boolean) => {
  if (!value || value.length > 10) {
    return null;
  }
  const date = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}-03:00`
  );
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolveActorIds = async (query: string | undefined) => {
  const text = query?.trim().slice(0, 120);
  if (!text) {
    return null;
  }
  const members = await database.member.findMany({
    where: {
      OR: [
        { displayName: { contains: text, mode: "insensitive" } },
        { email: { contains: text, mode: "insensitive" } },
      ],
    },
    select: { id: true },
    take: 200,
  });
  return members.map((member) => member.id);
};

const buildWhere = (
  filters: AuditFilters,
  actorIds: readonly string[] | null
): Prisma.DomainEventWhereInput => {
  const action = filters.action?.trim();
  const from =
    parseDay(filters.from, false) ??
    (filters.periodDays
      ? new Date(Date.now() - filters.periodDays * 86_400_000)
      : null);
  const to = parseDay(filters.to, true);
  const typeFilter: Prisma.DomainEventWhereInput =
    action && gestaoAuditLabels[action]
      ? { eventType: action }
      : {
          OR: [
            ...auditPrefixes.map((prefix) => ({
              eventType: { startsWith: prefix },
            })),
            { eventType: { in: auditExtraTypes } },
          ],
        };
  const filtersList: Prisma.DomainEventWhereInput[] = [typeFilter];
  if (from || to) {
    filtersList.push({
      occurredAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    });
  }
  if (actorIds) {
    filtersList.push({ actorId: { in: [...actorIds] } });
  }
  if (filters.actorId) {
    filtersList.push({ actorId: filters.actorId.slice(0, 255) });
  }
  return { AND: filtersList };
};

export interface AuditRow {
  readonly actor: string;
  readonly actorId: string | null;
  readonly aggregate: string;
  readonly at: Date;
  readonly details: string;
  readonly eventType: string;
  readonly id: string;
  readonly label: string;
  readonly object: string;
}

const payloadLabels: Readonly<Record<string, string>> = {
  count: "Itens",
  criterion: "Critério",
  itemType: "Tipo de item",
  kind: "Origem",
  noteEnabled: "Nota do portal",
  recipientCount: "Alunos",
  recurrence: "Repetição",
  revokedRecipients: "Revogados",
  schedule: "Verificação",
  showLearnNavigation: "Cursos na navegação",
  targetMinutes: "Meta (min)",
  targetType: "Conteúdo",
  unlistedOnly: "Só não listados",
  allowUpload: "Envio de arquivo",
  mode: "Modo",
  noteMode: "Nota",
  recipients: "Destinatários",
  resourceType: "Tipo",
  role: "Papel",
  status: "Situação",
  title: "Título",
  version: "Versão",
};

const roleNames: Readonly<Record<string, string>> = {
  ADMIN: "Administrador",
  MEMBER: "Membro",
  TEACHER: "Professor",
  ARCHIVED: "Arquivado",
  DAILY: "Diária",
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  WEEKLY: "Semanal",
  ACTIVITY: "Atividade",
  COURSE: "Curso",
  LESSON: "Aula",
  LIBRARY_ITEM: "Material",
  EXERCISE_LIST: "Lista de exercícios",
  source: "concessão direta",
  legacy: "concessão legada",
  daily: "diária",
  weekly: "semanal",
  off: "sob demanda",
  manual: "manual",
  auto: "automática",
};

const aggregateNames: Readonly<Record<string, string>> = {
  ContentCollection: "Coleção",
  LearningAssignmentBatch: "Atribuição",
  LearningTask: "Tarefa",
  ProductSetting: "Configuração",
  StudyCampaign: "Meta coletiva",
};

const friendlyObject = (type: string, id: string) =>
  aggregateNames[type]
    ? `${aggregateNames[type]} · ${id.slice(0, 6)}`
    : `${type} · ${id.slice(0, 8)}`;

const scalar = (value: unknown) => {
  if (typeof value === "string") {
    return roleNames[value] ?? value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "sim" : "não";
  }
  return null;
};

const idLike = /^(?:c[a-z0-9]{20,}|[0-9a-f-]{32,})$/i;

/** Resume o conteúdo gravado do evento em uma linha curta, sem ids técnicos. */
export const describePayload = (payload: unknown) => {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return "";
  }
  const record = payload as Record<string, unknown>;
  const from = scalar(record.from ?? record.previousRole);
  const to = scalar(record.to ?? record.role ?? record.nextRole);
  if (from && to) {
    return `${from} → ${to}`;
  }
  const parts: string[] = [];
  for (const [key, raw] of Object.entries(record)) {
    const base = scalar(raw);
    const value = base ? (medalCriteria[base] ?? base) : null;
    if (
      !value ||
      key.endsWith("Id") ||
      key.endsWith("Ids") ||
      idLike.test(value)
    ) {
      continue;
    }
    parts.push(`${payloadLabels[key] ?? key}: ${value}`);
    if (parts.length === 3) {
      break;
    }
  }
  return parts.join(" · ").slice(0, 160);
};

const resolveObjectNames = async (
  events: readonly {
    readonly aggregateId: string;
    readonly aggregateType: string;
  }[]
) => {
  const wanted = (type: string) => [
    ...new Set(
      events
        .filter((event) => event.aggregateType === type)
        .map((event) => event.aggregateId)
    ),
  ];
  const memberIds = wanted("Member");
  const cohortIds = wanted("Cohort");
  const courseIds = wanted("Course");
  const badgeIds = wanted("BadgeDefinition");
  const groupIds = wanted("ImportedRecordingGroup");
  const [members, cohorts, courses, badges, groups] = await Promise.all([
    memberIds.length
      ? database.member.findMany({
          where: { id: { in: memberIds } },
          select: { id: true, displayName: true },
        })
      : [],
    cohortIds.length
      ? database.cohort.findMany({
          where: { id: { in: cohortIds } },
          select: { id: true, name: true },
        })
      : [],
    courseIds.length
      ? database.course.findMany({
          where: { id: { in: courseIds } },
          select: { id: true, title: true },
        })
      : [],
    badgeIds.length
      ? database.badgeDefinition.findMany({
          where: { id: { in: badgeIds } },
          select: { id: true, title: true },
        })
      : [],
    groupIds.length
      ? database.importedRecordingGroup.findMany({
          where: { id: { in: groupIds } },
          select: { id: true, legacyStudentName: true },
        })
      : [],
  ]);
  const names = new Map<string, string>();
  for (const row of members) {
    names.set(`Member:${row.id}`, row.displayName ?? "Membro sem nome");
  }
  for (const row of cohorts) {
    names.set(`Cohort:${row.id}`, `Turma ${row.name}`);
  }
  for (const row of courses) {
    names.set(`Course:${row.id}`, `Curso: ${row.title}`);
  }
  for (const row of badges) {
    names.set(`BadgeDefinition:${row.id}`, `Medalha: ${row.title}`);
  }
  for (const row of groups) {
    names.set(
      `ImportedRecordingGroup:${row.id}`,
      `Gravações de ${row.legacyStudentName}`
    );
  }
  return names;
};

export const listGestaoAuditActors = async () => {
  await requireGestaoAction("audit.read");
  const grouped = await database.domainEvent.groupBy({
    by: ["actorId"],
    where: {
      actorId: { not: null },
      OR: [
        ...auditPrefixes.map((prefix) => ({
          eventType: { startsWith: prefix },
        })),
        { eventType: { in: auditExtraTypes } },
      ],
    },
    orderBy: { actorId: "asc" },
    take: 100,
  });
  const ids = grouped.flatMap((row) => (row.actorId ? [row.actorId] : []));
  const members = ids.length
    ? await database.member.findMany({
        where: { id: { in: ids } },
        orderBy: { displayName: "asc" },
        select: { id: true, displayName: true, email: true },
      })
    : [];
  return members.map((member) => ({
    id: member.id,
    name: member.displayName ?? member.email ?? "Membro sem nome",
  }));
};

const queryAudit = async (
  filters: AuditFilters,
  paging: { readonly skip: number; readonly take: number }
) => {
  const actorIds = await resolveActorIds(filters.query);
  const where = buildWhere(filters, actorIds);
  const [total, events] = await Promise.all([
    database.domainEvent.count({ where }),
    database.domainEvent.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      skip: paging.skip,
      take: paging.take,
      select: {
        id: true,
        eventType: true,
        actorId: true,
        aggregateType: true,
        aggregateId: true,
        occurredAt: true,
        payload: true,
      },
    }),
  ]);
  const objectNames = await resolveObjectNames(events);
  const ids = [
    ...new Set(
      events.flatMap((event) => (event.actorId ? [event.actorId] : []))
    ),
  ];
  const members = ids.length
    ? await database.member.findMany({
        where: { id: { in: ids } },
        select: { id: true, displayName: true, email: true },
      })
    : [];
  const names = new Map(
    members.map((member) => [
      member.id,
      member.displayName ?? member.email ?? "Membro sem nome",
    ])
  );
  const rows = events.map(
    (event): AuditRow => ({
      id: event.id,
      at: event.occurredAt,
      eventType: event.eventType,
      label: gestaoAuditLabels[event.eventType] ?? event.eventType,
      actorId: event.actorId,
      actor: event.actorId
        ? (names.get(event.actorId) ?? "Membro removido")
        : "Sistema",
      aggregate: `${event.aggregateType} · ${event.aggregateId}`,
      object:
        objectNames.get(`${event.aggregateType}:${event.aggregateId}`) ??
        friendlyObject(event.aggregateType, event.aggregateId),
      details: describePayload(event.payload),
    })
  );
  return { rows, total };
};

export const listGestaoAudit = async (filters: AuditFilters) => {
  await requireGestaoAction("audit.read");
  const page = Math.max(1, Math.trunc(filters.page ?? 1) || 1);
  const result = await queryAudit(filters, {
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return {
    ...result,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(result.total / pageSize)),
  };
};

export const exportGestaoAudit = async (filters: AuditFilters) => {
  await requireGestaoAction("audit.read");
  return (await queryAudit(filters, { skip: 0, take: maxExportRows })).rows;
};
