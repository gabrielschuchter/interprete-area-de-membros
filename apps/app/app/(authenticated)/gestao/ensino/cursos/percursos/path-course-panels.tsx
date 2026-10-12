import { ContentStatus } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { BookOpenIcon } from "lucide-react";
import Link from "next/link";
import type { getGestaoLearningPath } from "@/lib/gestao-courses";
import {
  AddPathCourseControl,
  RemovePathCourseControl,
} from "./path-course-membership-controls";
import { PathCourseOrderControl } from "./path-course-order-controls";

type LearningPathView = NonNullable<
  Awaited<ReturnType<typeof getGestaoLearningPath>>
>;

const statusLabels: Record<ContentStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

const pathHref = (
  pathId: string,
  values: {
    readonly page?: number;
    readonly candidatePage?: number;
    readonly query?: string;
    readonly addCourses?: boolean;
  }
) => {
  const search = new URLSearchParams();
  if (values.page && values.page > 1) {
    search.set("pagina", String(values.page));
  }
  if (values.candidatePage && values.candidatePage > 1) {
    search.set("paginaCurso", String(values.candidatePage));
  }
  if (values.query) {
    search.set("buscarCurso", values.query);
  }
  if (values.addCourses) {
    search.set("adicionar", "1");
  }
  const query = search.toString();
  return `/gestao/ensino/cursos/percursos/${pathId}${query ? `?${query}` : ""}`;
};

const CourseListPagination = ({
  path,
  showCoursePicker,
}: {
  readonly path: LearningPathView;
  readonly showCoursePicker: boolean;
}) =>
  path.totalPages > 1 ? (
    <nav
      aria-label="Paginação dos cursos do percurso"
      className="ge-course-pagination"
    >
      <span>
        Página {path.page} de {path.totalPages}
      </span>
      <div>
        {path.page > 1 ? (
          <Link
            href={pathHref(path.id, {
              page: path.page - 1,
              candidatePage: path.candidatePage,
              query: path.candidateQuery,
              addCourses: showCoursePicker,
            })}
          >
            Anterior
          </Link>
        ) : null}
        {path.page < path.totalPages ? (
          <Link
            href={pathHref(path.id, {
              page: path.page + 1,
              candidatePage: path.candidatePage,
              query: path.candidateQuery,
              addCourses: showCoursePicker,
            })}
          >
            Próxima
          </Link>
        ) : null}
      </div>
    </nav>
  ) : null;

const CourseList = ({ path }: { readonly path: LearningPathView }) => (
  <ol className="ge-path-course-list">
    {path.courses.map((course, index) => {
      const previousCourse =
        index > 0 ? path.courses[index - 1] : path.previousCourse;
      const nextCourse =
        index < path.courses.length - 1
          ? path.courses[index + 1]
          : path.nextCourse;
      const lessonCount = course.modules.reduce(
        (total, module) => total + module._count.lessons,
        0
      );
      return (
        <li key={course.id}>
          <span aria-hidden="true" className="ge-path-course-icon">
            <BookOpenIcon />
          </span>
          <Link
            aria-label={`${course.title} — ${course.modules.length} módulos e ${lessonCount} aulas`}
            href={`/gestao/ensino/cursos/${course.id}`}
            prefetch={false}
          >
            <strong>{course.title}</strong>
          </Link>
          <span
            className={`ge-status ge-status-${course.status.toLowerCase()}`}
          >
            {statusLabels[course.status]}
          </span>
          <fieldset className="ge-path-course-order">
            <legend className="sr-only">Ordem de {course.title}</legend>
            {previousCourse ? (
              <PathCourseOrderControl
                course={course}
                direction="up"
                neighbor={previousCourse}
                page={path.page}
                path={path}
              />
            ) : null}
            {nextCourse ? (
              <PathCourseOrderControl
                course={course}
                direction="down"
                neighbor={nextCourse}
                page={path.page}
                path={path}
              />
            ) : null}
          </fieldset>
          <RemovePathCourseControl
            course={course}
            page={path.page}
            path={path}
          />
        </li>
      );
    })}
  </ol>
);

