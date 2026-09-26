import { database } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import { getStaffActivities } from "@/lib/activities";
import { getCourseOptions } from "@/lib/admin-learning";

const statusLabel = (status: string) => {
  if (status === "PUBLISHED") {
    return "Publicado";
  }
  if (status === "ARCHIVED") {
    return "Arquivado";
  }
  return "Rascunho";
};

import {
  createActivity,
  saveFeedback,
  setActivityStatus,
  updateActivity,
} from "../../atividades/actions";

const AdminActivitiesPage = async () => {
  const [activities, courses, members] = await Promise.all([
    getStaffActivities(),
    getCourseOptions(),
    database.member.findMany({
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, email: true },
      take: 200,
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4"
        href="/admin"
      >
        ← Área do professor
      </Link>
      <header className="mt-10 max-w-3xl">
        <p className="brand-eyebrow">Professor · prática</p>
        <h1 className="mt-4 font-display text-5xl leading-none">
          Uma pergunta continua depois da aula.
        </h1>
        <p className="mt-5 text-muted-foreground leading-7">
          Publique uma proposta, leia as respostas e devolva feedback que ajude
          o raciocínio a avançar.
        </p>
      </header>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section>
          <h2 className="border-border border-b pb-3 font-display text-3xl">
            Atividades e envios
          </h2>
          <div className="mt-5 grid gap-5">
            {activities.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma atividade criada.</p>
            ) : (
              activities.map((activity) => (
                <article className="paper-surface border p-6" key={activity.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Badge
                        variant={
                          activity.status === "PUBLISHED"
                            ? "default"
                            : "outline"
                        }
                      >
                        {statusLabel(activity.status)}
                      </Badge>
                      <h3 className="mt-3 font-display text-2xl">
                        {activity.title}
                      </h3>
                      <p className="mt-2 text-muted-foreground leading-6">
                        {activity.prompt}
                      </p>
                      {(activity.course || activity.lesson) && (
                        <p className="mt-2 text-muted-foreground text-sm">
                          {activity.course?.title}
                          {activity.lesson ? ` · ${activity.lesson.title}` : ""}
                        </p>
                      )}
                    </div>
                    <span className="font-data text-muted-foreground text-xs">
                      {activity.submissions.length} envios ·{" "}
                      {activity.assignments.length} atribuídos
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {activity.status !== "PUBLISHED" && (
                      <form action={setActivityStatus}>
                        <input
                          name="activityId"
                          type="hidden"
                          value={activity.id}
                        />
                        <input name="status" type="hidden" value="PUBLISHED" />
                        <Button size="sm" type="submit">
                          Publicar atividade
                        </Button>
                      </form>
                    )}
                    {activity.status === "PUBLISHED" && (
                      <form action={setActivityStatus}>
                        <input
                          name="activityId"
                          type="hidden"
                          value={activity.id}
                        />
                        <input name="status" type="hidden" value="ARCHIVED" />
                        <Button size="sm" type="submit" variant="outline">
                          Arquivar atividade
                        </Button>
                      </form>
                    )}
                  </div>
                  <details className="mt-5 border-border border-t pt-4">
                    <summary className="cursor-pointer text-muted-foreground text-sm underline underline-offset-4">
                      Editar atividade
                    </summary>
                    <form action={updateActivity} className="mt-4 grid gap-3">
                      <input
                        name="activityId"
                        type="hidden"
                        value={activity.id}
                      />
                      <Input
                        defaultValue={activity.title}
                        name="title"
                        required
                      />
                      <Input
                        defaultValue={activity.slug}
                        name="slug"
                        required
                      />
                      <Textarea
                        defaultValue={activity.prompt}
                        name="prompt"
                        required
                      />
                      <Textarea
                        defaultValue={activity.instructions ?? ""}
                        name="instructions"
                        placeholder="Instruções"
                      />
                      <Input
                        defaultValue={
                          activity.dueAt?.toISOString().slice(0, 16) ?? ""
                        }
                        name="dueAt"
                        type="datetime-local"
                      />
                      <select
                        className="h-11 rounded-sm border bg-transparent px-3 text-sm"
                        defaultValue={activity.courseId ?? ""}
                        name="courseId"
                      >
                        <option value="">Nenhum curso</option>
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.title}
                          </option>
                        ))}
                      </select>
                      <label className="block">
                        <span className="brand-eyebrow">
                          Membros atribuídos
                        </span>
                        <textarea
                          className="mt-2 min-h-20 w-full rounded-sm border bg-background px-3 py-2 text-sm"
                          defaultValue={activity.assignments
                            .map((assignment) => assignment.memberId)
                            .join(", ")}
                          name="memberIds"
                          placeholder="IDs Clerk separados por vírgula"
                        />
                      </label>
                      <select
                        className="h-11 rounded-sm border bg-transparent px-3 text-sm"
                        defaultValue={activity.lessonId ?? ""}
                        name="lessonId"
                      >
                        <option value="">Nenhuma aula</option>
                        {courses.flatMap((course) =>
                          course.modules.flatMap((module) =>
                            module.lessons.map((lesson) => (
                              <option key={lesson.id} value={lesson.id}>
                                {course.title} · {lesson.title}
                              </option>
                            ))
                          )
                        )}
                      </select>
                      <div className="flex justify-end">
                        <Button size="sm" type="submit">
                          Salvar alterações
                        </Button>
                      </div>
                    </form>
                  </details>
                  {activity.submissions.length > 0 && (
                    <div className="mt-6 divide-y border-border border-y">
                      {activity.submissions.map((submission) => (
                        <div
                          className="py-5"
                          id={submission.id}
                          key={submission.id}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="brand-eyebrow">
                              Membro · {submission.status}
                            </p>
                            {submission.feedback && (
                              <Badge variant="outline">Feedback enviado</Badge>
                            )}
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                            {submission.content}
                          </p>
                          <form
                            action={saveFeedback}
                            className="mt-4 grid gap-3"
                          >
                            <input
                              name="submissionId"
                              type="hidden"
                              value={submission.id}
                            />
                            <Textarea
                              className="min-h-24"
                              defaultValue={submission.feedback?.content ?? ""}
                              name="content"
                              placeholder="Escreva uma orientação breve e concreta..."
                              required
                            />
                            <div className="flex justify-end">
                              <Button size="sm" type="submit">
                                Salvar feedback
                              </Button>
                            </div>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
        <aside className="paper-surface border p-6 lg:sticky lg:top-24">
          <p className="brand-eyebrow">Nova prática</p>
          <form action={createActivity} className="mt-5 space-y-4">
            <label className="block" htmlFor="activity-title">
              <span className="brand-eyebrow">Título</span>
              <Input
                className="mt-2"
                id="activity-title"
                name="title"
                required
              />
            </label>
            <label className="block" htmlFor="activity-slug">
              <span className="brand-eyebrow">Slug</span>
              <Input className="mt-2" id="activity-slug" name="slug" required />
            </label>
            <label className="block" htmlFor="activity-prompt">
              <span className="brand-eyebrow">Pergunta</span>
              <Textarea
                className="mt-2 min-h-32"
                id="activity-prompt"
                name="prompt"
                required
              />
            </label>
            <label className="block" htmlFor="activity-instructions">
              <span className="brand-eyebrow">Instruções</span>
              <Textarea
                className="mt-2 min-h-24"
                id="activity-instructions"
                name="instructions"
              />
            </label>
            <label className="block" htmlFor="activity-due-at">
              <span className="brand-eyebrow">Prazo (opcional)</span>
              <Input
                className="mt-2"
                id="activity-due-at"
                name="dueAt"
                type="datetime-local"
              />
            </label>
            <label className="block" htmlFor="activity-course">
              <span className="brand-eyebrow">
                Curso relacionado (opcional)
              </span>
              <select
                className="mt-2 h-11 w-full rounded-sm border bg-transparent px-3 text-sm"
                defaultValue=""
                id="activity-course"
                name="courseId"
              >
                <option value="">Nenhum curso</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block" htmlFor="activity-lesson">
              <span className="brand-eyebrow">Aula relacionada (opcional)</span>
              <select
                className="mt-2 h-11 w-full rounded-sm border bg-transparent px-3 text-sm"
                defaultValue=""
                id="activity-lesson"
                name="lessonId"
              >
                <option value="">Nenhuma aula</option>
                {courses.flatMap((course) =>
                  course.modules.flatMap((module) =>
                    module.lessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        {course.title} · {lesson.title}
                      </option>
                    ))
                  )
                )}
              </select>
            </label>
            <label className="block" htmlFor="activity-member-ids">
              <span className="brand-eyebrow">
                Atribuir a membros (opcional)
              </span>
              <textarea
                className="mt-2 min-h-20 w-full rounded-sm border bg-background px-3 py-2 text-sm"
                id="activity-member-ids"
                name="memberIds"
                placeholder={members
                  .slice(0, 3)
                  .map((member) => member.id)
                  .join(", ")}
              />
              <span className="mt-2 block text-muted-foreground text-xs">
                Use IDs Clerk separados por vírgula. Membros disponíveis:{" "}
                {members.length}.
              </span>
            </label>
            <Button className="w-full" type="submit">
              Salvar como rascunho
            </Button>
          </form>
        </aside>
      </div>
    </main>
  );
};

export default AdminActivitiesPage;
