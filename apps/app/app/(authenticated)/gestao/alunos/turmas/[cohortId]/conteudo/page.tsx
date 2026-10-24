import Link from "next/link";
import { notFound } from "next/navigation";
import { getGestaoCohortTimeline } from "@/lib/gestao-cohort-timeline";
import {
  getGestaoCohortDetail,
  listGestaoAssignableCohorts,
  listGestaoCohortLessonsForRelease,
  listPublishedCoursesForCohort,
} from "@/lib/gestao-cohorts";
import { CohortCourseEditor } from "../cohort-course-editor";
import { GestaoCohortHeader } from "../cohort-header";
import { CohortLessonReleaseEditor } from "../cohort-lesson-release-editor";
import { AddToCohortMenu, CopyContentButton } from "./content-actions";
import { CohortTimeline } from "./timeline";

const GestaoCohortContentPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ cohortId: string }>;
  readonly searchParams: Promise<{ visao?: string }>;
}) => {
  const [{ cohortId }, query] = await Promise.all([params, searchParams]);
  const coursesView = query.visao === "cursos";
  const [cohort, courses, lessons, timeline, sources] = await Promise.all([
    getGestaoCohortDetail(cohortId),
    listPublishedCoursesForCohort(cohortId),
    listGestaoCohortLessonsForRelease(cohortId),
    getGestaoCohortTimeline(cohortId),
    listGestaoAssignableCohorts({ page: 1 }),
  ]);
  if (!(cohort && courses && lessons)) {
    notFound();
  }
  const base = `/gestao/alunos/turmas/${cohortId}/conteudo`;
  const archived = cohort.archivedAt !== null;
  return (
    <section className="gt-page gt-detail-page">
      <GestaoCohortHeader activeTab="conteudo" cohort={cohort} />
      <div className="gk-toolbar">
        <fieldset className="gk-segmented">
          <legend className="sr-only">Visão do conteúdo</legend>
          <Link aria-pressed={!coursesView} href={base}>
            Cronograma
          </Link>
          <Link aria-pressed={coursesView} href={`${base}?visao=cursos`}>
            Cursos liberados
          </Link>
        </fieldset>
        <div className="gk-toolbar-group">
          <CopyContentButton
            archived={archived}
            cohortId={cohortId}
            expectedVersion={cohort.version}
            sources={sources.cohorts
              .filter((item) => item.id !== cohortId)
              .map(({ id, name }) => ({ id, name }))}
          />
          <AddToCohortMenu cohortId={cohortId} />
        </div>
      </div>
      {coursesView ? (
        <>
          <CohortCourseEditor
            archived={archived}
            cohortId={cohortId}
            courses={courses}
            currentAccesses={cohort.courseAccesses}
            expectedVersion={cohort.version}
            key={`courses:${cohortId}:${cohort.version}`}
          />
          <CohortLessonReleaseEditor
            archived={archived}
            cohortId={cohortId}
            expectedVersion={cohort.version}
            key={`lessons:${cohortId}:${cohort.version}`}
            lessons={lessons}
          />
        </>
      ) : null}
      {coursesView || timeline.total > 0 ? null : (
        <div className="gk-panel">
          <h2 className="gk-panel-title">O cronograma está vazio</h2>
          <p className="gk-empty">
            Libere cursos, agende encontros ou publique atividades com prazo
            para esta turma. Eles aparecem aqui, organizados por semana.
          </p>
        </div>
      )}
      {coursesView ? null : <CohortTimeline weeks={timeline.weeks} />}
    </section>
  );
};
export default GestaoCohortContentPage;
