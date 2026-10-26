import { randomUUID } from "node:crypto";
import { ContentStatus } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getGestaoLearningPath,
  getGestaoLearningPathCoverOptions,
  listGestaoLearningPaths,
} from "@/lib/gestao-courses";
import { updateGestaoLearningPath } from "../actions";
import { LearningPathForm } from "../learning-path-form";
import { OtherPathsPanel, PathCoursesPanel } from "../path-course-panels";
import { LearningPathStatusControls } from "../path-status-controls";

type QueryValue = string | string[] | undefined;
type LearningPathView = NonNullable<
  Awaited<ReturnType<typeof getGestaoLearningPath>>
>;

const firstQueryValue = (value: QueryValue) =>
  Array.isArray(value) ? value[0] : value;

const statusMessageFor = (status: string | undefined) => {
  const messages: Record<string, string> = {
    "nao-confirmado": "Marque a confirmação antes de alterar o estado.",
    conflito:
      "O percurso mudou em outra aba. Recarregue e confira a versão atual.",
    "nao-encontrado": "Este percurso não existe mais.",
    erro: "Não foi possível alterar o estado agora. Tente novamente.",
    "ordem-nao-confirmada":
      "Confirme a alteração da ordem para os alunos antes de continuar.",
    "ordem-conflito":
      "A lista de cursos mudou em outra aba. Atualize e confira a ordem atual.",
    "ordem-erro": "Não foi possível alterar a ordem agora. Tente novamente.",
    "associacao-nao-confirmada":
      "Confirme a inclusão ou remoção imediata para os alunos.",
    "associacao-conflito":
      "O percurso ou curso mudou em outra aba. Atualize e tente novamente.",
    "associacao-erro":
      "Não foi possível atualizar os cursos do percurso agora.",
  };
  return status ? (messages[status] ?? null) : null;
};

const PathDetailsPanel = ({
  coverOptions,
  path,
}: {
  readonly coverOptions: Awaited<
    ReturnType<typeof getGestaoLearningPathCoverOptions>
  >;
  readonly path: LearningPathView;
}) => (
  <aside className="ge-path-details-column">
    <section aria-labelledby="path-details-heading" className="ge-path-panel">
      <div className="ge-path-panel-heading">
        <h2 id="path-details-heading">Detalhes do percurso</h2>
      </div>
      <LearningPathForm
        action={updateGestaoLearningPath}
        coverOptions={coverOptions}
        idempotencyKey={randomUUID()}
        path={{
          coverUrl: path.coverUrl,
          description: path.description,
          id: path.id,
          page: path.page,
          published: path.status === ContentStatus.PUBLISHED,
          slug: path.slug,
          title: path.title,
          updatedAt: path.updatedAt.toISOString(),
        }}
      />
      <div className="ge-path-status-section">
        <div className="ge-path-panel-heading">
          <h2>Publicação</h2>
          <p>
            Confirme cada mudança. Retirar do ar ou arquivar interrompe a
            descoberta do percurso pelos alunos.
          </p>
        </div>
        <LearningPathStatusControls page={path.page} path={path} />
      </div>
    </section>
  </aside>
);

const GestaoLearningPathPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ pathId: string }>;
  readonly searchParams: Promise<Record<string, QueryValue>>;
}) => {
  const [{ pathId }, query] = await Promise.all([params, searchParams]);
  const pageValue = firstQueryValue(query.pagina);
  const candidateQuery = firstQueryValue(query.buscarCurso);
  const candidatePage = firstQueryValue(query.paginaCurso);
  const showCoursePicker = firstQueryValue(query.adicionar) === "1";
  const statusResult = firstQueryValue(query.estado);
  const [path, coverOptions, catalog] = await Promise.all([
    getGestaoLearningPath(pathId, pageValue, candidateQuery, candidatePage),
    getGestaoLearningPathCoverOptions(),
    listGestaoLearningPaths({}),
  ]);
  if (!path) {
    notFound();
  }
  const message = statusMessageFor(statusResult);
  return (
    <section className="ge-courses-page ge-path-editor-page">
      <header className="ge-courses-heading">
        <div>
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
            <Link href="/gestao/ensino/cursos/novo">Novo curso</Link>
          </Button>
        </div>
      </header>
      <nav aria-label="Tipo de conteúdo" className="ge-content-tabs">
        <Link href="/gestao/ensino/cursos">Cursos</Link>
        <Link
          aria-current="page"
          data-active="true"
          href="/gestao/ensino/cursos?aba=percursos"
        >
          Percursos
        </Link>
      </nav>
      {message ? (
        <output aria-live="polite" className="ge-path-feedback">
          {message}
        </output>
      ) : null}
      <div className="ge-path-editor-layout">
        <div className="ge-path-primary-column">
          <PathCoursesPanel path={path} showCoursePicker={showCoursePicker} />
          <OtherPathsPanel currentId={path.id} paths={catalog.paths} />
        </div>
        <PathDetailsPanel coverOptions={coverOptions} path={path} />
      </div>
    </section>
  );
};

export default GestaoLearningPathPage;
