import { Button } from "@repo/design-system/components/ui/button";
import {
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  listGestaoCourses,
  listGestaoLearningPaths,
} from "@/lib/gestao-courses";

const labels = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
} as const;
const statusOptions = [
  ["ALL", "Todos os estados"],
  ["PUBLISHED", "Publicado"],
  ["SCHEDULED", "Agendado"],
  ["DRAFT", "Rascunho"],
  ["ARCHIVED", "Arquivado"],
] as const;
const relativeTime = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const relativeDate = (value: Date) => {
  const delta = value.getTime() - Date.now();
  const day = 86_400_000;
  if (Math.abs(delta) < day) {
    return relativeTime.format(Math.round(delta / 3_600_000), "hour");
  }
  if (Math.abs(delta) < 30 * day) {
    return relativeTime.format(Math.round(delta / day), "day");
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(value);
};
const filtersHref = (input: {
  readonly query: string;
  readonly status: string;
  readonly pathId: string;
  readonly view: string;
  readonly page?: number;
  readonly tab?: string;
}) => {
  const params = new URLSearchParams();
  if (input.query) {
    params.set("q", input.query);
  }
  if (input.status !== "ALL") {
    params.set("estado", input.status);
  }
  if (input.pathId !== "ALL") {
    params.set("percurso", input.pathId);
  }
  if (input.view === "GRID") {
    params.set("visualizacao", "grade");
  }
  if (input.page && input.page > 1) {
    params.set("pagina", String(input.page));
  }
  if (input.tab === "percursos") {
    params.set("aba", "percursos");
  }
  const query = params.toString();
  return `/gestao/ensino/cursos${query ? `?${query}` : ""}`;
};
const CourseStatus = ({ state }: { readonly state: keyof typeof labels }) => (
  <span className={`ge-status ge-status-${state.toLowerCase()}`}>
    {labels[state]}
  </span>
);

type CourseCatalog = Awaited<ReturnType<typeof listGestaoCourses>>;
type CourseItem = CourseCatalog["courses"][number];
type LearningPathCatalog = Awaited<ReturnType<typeof listGestaoLearningPaths>>;

const CourseAccess = ({ course }: { readonly course: CourseItem }) => {
  if (!course.cohortCount) {
    return <span className="ge-muted">Nenhuma turma</span>;
  }
  return (
    <span className="ge-cohort-access-list">
      {course.cohorts.map((cohort) => (
        <Link
          className="ge-cohort-access"
          href={`/gestao/alunos/turmas/${cohort.id}`}
          key={cohort.id}
          prefetch={false}
          title={`${cohort.studentCount} alunos ativos`}
        >
          <span aria-hidden="true">♙</span>
          <span>
            {cohort.name} · {cohort.studentCount}
          </span>
        </Link>
      ))}
      {course.cohortCount > course.cohorts.length ? (
        <span className="ge-muted">
          +{course.cohortCount - course.cohorts.length}
        </span>
      ) : null}
    </span>
  );
};

const CourseRow = ({ course }: { readonly course: CourseItem }) => (
  <tr>
    <td>
      <Link
        className="ge-course-link"
        href={`/gestao/ensino/cursos/${course.id}`}
        prefetch={false}
      >
        <span aria-hidden="true" className="ge-course-icon">
          <BookOpenIcon />
        </span>
        <span className="ge-course-copy">
          <strong>{course.title}</strong>
          <small>
            {course.lessonCount} aulas · {course.moduleCount} módulos
          </small>
        </span>
      </Link>
    </td>
    <td>{course.path?.title ?? <span className="ge-muted">—</span>}</td>
    <td>
      {course.moduleCount} · {course.lessonCount}
    </td>
    <td>
      <CourseAccess course={course} />
    </td>
    <td>
      <CourseStatus state={course.state} />
    </td>
    <td>{relativeDate(course.updatedAt)}</td>
    <td>
      <Link
        aria-label={`Abrir editor de ${course.title}`}
        className="ge-open-course"
        href={`/gestao/ensino/cursos/${course.id}`}
        prefetch={false}
      >
        Abrir
      </Link>
    </td>
  </tr>
);

const CourseCard = ({ course }: { readonly course: CourseItem }) => (
  <article className="ge-course-card">
    <div className="ge-course-card-heading">
      <span aria-hidden="true" className="ge-course-icon">
        <BookOpenIcon />
      </span>
      <CourseStatus state={course.state} />
    </div>
    <p className="ge-course-card-path">
      {course.path?.title ?? "Sem percurso"}
    </p>
    <h2>{course.title}</h2>
    <p className="ge-course-card-meta">
      {course.moduleCount} módulos · {course.lessonCount} aulas
    </p>
    <CourseAccess course={course} />
    <div className="ge-course-card-footer">
      <span>Atualizado {relativeDate(course.updatedAt)}</span>
      <Button asChild size="sm" variant="outline">
        <Link href={`/gestao/ensino/cursos/${course.id}`} prefetch={false}>
          Abrir
        </Link>
      </Button>
    </div>
  </article>
);

const CourseFilters = ({ catalog }: { readonly catalog: CourseCatalog }) => (
  <div className="ge-course-toolbar">
    <form
      action="/gestao/ensino/cursos"
      className="ge-course-filters"
      method="get"
    >
      <input name="aba" type="hidden" value="cursos" />
      {catalog.view === "GRID" ? (
        <input name="visualizacao" type="hidden" value="grade" />
      ) : null}
      <label className="ge-course-search">
        <span aria-hidden="true">⌕</span>
        <span className="sr-only">Buscar cursos</span>
        <input
          autoComplete="off"
          defaultValue={catalog.query}
          maxLength={120}
          name="q"
          placeholder="Buscar cursos"
          type="search"
        />
      </label>
      <label className="ge-course-select">
        <span className="sr-only">Filtrar por estado</span>
        <select defaultValue={catalog.status} name="estado">
          {statusOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="ge-course-select">
        <span className="sr-only">Filtrar por percurso</span>
        <select defaultValue={catalog.pathId} name="percurso">
          <option value="ALL">Todos os percursos</option>
          {catalog.paths.map((path) => (
            <option key={path.id} value={path.id}>
              {path.title}
            </option>
          ))}
        </select>
      </label>
      <Button size="sm" type="submit" variant="outline">
        Filtrar
      </Button>
    </form>
    <nav aria-label="Exibição dos cursos" className="ge-course-view-switch">
      <Link
        aria-current={catalog.view === "LIST" ? "page" : undefined}
        data-active={String(catalog.view === "LIST")}
        href={filtersHref({
          query: catalog.query,
          status: catalog.status,
          pathId: catalog.pathId,
          view: "LIST",
        })}
      >
        Lista
      </Link>
      <Link
        aria-current={catalog.view === "GRID" ? "page" : undefined}
        data-active={String(catalog.view === "GRID")}
        href={filtersHref({
          query: catalog.query,
          status: catalog.status,
          pathId: catalog.pathId,
          view: "GRID",
        })}
      >
        Grade
      </Link>
    </nav>
  </div>
);

const CoursePagination = ({ catalog }: { readonly catalog: CourseCatalog }) =>
  catalog.totalPages > 1 ? (
    <nav aria-label="Paginação dos cursos" className="ge-course-pagination">
      <span>
        {(catalog.page - 1) * catalog.pageSize + 1}–
        {Math.min(catalog.page * catalog.pageSize, catalog.totalCount)} de{" "}
        {catalog.totalCount}
      </span>
      <div>
        {catalog.page > 1 ? (
          <Link
            href={filtersHref({
              query: catalog.query,
              status: catalog.status,
              pathId: catalog.pathId,
              view: catalog.view,
              page: catalog.page - 1,
            })}
          >
            <ChevronLeftIcon aria-hidden="true" /> Anterior
          </Link>
        ) : null}
        {catalog.page < catalog.totalPages ? (
          <Link
            href={filtersHref({
              query: catalog.query,
              status: catalog.status,
              pathId: catalog.pathId,
              view: catalog.view,
              page: catalog.page + 1,
            })}
          >
            Próxima <ChevronRightIcon aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </nav>
  ) : null;

const CourseResults = ({ catalog }: { readonly catalog: CourseCatalog }) => {
  if (catalog.courses.length === 0) {
    const filtered = Boolean(
      catalog.query || catalog.pathId !== "ALL" || catalog.status !== "ALL"
    );
    return (
      <div className="ge-course-empty">
        <BookOpenIcon aria-hidden="true" />
        <h2>
          {filtered
            ? "Nenhum curso encontrado"
            : "Seu primeiro curso começa aqui"}
        </h2>
        <p>
          {filtered
            ? "Tente outros termos ou limpe os filtros."
            : "Organize módulos e aulas em um espaço que você pode publicar quando estiver pronto."}
        </p>
        <Button asChild>
          <Link href="/gestao/ensino/cursos/novo">
            <PlusIcon aria-hidden="true" /> Novo curso
          </Link>
        </Button>
      </div>
    );
  }
  return catalog.view === "GRID" ? (
    <div className="ge-course-grid">
      {catalog.courses.map((course) => (
        <CourseCard course={course} key={course.id} />
      ))}
    </div>
  ) : (
    <div className="ge-course-table-scroll">
      <table className="ge-course-table">
        <thead>
          <tr>
            <th>Curso</th>
            <th>Percurso</th>
            <th>Módulos · aulas</th>
            <th>Liberado para</th>
            <th>Estado</th>
            <th>Atualizado</th>
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {catalog.courses.map((course) => (
            <CourseRow course={course} key={course.id} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const pathCatalogHref = (input: {
  readonly query: string;
  readonly status: string;
  readonly page?: number;
}) => {
  const params = new URLSearchParams({ aba: "percursos" });
  if (input.query) {
    params.set("q", input.query);
  }
  if (input.status !== "ALL") {
    params.set("estado", input.status);
  }
  if (input.page && input.page > 1) {
    params.set("pagina", String(input.page));
  }
  return `/gestao/ensino/cursos?${params.toString()}`;
};

const PathsList = ({ catalog }: { readonly catalog: LearningPathCatalog }) => (
  <>
    <div className="ge-path-toolbar">
      <form action="/gestao/ensino/cursos" method="get">
        <input name="aba" type="hidden" value="percursos" />
        <label className="ge-course-search">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Buscar percursos</span>
          <input
            autoComplete="off"
            defaultValue={catalog.query}
            maxLength={120}
            name="q"
            placeholder="Buscar percursos"
            type="search"
          />
        </label>
        <label className="ge-course-select">
          <span className="sr-only">Filtrar por estado</span>
          <select defaultValue={catalog.status} name="estado">
            <option value="ALL">Todos os estados</option>
            <option value="PUBLISHED">Publicado</option>
            <option value="DRAFT">Rascunho</option>
            <option value="ARCHIVED">Arquivado</option>
          </select>
        </label>
        <Button size="sm" type="submit" variant="outline">
          Filtrar
        </Button>
      </form>
      <span>
        {catalog.totalCount}{" "}
        {catalog.totalCount === 1 ? "percurso" : "percursos"}
      </span>
    </div>
    {catalog.paths.length ? (
      <div className="ge-path-list">
        {catalog.paths.map((path) => (
          <article className="ge-path-card" key={path.id}>
            <div>
              <p className="ge-course-card-path">/{path.slug}</p>
              <h2>{path.title}</h2>
              <p>{path.description || "Sem descrição"}</p>
            </div>
            <div className="ge-path-card-meta">
              <span>{path._count.courses} cursos</span>
              <CourseStatus state={path.status} />
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/gestao/ensino/cursos/percursos/${path.id}`}
                  prefetch={false}
                >
                  Editar percurso
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <div className="ge-course-empty">
        <h2>
          {catalog.query || catalog.status !== "ALL"
            ? "Nenhum percurso encontrado"
            : "Nenhum percurso criado"}
        </h2>
        <p>
          {catalog.query || catalog.status !== "ALL"
            ? "Altere os termos ou limpe os filtros para buscar novamente."
            : "Um percurso organiza cursos em uma jornada de aprendizagem."}
        </p>
        <Button asChild>
          <Link href="/gestao/ensino/cursos/percursos/novo">
            <PlusIcon aria-hidden="true" /> Criar percurso
          </Link>
        </Button>
      </div>
    )}
    {catalog.totalPages > 1 ? (
      <nav
        aria-label="Paginação dos percursos"
        className="ge-course-pagination"
      >
        <span>
          {(catalog.page - 1) * catalog.pageSize + 1}–
          {Math.min(catalog.page * catalog.pageSize, catalog.totalCount)} de{" "}
          {catalog.totalCount}
        </span>
        <div>
          {catalog.page > 1 ? (
            <Link
              href={pathCatalogHref({
                query: catalog.query,
                status: catalog.status,
                page: catalog.page - 1,
              })}
            >
              Anterior
            </Link>
          ) : null}
          {catalog.page < catalog.totalPages ? (
            <Link
              href={pathCatalogHref({
                query: catalog.query,
                status: catalog.status,
                page: catalog.page + 1,
              })}
            >
              Próxima
            </Link>
          ) : null}
        </div>
      </nav>
    ) : null}
  </>
);

const GestaoCoursesPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const query = await searchParams;
  const value = (item: string | string[] | undefined) =>
    Array.isArray(item) ? item[0] : item;
  const tab = value(query.aba) === "percursos" ? "percursos" : "cursos";
  const courseCatalog =
    tab === "cursos"
      ? await listGestaoCourses({
          page: Number(value(query.pagina)) || 1,
          query: value(query.q),
          status: value(query.estado),
          pathId: value(query.percurso),
          view: value(query.visualizacao) === "grade" ? "GRID" : "LIST",
        })
      : null;
  const pathCatalog =
    tab === "percursos"
      ? await listGestaoLearningPaths({
          page: Number(value(query.pagina)) || 1,
          query: value(query.q),
          status: value(query.estado),
        })
      : null;
  const pathHasFilters = Boolean(
    value(query.q) || value(query.estado) || value(query.pagina)
  );
  const firstPath = pathCatalog?.paths[0];
  if (tab === "percursos" && firstPath && !pathHasFilters) {
    redirect(`/gestao/ensino/cursos/percursos/${firstPath.id}`);
  }
  const tabHref = (name: "cursos" | "percursos") => {
    const params = new URLSearchParams();
    if (name === "percursos") {
      params.set("aba", name);
    }
    const value = params.toString();
    return `/gestao/ensino/cursos${value ? `?${value}` : ""}`;
  };

  return (
    <section className="ge-courses-page">
      <header className="ge-courses-heading">
        <div>
          <p className="ge-courses-eyebrow">Gestão · Ensino</p>
          <h1>Cursos e percursos</h1>
          <p>Percursos organizam a jornada; cursos reúnem módulos e aulas.</p>
        </div>
        <div className="ge-courses-actions">
          <Button asChild variant="outline">
            <Link href="/gestao/ensino/cursos/percursos/novo">
              Novo percurso
            </Link>
          </Button>
          <Button asChild>
            <Link href="/gestao/ensino/cursos/novo">
              <PlusIcon aria-hidden="true" /> Novo curso
            </Link>
          </Button>
        </div>
      </header>
      <nav aria-label="Tipo de conteúdo" className="ge-content-tabs">
        <Link
          aria-current={tab === "cursos" ? "page" : undefined}
          data-active={String(tab === "cursos")}
          href={tabHref("cursos")}
        >
          Cursos{" "}
          {courseCatalog ? (
            <span>
              {courseCatalog.statusCounts.PUBLISHED +
                courseCatalog.statusCounts.SCHEDULED +
                courseCatalog.statusCounts.DRAFT +
                courseCatalog.statusCounts.ARCHIVED}
            </span>
          ) : null}
        </Link>
        <Link
          aria-current={tab === "percursos" ? "page" : undefined}
          data-active={String(tab === "percursos")}
          href={tabHref("percursos")}
        >
          Percursos{pathCatalog ? <span>{pathCatalog.totalCount}</span> : null}
        </Link>
      </nav>
      {courseCatalog ? (
        <>
          <CourseFilters catalog={courseCatalog} />
          <CourseResults catalog={courseCatalog} />
          <CoursePagination catalog={courseCatalog} />
        </>
      ) : null}
      {pathCatalog ? <PathsList catalog={pathCatalog} /> : null}
    </section>
  );
};

export default GestaoCoursesPage;
