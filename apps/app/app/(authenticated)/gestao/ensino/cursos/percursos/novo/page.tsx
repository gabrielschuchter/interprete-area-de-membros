import { randomUUID } from "node:crypto";
import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { getGestaoLearningPathCoverOptions } from "@/lib/gestao-courses";
import { createGestaoLearningPath } from "../actions";
import { LearningPathForm } from "../learning-path-form";

const NewGestaoLearningPathPage = async () => {
  await requireGestaoAction("content.manage");
  const coverOptions = await getGestaoLearningPathCoverOptions();
  const idempotencyKey = randomUUID();
  return (
    <section className="ge-courses-page ge-path-editor-page">
      <nav aria-label="Caminho da página" className="ge-path-breadcrumbs">
        <Link href="/gestao/ensino/cursos?aba=percursos">
          Cursos e percursos
        </Link>
        <span aria-hidden="true">/</span>
        <span>Novo percurso</span>
      </nav>
      <header className="ge-courses-heading">
        <div>
          <p className="ge-courses-eyebrow">Gestão · Ensino</p>
          <h1>Novo percurso</h1>
          <p>Organize cursos em uma jornada que faça sentido para o aluno.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/gestao/ensino/cursos?aba=percursos">Cancelar</Link>
        </Button>
      </header>
      <div className="ge-path-editor-layout">
        <section
          aria-labelledby="path-content-heading"
          className="ge-path-panel"
        >
          <div className="ge-path-panel-heading">
            <h2 id="path-content-heading">Identidade do percurso</h2>
            <p>
              O percurso será salvo como rascunho e só aparecerá ao aluno após
              publicação.
            </p>
          </div>
          <LearningPathForm
            action={createGestaoLearningPath}
            coverOptions={coverOptions}
            idempotencyKey={idempotencyKey}
          />
        </section>
        <aside className="ge-path-guidance">
          <span className="ge-course-card-path">Antes de publicar</span>
          <h2>Monte a jornada pelos cursos</h2>
          <p>
            Depois de salvar, associe cursos pelo editor de cada curso e defina
            a ordem da jornada no painel do percurso.
          </p>
          <p>
            Rascunhos ficam visíveis somente para pessoas com acesso à Gestão.
          </p>
        </aside>
      </div>
    </section>
  );
};

export default NewGestaoLearningPathPage;
