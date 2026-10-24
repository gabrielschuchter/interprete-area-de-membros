import { ClipboardListIcon } from "lucide-react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { ActivityFilter } from "@/components/learning/activity-filter";
import { LearningPageFrame } from "@/components/learning/learning-page-frame";
import { getPublishedActivities } from "@/lib/activities";
import { requireOnboardedMemberId } from "@/lib/authorization";

const date = (value: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(value);
type Activity = Awaited<ReturnType<typeof getPublishedActivities>>[number];
const ActivityRow = ({ activity }: { readonly activity: Activity }) => {
  const submission = activity.submissions[0];
  const sent =
    submission?.status === "SUBMITTED" || submission?.status === "REVIEWED";
  const reviewed = submission?.status === "REVIEWED";
  const due = activity.assignments[0]?.dueAt ?? activity.dueAt;
  const overdue = !sent && due && due.getTime() < Date.now();
  let label = "Pendente";
  let action = "Enviar atividade";
  let timing = due ? ` · entrega até ${date(due)}` : " · sem prazo definido";
  if (overdue) {
    label = "Atrasada";
  }
  if (sent) {
    label = "Enviada";
    action = "Ver envio";
  }
  if (reviewed) {
    label = "Feedback disponível";
    action = "Ler feedback";
  }
  if (sent && submission?.submittedAt) {
    timing = ` · enviada em ${date(submission.submittedAt)}`;
  }
  return (
    <article className="activity-list-row">
      <span aria-hidden="true" className="activity-list-icon">
        <ClipboardListIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h3>{activity.title}</h3>
        <p>
          {activity.course?.title ?? "Atividade"}
          {timing}
        </p>
      </div>
      <span
        className={`activity-list-status ${overdue ? "activity-list-status--overdue" : ""}`}
      >
        {label}
      </span>
      <IntentLink
        className={`learning-catalog-action ${sent || overdue ? "" : "learning-catalog-action--primary"}`}
        href={`/atividades/${activity.slug}`}
      >
        {action}
      </IntentLink>
    </article>
  );
};
const ActivitiesPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<{ status?: string }>;
}) => {
  const memberId = await requireOnboardedMemberId();
  const [activities, query] = await Promise.all([
    getPublishedActivities(memberId),
    searchParams,
  ]);
  const pending = activities.filter(
    (item) => !item.submissions[0] || item.submissions[0].status === "DRAFT"
  );
  const sent = activities.filter(
    (item) =>
      item.submissions[0]?.status === "SUBMITTED" ||
      item.submissions[0]?.status === "REVIEWED"
  );
  const allGroups: Record<string, readonly (readonly [string, Activity[]])[]> =
    {
      pending: [["Pendentes", pending]],
      submitted: [["Enviadas", sent]],
      reviewed: [
        [
          "Com feedback",
          sent.filter((item) => item.submissions[0]?.status === "REVIEWED"),
        ],
      ],
    };
  const groups =
    allGroups[query.status ?? ""] ??
    ([
      ["Pendentes", pending],
      ["Enviadas", sent],
    ] as const);
  return (
    <LearningPageFrame
      description="Atividades atribuídas e enviadas, com os prazos de cada uma."
      eyebrow="Estudar · Atividades"
      title="Atividades"
      variant="catalog"
    >
      <div className="activity-list" data-route-content-ready="activities">
        <div className="activity-list-filter">
          <ActivityFilter />
          <p className="font-data text-muted-foreground text-xs">
            {pending.length} pendentes · {sent.length} enviadas
          </p>
        </div>
        {groups.map(([title, items]) =>
          items.length > 0 ? (
            <section
              aria-label={title}
              className="activity-list-section"
              key={title}
            >
              <h2>{title}</h2>
              {items.map((activity) => (
                <ActivityRow activity={activity} key={activity.id} />
              ))}
            </section>
          ) : null
        )}
        {groups.every(([, items]) => items.length === 0) && (
          <section className="py-10">
            <h2>Nenhuma atividade nesta lista.</h2>
            <p className="mt-3 text-muted-foreground">
              As atividades disponíveis para você aparecerão aqui.
            </p>
            <IntentLink className="learning-catalog-action mt-6" href="/cursos">
              Continuar aprendendo
            </IntentLink>
          </section>
        )}
      </div>
    </LearningPageFrame>
  );
};
export default ActivitiesPage;
