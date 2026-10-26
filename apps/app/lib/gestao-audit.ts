import "server-only";
import { database, type Prisma } from "@repo/database";
import { requireGestaoAction } from "./gestao-authorization";

const pageSize = 25;
const maxExportRows = 5000;

export const gestaoAuditLabels: Readonly<Record<string, string>> = {
  "gestao.member.role_changed": "Papel alterado",
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
  "gestao.assignment.created": "Atribuição criada",
  "gestao.assignment.revoked": "Atribuição revogada",
  "gestao.recording.assigned": "Gravações históricas vinculadas",
  "gestao.recording.revoked": "Vínculo de gravações revogado",
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
  readonly from?: string;
  readonly page?: number;
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
  const from = parseDay(filters.from, false);
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
  return { AND: filtersList };
};

export interface AuditRow {
  readonly actor: string;
  readonly actorId: string | null;
  readonly aggregate: string;
  readonly at: Date;
  readonly eventType: string;
  readonly id: string;
  readonly label: string;
}

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
      },
    }),
  ]);
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
    pages: Math.max(1, Math.ceil(result.total / pageSize)),
  };
};

export const exportGestaoAudit = async (filters: AuditFilters) => {
  await requireGestaoAction("audit.read");
  return (await queryAudit(filters, { skip: 0, take: maxExportRows })).rows;
};
