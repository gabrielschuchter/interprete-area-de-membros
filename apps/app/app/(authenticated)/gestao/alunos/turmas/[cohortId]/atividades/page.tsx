import { database } from "@repo/database";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireGestaoCohortActor } from "@/lib/gestao-authorization";
import { getGestaoCohortDetail } from "@/lib/gestao-cohorts";
import { GestaoCohortHeader } from "../cohort-header";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});
const statusLabel: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  ARCHIVED: "Arquivada",
};

const GestaoCohortActivitiesPage = async ({
  params,
}: {
  readonly params: Promise<{ cohortId: string }>;
}) => {
  const { cohortId } = await params;
  await requireGestaoCohortActor(cohortId);
  const cohort = await getGestaoCohortDetail(cohortId);
  if (!cohort) {
    notFound();
  }
  const activities = await database.activity.findMany({
    where: {
      cohortTargets: {
        some: { cohortId, revokedAt: null, activeKey: { not: null } },
      },
    },
    orderBy: [{ dueAt: "asc" }, { title: "asc" }, { id: "asc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      status: true,
      dueAt: true,
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
        select: { status: true },
      },
    },
  });
  return (
    <section className="gt-page gt-detail-page">
      <GestaoCohortHeader activeTab="atividades" cohort={cohort} />
      <section className="gx-card">
        <div className="gx-card-heading">
          <h2>Atividades desta turma</h2>
          <Link
            className="gx-button"
            href={`/gestao/ensino/atividades/nova?turma=${cohortId}`}
          >
            Nova atividade para esta turma
          </Link>
        </div>
        {activities.length === 0 ? (
          <p className="gx-muted">
            Nenhuma atividade atribuída. A atividade criada aqui já nasce
            atribuída a esta turma.
          </p>
        ) : (
          <ul className="gx-list">
            {activities.map((activity) => {
              const toReview = activity.submissions.filter(
                ({ status }) => status === "SUBMITTED"
              ).length;
              return (
                <li key={activity.id}>
                  <Link href={`/gestao/ensino/atividades/${activity.id}`}>
                    <span>
                      <strong>{activity.title}</strong>
                      <span>
                        {statusLabel[activity.status] ?? activity.status} ·{" "}
                        {activity.dueAt
                          ? `prazo ${dateFormat.format(activity.dueAt)}`
                          : "sem prazo"}
                      </span>
                    </span>
                    <span>
                      {activity.submissions.length} entregas
                      {toReview ? ` · ${toReview} a corrigir` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
};

export default GestaoCohortActivitiesPage;