const CandidatePagination = ({ path }: { readonly path: LearningPathView }) =>
  path.candidateTotalPages > 1 ? (
    <nav
      aria-label="Paginação dos cursos disponíveis"
      className="ge-course-pagination"
    >
      <span>
        Página {path.candidatePage} de {path.candidateTotalPages}
      </span>
      <div>
        {path.candidatePage > 1 ? (
          <Link
            href={pathHref(path.id, {
              page: path.page,
              candidatePage: path.candidatePage - 1,
              query: path.candidateQuery,
              addCourses: true,
            })}
          >
            Anterior
          </Link>
        ) : null}
        {path.candidatePage < path.candidateTotalPages ? (
          <Link
            href={pathHref(path.id, {
              page: path.page,
              candidatePage: path.candidatePage + 1,
              query: path.candidateQuery,
              addCourses: true,
            })}
          >
            Próxima
          </Link>
        ) : null}
      </div>
    </nav>
  ) : null;

const CoursePicker = ({
  path,
  open,
}: {
  readonly path: LearningPathView;
  readonly open: boolean;
}) => (
  <details className="ge-path-course-picker" id="adicionar-curso" open={open}>
    <summary>Adicionar curso ao percurso</summary>
    <div className="ge-path-course-picker-content">
      <form
        action={`/gestao/ensino/cursos/percursos/${encodeURIComponent(path.id)}`}
        className="ge-path-course-search"
        method="get"
      >
        {path.page > 1 ? (
          <input name="pagina" type="hidden" value={path.page} />
        ) : null}
        <input name="adicionar" type="hidden" value="1" />
        <label htmlFor="buscar-curso-percurso">Buscar curso</label>
        <div>
          <input
            autoComplete="off"
            defaultValue={path.candidateQuery}
            id="buscar-curso-percurso"
            maxLength={100}
            name="buscarCurso"
            placeholder="Digite o nome do curso"
            type="search"
          />
          <Button size="sm" type="submit" variant="outline">
            Buscar
          </Button>
        </div>
      </form>
      {path.candidateCourses.length ? (
        <ul className="ge-path-course-candidates">
          {path.candidateCourses.map((course) => (
            <li key={course.id}>
              <div>
                <strong>{course.title}</strong>
                <small>{statusLabels[course.status]}</small>
              </div>
              <AddPathCourseControl
                course={course}
                page={path.page}
                path={path}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="ge-path-course-empty">
          <p>
            {path.candidateQuery
              ? "Nenhum curso corresponde à busca."
              : "Não há cursos disponíveis para adicionar."}
          </p>
          <span>
            Cursos que já pertencem a outro percurso não aparecem aqui.
          </span>
        </div>
      )}
      <CandidatePagination path={path} />
    </div>
  </details>
);

export const PathCoursesPanel = ({
  path,
  showCoursePicker,
}: {
  readonly path: LearningPathView;
  readonly showCoursePicker: boolean;
}) => (
  <section
    aria-labelledby="path-content-heading"
    className="ge-path-course-panel"
  >
    <div className="ge-path-panel-heading">
      <div>
        <h2 id="path-content-heading">{path.title}</h2>
        {path.description ? <p>{path.description}</p> : null}
      </div>
      <span className={`ge-status ge-status-${path.status.toLowerCase()}`}>
        {statusLabels[path.status]}
      </span>
    </div>
    {path.courses.length ? (
      <CourseList path={path} />
    ) : (
      <div className="ge-path-course-empty">
        <p>Nenhum curso associado ainda.</p>
        <span>Adicione um curso existente ou crie um nesta jornada.</span>
      </div>
    )}
    <CourseListPagination path={path} showCoursePicker={showCoursePicker} />
    <CoursePicker open={showCoursePicker} path={path} />
    <Button asChild variant="outline">
      <Link
        href={`/gestao/ensino/cursos/novo?percurso=${encodeURIComponent(path.id)}`}
        prefetch={false}
      >
        Criar curso neste percurso
      </Link>
    </Button>
  </section>
);

export const PathEvidencePanel = ({
  path,
}: {
  readonly path: LearningPathView;
}) => {
  const published = path.status === ContentStatus.PUBLISHED;
  const evidenceSummary = published
    ? `${path.publishedCourseCount} de ${path.totalCourses} ${path.totalCourses === 1 ? "curso publicado" : "cursos publicados"} · visível para alunos`
    : `${path.totalCourses} ${path.totalCourses === 1 ? "curso" : "cursos"} · ainda não visível`;
  return (
    <section
      aria-labelledby="path-evidence-heading"
      className="ge-path-guidance ge-path-evidence"
    >
      <div className="ge-path-panel-heading">
        <h2 id="path-evidence-heading">Evidência avançada</h2>
        <span className={`ge-status ge-status-${path.status.toLowerCase()}`}>
          {statusLabels[path.status]}
        </span>
      </div>
      <p>{evidenceSummary}.</p>
    </section>
  );
};
