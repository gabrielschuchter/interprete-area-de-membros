import { ContentStatus } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import { listGestaoActivities } from "@/lib/gestao-activities";
import { setGestaoActivityStatus } from "./actions";

const statusNames: Record<ContentStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

const statusOptions = [
  ["ALL", "Todas"],
  [ContentStatus.PUBLISHED, "Publicadas"],
  [ContentStatus.DRAFT, "Rascunhos"],
  [ContentStatus.ARCHIVED, "Arquivadas"],
] as const;

const dueOptions = [
  ["ALL", "Todos os prazos"],
  ["UPCOMING", "Com prazo futuro"],
  ["OVERDUE", "Prazo vencido"],
  ["NONE", "Sem prazo"],
] as const;

const dateLabel = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      }).format(value)
    : "Sem prazo";

const pageHref = (input: {
  readonly query: string;
  readonly status: string;
  readonly courseId: string;
  readonly due: string;
  readonly page?: number;
}) => {
  const params = new URLSearchParams();
  if (input.query) {
    params.set("q", input.query);
  }
  if (input.status !== "ALL") {
    params.set("estado", input.status);
  }
  if (input.courseId) {
    params.set("curso", input.courseId);
  }
  if (input.due !== "ALL") {
    params.set("prazo", input.due);
  }
  if (input.page && input.page > 1) {
    params.set("pagina", String(input.page));
  }
  const search = params.toString();
  return `/gestao/ensino/atividades${search ? `?${search}` : ""}`;
};

const resultMessages: Record<string, string> = {
  "estado-atualizado": "Estado da atividade atualizado.",
  conflito:
    "A atividade mudou em outra sessão. Atualize a lista antes de tentar novamente.",
  "dados-invalidos": "Revise os campos enviados.",
  "nao-encontrada": "A atividade não está mais disponível.",
};

interface GestaoActivitiesPageProperties {
  readonly searchParams: Promise<{
    readonly q?: string;
    readonly estado?: string;
    readonly curso?: string;
    readonly prazo?: string;
    readonly pagina?: string;
    readonly resultado?: string;
  }>;
}

type ActivityRowData = Awaited<
  ReturnType<typeof listGestaoActivities>
>["activities"][number];

const ActivityRecipients = ({
  activity,
}: {
  readonly activity: ActivityRowData;
}) => (
  <div className="ga-recipient-summary">
    {activity.cohortTargets.slice(0, 3).map(({ cohort }) => (
      <span key={cohort.id}>{cohort.name}</span>
    ))}
    {activity.cohortCount > 3 ? (
      <span>+{activity.cohortCount - 3} turmas</span>
    ) : null}
    {activity.directRecipientCount ? (
      <small>
        {activity.directRecipientCount} aluno
        {activity.directRecipientCount === 1 ? "" : "s"} individual
        {activity.directRecipientCount === 1 ? "" : "is"}
      </small>
    ) : null}
    {activity.cohortCount || activity.directRecipientCount ? null : (
      <small>Curso ou acesso geral</small>
    )}
  </div>
);

const ActivityStatusAction = ({
  activity,
}: {
  readonly activity: ActivityRowData;
}) => {
  const canChangeStatus =
    activity.status === ContentStatus.PUBLISHED ||
    activity.status === ContentStatus.ARCHIVED;
  if (!canChangeStatus) {
    return null;
  }
  const isPublished = activity.status === ContentStatus.PUBLISHED;
  const actionLabel = isPublished ? "Arquivar" : "Reativar";
  const nextStatus = isPublished
    ? ContentStatus.ARCHIVED
    : ContentStatus.PUBLISHED;
  return (
    <SingleFlightForm action={setGestaoActivityStatus}>
      <input name="activityId" type="hidden" value={activity.id} />
      <input name="version" type="hidden" value={activity.version} />
      <input name="status" type="hidden" value={nextStatus} />
      <SingleFlightSubmit
        aria-label={`${actionLabel} ${activity.title}`}
        size="sm"
        variant="ghost"
      >
        {actionLabel}
      </SingleFlightSubmit>
    </SingleFlightForm>
  );
};

const ActivityCatalogRow = ({
  activity,
}: {
  readonly activity: ActivityRowData;
}) => (
  <tr>
    <td data-label="Atividade">
      <Link
        className="ga-activity-title"
        href={`/gestao/ensino/atividades/${activity.id}`}
        prefetch={false}
      >
        {activity.title}
      </Link>
      <small>{activity.course?.title ?? "Sem curso associado"}</small>
    </td>
    <td data-label="Prazo">{dateLabel(activity.dueAt)}</td>
    <td data-label="Destinatários">
      <ActivityRecipients activity={activity} />
    </td>
    <td data-label="Entregas">{activity.counts.all}</td>
    <td data-label="Para corrigir">
      <strong className={activity.counts.toReview ? "ga-review-count" : ""}>
        {activity.counts.toReview}
      </strong>
    </td>
    <td data-label="Estado">
      <span className={`ge-status ge-status-${activity.status.toLowerCase()}`}>
        {statusNames[activity.status]}
      </span>
    </td>
    <td data-label="Ações">
      <div className="ga-row-actions">
        <Button asChild size="sm" variant="outline">
          <Link
            href={`/gestao/ensino/atividades/${activity.id}`}
            prefetch={false}
          >
            Abrir
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link
            href={`/gestao/ensino/atividades/${activity.id}/entregas`}
            prefetch={false}
          >
            Entregas
          </Link>
        </Button>
        <ActivityStatusAction activity={activity} />
      </div>
    </td>
  </tr>
);

