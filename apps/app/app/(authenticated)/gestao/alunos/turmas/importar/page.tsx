import { requireGestaoActor } from "@/lib/gestao-authorization";
import {
  getGestaoTeacherOptions,
  listGestaoPublishedCourses,
} from "@/lib/gestao-cohorts";
import { CohortWizard } from "../cohort-wizard";
import GestaoCohortsPage from "../page";

const ImportGestaoCohortPage = async () => {
  const actor = await requireGestaoActor();
  const [teachers, courses] = await Promise.all([
    getGestaoTeacherOptions(),
    listGestaoPublishedCourses(),
  ]);
  return (
    <>
      <GestaoCohortsPage searchParams={Promise.resolve({})} />
      <CohortWizard
        actorId={actor.userId}
        actorName={actor.displayName ?? "Você"}
        courses={courses}
        initialStudentMode="csv"
        isAdmin={actor.role === "ADMIN"}
        teachers={teachers}
      />
    </>
  );
};
export default ImportGestaoCohortPage;
