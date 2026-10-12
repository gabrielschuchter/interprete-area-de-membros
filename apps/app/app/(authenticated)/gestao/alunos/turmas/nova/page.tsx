import { requireGestaoActor } from "@/lib/gestao-authorization";
import { getGestaoTeacherOptions } from "@/lib/gestao-cohorts";
import { GestaoPageHeading } from "../../../gestao-shell";
import { GestaoCohortForm } from "../cohort-form";

const NewGestaoCohortPage = async () => {
  const actor = await requireGestaoActor();
  const teachers =
    actor.role === "ADMIN" ? await getGestaoTeacherOptions() : [];
  return (
    <section className="gt-page gt-new-page">
      <GestaoPageHeading
        description="Defina a regra de entrada agora; você poderá vincular cursos e alunos depois."
        eyebrow="Gestão · Alunos · Turmas"
        title="Nova turma"
      />
      <GestaoCohortForm isAdmin={actor.role === "ADMIN"} teachers={teachers} />
    </section>
  );
};
export default NewGestaoCohortPage;