const GestaoActivitiesPage = async ({
  searchParams,
}: GestaoActivitiesPageProperties) => {
  const params = await searchParams;
  const catalog = await listGestaoActivities({
    query: params.q,
    status: params.estado,
    courseId: params.curso,
    due: params.prazo,
    page: Number(params.pagina),
  });
  const activeStatus = catalog.status;
  const activeDue = dueOptions.some(([value]) => value === params.prazo)
    ? (params.prazo ?? "ALL")
    : "ALL";
  const resultMessage = params.resultado
    ? resultMessages[params.resultado]
    : null;

  return (
    <section className="gestao-page-content ga-activity-catalog">
      <header className="ga-page-heading">
        <div>
          <p className="gestao-eyebrow">Gestão · Ensino</p>
          <h1>Atividades</h1>
          <p>
            Crie práticas, distribua para as turmas e acompanhe as entregas.
          </p>
        </div>
        <Button asChild>
          <Link href="/gestao/ensino/atividades/nova">
            <PlusIcon aria-hidden="true" /> Nova atividade
          </Link>
        </Button>
      </header>

      {resultMessage ? (
        <output className="ga-result">{resultMessage}</output>
      ) : null}

      <nav
        aria-label="Filtrar atividades por estado"
        className="ga-status-tabs"
      >
        {statusOptions.map(([value, label]) => (
          <Link
            aria-current={activeStatus === value ? "page" : undefined}
            className={activeStatus === value ? "is-active" : ""}
            href={pageHref({
              query: catalog.query,
              status: value,
              courseId: params.curso ?? "",
              due: activeDue,
            })}
            key={value}
          >
            {label}
          </Link>
        ))}
      </nav>

      <form
        action="/gestao/ensino/atividades"
        className="ga-activity-filters"
        method="get"
      >
        <label className="ga-activity-search" htmlFor="activity-search">
          <SearchIcon aria-hidden="true" />
          <Input
            defaultValue={catalog.query}
            id="activity-search"
            maxLength={120}
            name="q"
            placeholder="Buscar atividade"
          />
        </label>
        {activeStatus !== "ALL" ? (
          <input name="estado" type="hidden" value={activeStatus} />
        ) : null}
        <label>
          <span className="sr-only">Filtrar por curso</span>
          <select defaultValue={params.curso ?? ""} name="curso">
            <option value="">Todos os cursos</option>
            {catalog.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filtrar por prazo</span>
          <select defaultValue={activeDue} name="prazo">
            {dueOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      {catalog.activities.length ? (
        <div className="ga-activity-table-wrap">
          <table className="ga-activity-table">
            <thead>
              <tr>
                <th scope="col">Atividade</th>
                <th scope="col">Prazo</th>
                <th scope="col">Destinatários</th>
                <th scope="col">Entregas</th>
                <th scope="col">Para corrigir</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {catalog.activities.map((activity) => (
                <ActivityCatalogRow activity={activity} key={activity.id} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ga-activity-empty">
          <h2>Nenhuma atividade encontrada</h2>
          <p>Altere os filtros ou crie uma atividade para começar.</p>
          <Button asChild variant="outline">
            <Link href="/gestao/ensino/atividades/nova">Criar atividade</Link>
          </Button>
        </div>
      )}

      {catalog.totalPages > 1 ? (
        <nav
          aria-label="Paginação de atividades"
          className="ga-activity-pagination"
        >
          <span>
            {catalog.totalCount} atividades · página {catalog.page} de{" "}
            {catalog.totalPages}
          </span>
          <div>
            <Button
              asChild
              disabled={catalog.page <= 1}
              size="sm"
              variant="outline"
            >
              <Link
                aria-disabled={catalog.page <= 1}
                href={pageHref({
                  query: catalog.query,
                  status: activeStatus,
                  courseId: params.curso ?? "",
                  due: activeDue,
                  page: Math.max(1, catalog.page - 1),
                })}
              >
                Anterior
              </Link>
            </Button>
            <Button
              asChild
              disabled={catalog.page >= catalog.totalPages}
              size="sm"
              variant="outline"
            >
              <Link
                aria-disabled={catalog.page >= catalog.totalPages}
                href={pageHref({
                  query: catalog.query,
                  status: activeStatus,
                  courseId: params.curso ?? "",
                  due: activeDue,
                  page: Math.min(catalog.totalPages, catalog.page + 1),
                })}
              >
                Próxima
              </Link>
            </Button>
          </div>
        </nav>
      ) : null}
    </section>
  );
};

export default GestaoActivitiesPage;
