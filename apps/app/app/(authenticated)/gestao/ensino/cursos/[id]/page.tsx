import { randomUUID } from "node:crypto";
import { database } from "@repo/database";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LazyYouTubePlaylistImport } from "@/components/gestao/lazy-youtube-playlist-import";
import { getAdminCourse } from "@/lib/admin-learning";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import {
  courseReadiness,
  getCourseAccessSummary,
} from "@/lib/gestao-course-readiness";
import { GestaoIcon } from "../../../gestao-icon";
import { GestaoCourseHeader } from "./course-header";
import { CourseStatusButton } from "./course-status-button";
import { ModuleShell } from "./module-shell";
import { DragHandle, SortableGroup } from "./sortable";
import {
  AddLessonRow,
  AddModuleRow,
  StructureMenu,
} from "./structure-controls";

const kindIcon = {
  VIDEO: "video",
  MIXED: "play-circle",
  READING: "file",
  TEXT: "file",
  MATERIAL: "file",
} as const;
const kindLabel = {
  VIDEO: "Vídeo",
  MIXED: "Vídeo e leitura",
  READING: "Leitura",
  TEXT: "Texto",
  MATERIAL: "Material",
} as const;
const statusChip = {
  DRAFT: { label: "Rascunho", icon: "pencil", tone: "neutral" },
  SCHEDULED: { label: "Agendado", icon: "clock", tone: "warn" },
  PUBLISHED: { label: "Publicado", icon: "check-circle", tone: "active" },
  ARCHIVED: { label: "Arquivado", icon: "archive", tone: "neutral" },
} as const;

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const lessonMeta = (lesson: {
  readonly assets: readonly { readonly durationSeconds: number | null }[];
  readonly kind: keyof typeof kindLabel;
  readonly resources: readonly unknown[];
}) => {
  const seconds = lesson.assets.reduce(
    (total, asset) => total + (asset.durationSeconds ?? 0),
    0
  );
  const parts: string[] = [];
  if (lesson.kind !== "VIDEO") {
    parts.push(kindLabel[lesson.kind]);
  }
  if (seconds > 0) {
    parts.push(`${Math.max(1, Math.round(seconds / 60))} min`);
  }
  parts.push(
    lesson.resources.length > 0
      ? plural(lesson.resources.length, "material", "materiais")
      : "sem materiais"
  );
  return parts.join(" · ");
};

const GestaoCourseEditorPage = async ({
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
  const lessons = course.modules.flatMap((module) => module.lessons);
  const [access, exercises] = await Promise.all([
    getCourseAccessSummary(course.id),
    database.lessonResource.count({
      where: { lesson: { module: { courseId: course.id } } },
    }),
  ]);
  const readiness = courseReadiness({ access, course, lessons });
  const ready = readiness.every((item) => item.state === "ok");
  let lessonNumber = 0;

  return (
    <>
      <GestaoCourseHeader active="conteudo" course={course} />
      <div className="gk-cols gk-course-cols">
        <div className="gk-stack">
          {course.modules.length === 0 ? (
            <section className="gk-panel">
              <h2 className="gk-panel-title">
                Este curso ainda não tem módulos
              </h2>
              <p className="gk-empty">
                Crie o primeiro módulo para começar a organizar as aulas.
              </p>
            </section>
          ) : null}
          <SortableGroup
            className="gk-stack"
            kind="module"
            parentId={course.id}
          >
            {course.modules.map((module, moduleIndex) => (
              <ModuleShell
                actions={
                  <StructureMenu
                    canMoveDown={moduleIndex < course.modules.length - 1}
                    canMoveUp={moduleIndex > 0}
                    id={module.id}
                    kind="module"
                    moduleDescription={module.description}
                    moduleTitle={module.title}
                    status={module.status}
                    title={module.title}
                  />
                }
                count={plural(module.lessons.length, "aula", "aulas")}
                key={module.id}
                sortId={module.id}
                title={`Módulo ${moduleIndex + 1} · ${module.title}`}
              >
                <SortableGroup
                  as="ul"
                  className="gk-course-lessons"
                  kind="lesson"
                  parentId={module.id}
                >
                  {module.lessons.map((lesson, lessonIndex) => {
                    lessonNumber += 1;
                    const chip = statusChip[lesson.status];
                    const editHref = `/gestao/ensino/cursos/${course.id}/aulas/${lesson.id}`;
                    return (
                      <li
                        data-sort-id={lesson.id}
                        data-sort-kind="lesson"
                        key={lesson.id}
                      >
                        <DragHandle label="Arrastar para reordenar a aula" />
                        <span className="gk-course-kind">
                          <GestaoIcon name={kindIcon[lesson.kind]} size={18} />
                        </span>
                        <div className="gk-course-lesson-copy">
                          <Link href={editHref} prefetch={false}>
                            {lessonNumber}. {lesson.title}
                          </Link>
                          <small>{lessonMeta(lesson)}</small>
                        </div>
                        <span className="gk-chip" data-tone={chip.tone}>
                          <GestaoIcon name={chip.icon} size={12} />
                          {chip.label}
                        </span>
                        <Link
                          aria-label={`Editar a aula ${lesson.title}`}
                          className="gk-icon-btn gk-icon-btn--bare"
                          href={editHref}
                          prefetch={false}
                        >
                          <GestaoIcon name="pencil" size={16} />
                        </Link>
                        <StructureMenu
                          canMoveDown={lessonIndex < module.lessons.length - 1}
                          canMoveUp={lessonIndex > 0}
                          editHref={editHref}
                          id={lesson.id}
                          kind="lesson"
                          status={lesson.status}
                          title={lesson.title}
                        />
                      </li>
                    );
                  })}
                </SortableGroup>
                <AddLessonRow courseId={course.id} moduleId={module.id} />
              </ModuleShell>
            ))}
          </SortableGroup>
          <AddModuleRow courseId={course.id} />
          {course.modules.length > 0 ? (
            <div className="gk-course-yt">
              <p>Tem uma lista de reprodução no YouTube?</p>
              <LazyYouTubePlaylistImport
                courseId={course.id}
                courseStatus={course.status}
                initialIdempotencyKey={randomUUID()}
                modules={course.modules.map((module) => ({
                  id: module.id,
                  status: module.status,
                  title: module.title,
                }))}
              />
            </div>
          ) : null}
        </div>
        <aside className="gk-stack">
          <section className="gk-panel">
            <h2 className="gk-panel-title">
              {course.status === "PUBLISHED"
                ? "Estado da publicação"
                : "Pronto para publicar?"}
            </h2>
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
            {course.status === "PUBLISHED" ? null : (
              <CourseStatusButton courseId={course.id} status={course.status} />
            )}
            {course.status !== "PUBLISHED" && !ready ? (
              <p className="gk-panel-copy">
                Você pode publicar com pendências: aulas em rascunho continuam
                ocultas dos alunos.
              </p>
            ) : null}
          </section>
          <section className="gk-panel">
            <h2 className="gk-panel-title">Resumo</h2>
            <p className="gk-course-summary">
              {plural(course.modules.length, "módulo", "módulos")} ·{" "}
              {plural(lessons.length, "aula", "aulas")}
              <br />
              {plural(course._count.activities, "atividade", "atividades")}
              <br />
              {plural(exercises, "material", "materiais")} nas aulas
            </p>
          </section>
        </aside>
      </div>
    </>
  );
};

export default GestaoCourseEditorPage;
