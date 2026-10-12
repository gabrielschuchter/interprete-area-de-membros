import { requireGestaoAction } from "@/lib/gestao-authorization";
import { GestaoPageHeading } from "../gestao-shell";

const GestaoStudentsPage = async () => {
  await requireGestaoAction("students.read");
  return (
    <section>
      <GestaoPageHeading
        description="Turmas, acompanhamento, correções, atribuições e metas coletivas."
        eyebrow="Gestão · Acompanhamento"
        title="Alunos"
      />
      <div className="gestao-empty-state">
        <h2>Turmas e acompanhamento</h2>
        <p>
          Nenhuma lista é carregada nesta etapa. O vínculo de alunos e o escopo
          do professor serão habilitados com o domínio de turmas.
        </p>
      </div>
    </section>
  );
};

export default GestaoStudentsPage;
