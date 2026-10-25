import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { YouTubePlaylistImport } from "@/components/gestao/youtube-playlist-import";
import { getAdminCourse } from "@/lib/admin-learning";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import {
  courseReadiness,
  getCourseAccessSummary,
} from "@/lib/gestao-course-readiness";
import { GestaoIcon } from "../../../../gestao-icon";
import { GestaoCourseHeader } from "../course-header";
import { CourseStatusButton } from "../course-status-button";
import { duplicateGestaoCourse } from "../structure-actions";

const stateCopy = {
  DRAFT: "Rascunho. Nenhum aluno vê este curso.",
  SCHEDULED: "Agendado.",
  PUBLISHED:
    "Publicado. Os alunos com acesso veem o curso e as aulas publicadas.",
  ARCHIVED:
    "Arquivado. Fora das listas dos alunos; progresso e acessos preservados.",
} as const;

const CoursePublicationPage = async ({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  await requireGestaoAction("content.manage", { contentId: id });
  const course = await getAdminCourse(id);
  if (!course) {
    notFound();
  }
  const access = await getCourseAccessSummary(course.id);
  const readiness = courseReadiness({
    access,
    course,
    lessons: course.modules.flatMap((module) => module.lessons),
  });
  return (
    <>
      <GestaoCourseHeader active="publicacao" course={course} />
      <div className="gk-cols gk-course-cols">
        <div className="gk-stack">
          <section className="gk-panel">
            <h2 className="gk-panel-title">Estado do curso</h2>
            <p className="gk-panel-copy">{stateCopy[course.status]}</p>
            <ul className="gk-ready">
              {readiness.map((item) => (
                <li data-state={item.state} key={item.key}>
                  <GestaoIcon
                    name={item.state === "ok" ? "check-circle" : "alert-circle"}
                    size={18}
                  />
                  <span>
                    {item.label}
                    {item.detail ? <small>{item.detail}</small> : null}
                  </span>
                </li>
              ))}
            </ul>
            <CourseStatusButton courseId={course.id} status={course.status} />
          </section>
          <section className="gk-panel" id="importar-youtube">
            <h2 className="gk-panel-title">Importar aulas do YouTube</h2>
            <p className="gk-panel-copy">
              Cria uma aula em rascunho por vídeo de uma lista de reprodução.
              Nada é publicado até você revisar.
            </p>
            <YouTubePlaylistImport
              courseId={course.id}
              courseStatus={course.status}
              initialIdempotencyKey={randomUUID()}
              modules={course.modules.map((module) => ({
                id: module.id,
                status: module.status,
                title: module.title,
              }))}
            />
          </section>
        </div>
        <aside className="gk-stack">
          <section className="gk-panel">
            <h2 className="gk-panel-title">Duplicar curso</h2>
            <p className="gk-panel-copy">
              Cria uma cópia em rascunho com módulos, aulas e materiais. Acessos
              e progresso não são copiados.
            </p>
            <form action={duplicateGestaoCourse}>
              <input name="courseId" type="hidden" value={course.id} />
              <button className="gk-btn" type="submit">
                Duplicar curso
              </button>
            </form>
          </section>
        </aside>
      </div>
    </>
  );
};

export default CoursePublicationPage;
