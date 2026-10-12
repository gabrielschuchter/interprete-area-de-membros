import { randomUUID } from "node:crypto";
import { ContentStatus } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGestaoLearningPath } from "@/lib/gestao-courses";
import { updateGestaoLearningPath } from "../actions";
import { LearningPathForm } from "../learning-path-form";
import { PathCourseOrderControl } from "../path-course-order-controls";
import { LearningPathStatusControls } from "../path-status-controls";

const statusLabels: Record<ContentStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

const statusMessageFor = (status: string | undefined) => {
  switch (status) {
    case "nao-confirmado":
      return "Marque a confirmação antes de alterar o estado.";
    case "conflito":
      return "O percurso mudou em outra aba. Recarregue e confira a versão atual.";
    case "nao-encontrado":
      return "Este percurso não existe mais.";
    case "erro":
      return "Não foi possível alterar o estado agora. Tente novamente.";
    case "ordem-nao-confirmada":
      return "Confirme a alteração da ordem para os alunos antes de continuar.";
    case "ordem-conflito":
      return "A lista de cursos mudou em outra aba. Atualize e confira a ordem atual.";
    case "ordem-erro":
      return "Não foi possível alterar a ordem agora. Tente novamente.";
    default:
      return null;
  }
};

const GestaoLearningPathPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ pathId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const [{ pathId }, query] = await Promise.all([params, searchParams]);
  const pageValue = Array.isArray(query.pagina)
    ? query.pagina[0]
    : query.pagina;
  const path = await getGestaoLearningPath(pathId, pageValue);
  if (!path) {
    notFound();
  }
  const statusResult = Array.isArray(query.estado)
    ? query.estado[0]
    : query.estado;
  const message = statusMessageFor(statusResult);

  return (
    <section className="ge-courses-page ge-path-editor-page">
      <nav aria-label="Caminho da página" className="ge-path-breadcrumbs">
        <Link href="/gestao/ensino/cursos?aba=percursos">
          Cursos e percursos
        </Link>
        <span aria-hidden="true">/</span>
        <span>{path.title}</span>
      </nav>
      <header className="ge-courses-heading">
        <div>
          <p className="ge-courses-eyebrow">Gestão · Ensino · /{path.slug}</p>
          <h1>{path.title}</h1>
          <p>
            {path.totalCourses} cursos nesta jornada · atualizado em{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "America/Sao_Paulo",
            }).format(path.updatedAt)}
          </p>
        </div>
        <div className="ge-path-title-actions">
          <span className={`ge-status ge-status-${path.status.toLowerCase()}`}>
            {statusLabels[path.status]}
          </span>
          <Button asChild variant="outline">
            <Link href="/gestao/ensino/cursos?aba=percursos">
              Voltar aos percursos
            </Link>
          </Button>
        </div>
      </header>
      {message ? (
        <output aria-live="polite" className="ge-path-feedback">
          {message}
        </output>
      ) : null}
      <div className="ge-path-editor-layout">
        <section
          aria-labelledby="path-content-heading"
          className="ge-path-panel"
        >
          <div className="ge-path-panel-heading">
            <h2 id="path-content-heading">Identidade do percurso</h2>
            <p>Edite o título, o endereço e a apresentação da jornada.</p>
          </div>
          <LearningPathForm
            action={updateGestaoLearningPath}
            idempotencyKey={randomUUID()}
            path={{
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
        <aside className="ge-path-course-panel">
          <div className="ge-path-panel-heading">
            <h2>Cursos da jornada</h2>
            <p>Os cursos associados aparecem na ordem definida por posição.</p>
          </div>
          {path.courses.length ? (
            <ol className="ge-path-course-list">
              {path.courses.map((course, index) => {
                const previousCourse =
                  index > 0 ? path.courses[index - 1] : path.previousCourse;
                const nextCourse =
                  index < path.courses.length - 1
                    ? path.courses[index + 1]
                    : path.nextCourse;
                const moduleCount = course.modules.length;
                const lessonCount = course.modules.reduce(
                  (total, module) => total + module._count.lessons,
                  0
                );
                return (
                  <li key={course.id}>
                    <span className="ge-path-course-number">
                      {String(
                        (path.page - 1) * path.pageSize + index + 1
                      ).padStart(2, "0")}
                    </span>
                    <Link
                      href={`/gestao/ensino/cursos/${course.id}`}
                      prefetch={false}
                    >
                      <strong>{course.title}</strong>
                      <small>
                        {moduleCount} módulos · {lessonCount} aulas ·{" "}
                        {statusLabels[course.status]}
                      </small>
                    </Link>
                    <fieldset className="ge-path-course-order">
                      <legend className="sr-only">
                        Ordem de {course.title}
                      </legend>
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
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="ge-path-course-empty">
              <p>Nenhum curso associado ainda.</p>
              <span>Abra o editor de curso e escolha este percurso.</span>
            </div>
          )}
          {path.totalPages > 1 ? (
            <nav
              aria-label="Paginação dos cursos do percurso"
              className="ge-course-pagination"
            >
              <span>
                Página {path.page} de {path.totalPages}
              </span>
              <div>
                {path.page > 1 ? (
                  <Link href={`?pagina=${path.page - 1}`}>Anterior</Link>
                ) : null}
                {path.page < path.totalPages ? (
                  <Link href={`?pagina=${path.page + 1}`}>Próxima</Link>
                ) : null}
              </div>
            </nav>
          ) : null}
          <Button asChild variant="outline">
            <Link
              href={`/gestao/ensino/cursos/novo?percurso=${encodeURIComponent(path.id)}`}
            >
              Criar curso neste percurso
            </Link>
          </Button>
        </aside>
      </div>
    </section>
  );
};

export default GestaoLearningPathPage;
