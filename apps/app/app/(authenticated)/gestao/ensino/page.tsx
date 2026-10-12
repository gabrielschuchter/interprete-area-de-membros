import { requireGestaoAction } from "@/lib/gestao-authorization";
import { GestaoPageHeading } from "../gestao-shell";

const GestaoTeachingPage = async () => {
  await requireGestaoAction("content.manage");
  return (
    <section>
      <GestaoPageHeading
        description="Cursos, percursos, exercícios, atividades, biblioteca e coleções."
        eyebrow="Gestão · Conteúdo pedagógico"
        title="Ensino"
      />
      <div className="gestao-empty-state">
        <h2>Conteúdos pedagógicos</h2>
        <p>
          Esta área está conectada ao conteúdo existente. As listas, editores e
          publicações serão liberados nesta etapa de implementação.
        </p>
      </div>
    </section>
  );
};

export default GestaoTeachingPage;
