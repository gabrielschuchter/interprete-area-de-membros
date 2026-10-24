import { database } from "@repo/database";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireGestaoCohortActor } from "@/lib/gestao-authorization";
import { getGestaoCohortDetail } from "@/lib/gestao-cohorts";
import { GestaoIcon } from "../../../../gestao-icon";
import { GestaoListFilters } from "../../../../gestao-list-filters";
import { GestaoCohortHeader } from "../cohort-header";

const dueFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
});
const deliveryLabels = {
  TEXT: "Resposta em texto",
  FILE: "Envio de arquivo",
  TEXT_AND_FILE: "Texto e arquivo",
} as const;
type Estado = "PUBLISHED" | "CLOSED" | "DRAFT";
const estados: readonly (readonly [Estado, string])[] = [
  ["PUBLISHED", "Publicado"],
  ["CLOSED", "Encerrada"],
  ["DRAFT", "Rascunho"],
];

const estadoOf = (status: string, dueAt: Date | null, now: Date): Estado => {
  if (status !== "PUBLISHED") {
    return "DRAFT";
  }
  return dueAt && dueAt < now ? "CLOSED" : "PUBLISHED";
};
const chipFor = {
  PUBLISHED: { icon: "play-circle", label: "Publicado", tone: "active" },
  CLOSED: { icon: "archive", label: "Encerrada", tone: "neutral" },
  DRAFT: { icon: "pencil", label: "Rascunho", tone: "neutral" },
} as const;

const GestaoCohortActivitiesPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ cohortId: string }>;
  readonly searchParams: Promise<{ estado?: string; q?: string }>;
}) => {
  const [{ cohortId }, query] = await Promise.all([params, searchParams]);
  await requireGestaoCohortActor(cohortId);
  const cohort = await getGestaoCohortDetail(cohortId);
  if (!cohort) {
    notFound();
  }
  const search = query.q?.trim().slice(0, 120) ?? "";
  const now = new Date();
  const activities = await database.activity.findMany({
    where: {
      status: { in: ["DRAFT", "PUBLISHED"] },
      cohortTargets: {
        some: { cohortId, revokedAt: null, activeKey: { not: null } },
      },
      ...(search
        ? { title: { contains: search, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: [{ dueAt: "asc" }, { title: "asc" }, { id: "asc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      status: true,
      dueAt: true,
      deliveryKind: true,
      _count: {
        select: {
          submissions: {
            where: {
              status: { in: ["SUBMITTED", "REVIEWED"] },
              member: {
                is: {
                  cohortMemberships: {
                    some: { cohortId, status: "ACTIVE", leftAt: null },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  const rows = activities
    .map((activity) => ({
      ...activity,
      estado: estadoOf(activity.status, activity.dueAt, now),
    }))
    .filter((activity) => !query.estado || activity.estado === query.estado);
  const students = cohort.activeStudentCount;
  return (
    <section className="gt-page gt-detail-page">
      <GestaoCohortHeader activeTab="atividades" cohort={cohort} />
      <div className="gk-toolbar">
        <GestaoListFilters
          options={estados}
          param="estado"
          placeholder="Buscar atividades da turma"
          query={search}
          selected={query.estado ?? ""}
          selectLabel="Estado"
        />
        <div className="gk-toolbar-group">
          <Link
            className="gk-btn gk-btn--primary"
            href={`/gestao/ensino/atividades/nova?turma=${cohortId}`}
          >
            Nova atividade para esta turma
          </Link>
        </div>
      </div>
      {rows.length > 0 ? (
        <div className="gk-table-card">
          <table className="gk-table">
            <thead>
              <tr>
                <th>Atividade</th>
                <th>Prazo</th>
                <th>Entregas</th>
                <th>Estado</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {rows.map((activity) => {
                const chip = chipFor[activity.estado];
                const done = activity._count.submissions;
                const percent = students
                  ? Math.min(100, Math.round((done / students) * 100))
                  : 0;
                return (
                  <tr key={activity.id}>
                    <td>
                      <Link
                        className="gk-person"
                        href={`/gestao/ensino/atividades/${activity.id}`}
                      >
                        <span aria-hidden="true" className="gk-icon-tile">
                          <GestaoIcon name="inbox" size={18} />
                        </span>
                        <span className="gk-row-copy">
                          <strong>{activity.title}</strong>
                          <small>{deliveryLabels[activity.deliveryKind]}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      {activity.dueAt
                        ? dueFormat.format(activity.dueAt).replace(".", "")
                        : "Sem prazo"}
                    </td>
                    <td>
                      <span className="gk-progress">
                        <span aria-hidden="true" className="gk-progress-track">
                          <span style={{ width: `${percent}%` }} />
                        </span>
                        <small>
                          {done}/{students}
                        </small>
                      </span>
                    </td>
                    <td>
                      <span className="gk-chip" data-tone={chip.tone}>
                        <GestaoIcon
                          name={chip.icon}
                          size={12}
                          strokeWidth={1.8}
                        />
                        {chip.label}
                      </span>
                    </td>
                    <td className="gk-col-menu">
                      <Link
                        className="gk-text-btn"
                        href={`/gestao/ensino/atividades/${activity.id}/entregas`}
                      >
                        Entregas
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="gk-panel">
          <h2 className="gk-panel-title">
            {search || query.estado
              ? "Nenhuma atividade encontrada"
              : "Nenhuma atividade atribuída"}
          </h2>
          <p className="gk-empty">
            {search || query.estado
              ? "Ajuste a busca ou o filtro de estado."
              : "A atividade criada aqui já nasce atribuída a esta turma."}
          </p>
        </div>
      )}
      <div className="gk-info-box">
        <GestaoIcon name="check-circle" size={20} />
        <div>
          <strong>
            Atividades criadas aqui já nascem atribuídas a esta turma.
          </strong>
          <span>
            Para atribuir também a outras turmas ou a alunos específicos, edite
            a atividade em Ensino.
          </span>
        </div>
      </div>
    </section>
  );
};

export default GestaoCohortActivitiesPage;
