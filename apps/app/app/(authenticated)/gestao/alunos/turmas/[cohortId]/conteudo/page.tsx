import { notFound } from "next/navigation";
import {
  getGestaoCohortDetail,
  listGestaoCohortLessonsForRelease,
  listPublishedCoursesForCohort,
} from "@/lib/gestao-cohorts";
import { CohortCourseEditor } from "../cohort-course-editor";
import { GestaoCohortHeader } from "../cohort-header";
import { CohortLessonReleaseEditor } from "../cohort-lesson-release-editor";

const GestaoCohortContentPage = async ({
  params,
}: {
  readonly params: Promise<{ cohortId: string }>;
}) => {
  const { cohortId } = await params;
  const [cohort, courses, lessons] = await Promise.all([
    getGestaoCohortDetail(cohortId),
    listPublishedCoursesForCohort(cohortId),
    listGestaoCohortLessonsForRelease(cohortId),
  ]);
  if (!(cohort && courses && lessons)) {
    notFound();
  }
  return (
    <section className="gt-page gt-detail-page">
      <GestaoCohortHeader activeTab="conteudo" cohort={cohort} />
      <section className="gt-panel gt-content-intro">
        <h2>Conteúdo e cronograma</h2>
        <p>
          Os cursos são liberados para a turma inteira. O acesso é calculado em
          tempo real a partir da matrícula, das datas de liberação e do período
          da turma.
        </p>
      </section>
      <CohortCourseEditor
        archived={cohort.archivedAt !== null}
        cohortId={cohortId}
        courses={courses}
        currentAccesses={cohort.courseAccesses}
        expectedVersion={cohort.version}
        key={`${cohortId}:${cohort.version}`}
      />
      <CohortLessonReleaseEditor
        archived={cohort.archivedAt !== null}
        cohortId={cohortId}
        expectedVersion={cohort.version}
        key={`${cohortId}:${cohort.version}`}
        lessons={lessons}
      />
    </section>
  );
};
export default GestaoCohortContentPage;
