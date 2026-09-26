import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import type { JSONContent } from "@tiptap/core";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  EyeIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TopicEditor } from "@/components/community/topic-editor";
import { getAdminCourse } from "@/lib/admin-learning";
import {
  createLesson,
  createLessonResource,
  createModule,
  duplicateCourse,
  duplicateLesson,
  duplicateModule,
  moveLesson,
  moveModule,
  removeLessonResource,
  setContentStatus,
  updateCourse,
  updateLesson,
  updateLessonResource,
  updateModule,
} from "../../../actions";

interface AdminCoursePageProperties {
  readonly params: Promise<{ id: string }>;
}

const statusLabel = (status: string) => {
  if (status === "PUBLISHED") {
    return "Publicado";
  }

  if (status === "ARCHIVED") {
    return "Arquivado";
  }

  return "Rascunho";
};

const AdminCoursePage = async ({ params }: AdminCoursePageProperties) => {
  const { id } = await params;
  const course = await getAdminCourse(id);

  if (!course) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          className="text-muted-foreground text-sm underline underline-offset-4"
          href="/admin/learning"
        >
          ← Conteúdo
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/learning/courses/${course.id}/preview`}>
              <EyeIcon aria-hidden="true" /> Preview
            </Link>
          </Button>
          {course.status === "PUBLISHED" && (
            <Button asChild variant="ghost">
              <Link href={`/aprender/cursos/${course.slug}`}>
                Ver como aluno
              </Link>
            </Button>
          )}
          <form action={duplicateCourse}>
            <input name="courseId" type="hidden" value={course.id} />
            <Button size="sm" type="submit" variant="ghost">
              <CopyIcon aria-hidden="true" /> Duplicar
            </Button>
          </form>
          <Badge
            variant={course.status === "PUBLISHED" ? "default" : "outline"}
          >
            {statusLabel(course.status)}
          </Badge>
        </div>
      </div>
      <header className="mt-10 max-w-4xl border-border border-b pb-8">
        <p className="brand-eyebrow">
          {course.learningPath?.title ?? "Sem percurso"} · /{course.slug}
        </p>
        <h1 className="mt-4 font-display text-5xl leading-none sm:text-6xl">
          {course.title}
        </h1>
        {course.description && (
          <p className="mt-5 max-w-2xl text-muted-foreground leading-7">
            {course.description}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          {course.status !== "PUBLISHED" && (
            <form action={setContentStatus}>
              <input name="entity" type="hidden" value="course" />
              <input name="id" type="hidden" value={course.id} />
              <input name="status" type="hidden" value="PUBLISHED" />
              <Button size="sm" type="submit">
                Publicar curso
              </Button>
            </form>
          )}
          {course.status === "PUBLISHED" && (
            <form action={setContentStatus}>
              <input name="entity" type="hidden" value="course" />
              <input name="id" type="hidden" value={course.id} />
              <input name="status" type="hidden" value="ARCHIVED" />
              <Button size="sm" type="submit" variant="outline">
                Arquivar
              </Button>
            </form>
          )}
        </div>
        <details className="mt-6 max-w-2xl border-border border-t pt-5">
          <summary className="cursor-pointer text-muted-foreground text-sm underline underline-offset-4">
            Editar curso
          </summary>
          <form action={updateCourse} className="mt-4 grid gap-3">
            <input name="courseId" type="hidden" value={course.id} />
            <Input defaultValue={course.title} name="title" required />
            <Input
              defaultValue={course.subtitle ?? ""}
              name="subtitle"
              placeholder="Subtítulo"
            />
            <Input defaultValue={course.slug} name="slug" required />
            <Textarea
              defaultValue={course.description ?? ""}
              name="description"
              placeholder="Descrição"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                defaultValue={course.format ?? ""}
                name="format"
                placeholder="Formato"
              />
              <Input
                defaultValue={course.level ?? ""}
                name="level"
                placeholder="Nível"
              />
              <Input
                defaultValue={course.durationMinutes ?? ""}
                min="1"
                name="durationMinutes"
                placeholder="Duração (min)"
                type="number"
              />
            </div>
            <Input
              defaultValue={course.category ?? ""}
              name="category"
              placeholder="Categoria"
            />
            <Input
              defaultValue={course.tags.join(", ")}
              name="tags"
              placeholder="Tags separadas por vírgula"
            />
            <div className="flex justify-end">
              <Button size="sm" type="submit">
                Salvar curso
              </Button>
            </div>
          </form>
        </details>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section aria-labelledby="modules-heading">
          <div className="flex items-end justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="modules-heading">
              Módulos
            </h2>
            <span className="font-data text-muted-foreground text-xs">
              {course.modules.length.toString().padStart(2, "0")}
            </span>
          </div>
          <div className="mt-5 grid gap-6">
            {course.modules.length === 0 && (
              <div className="paper-surface border p-6 text-muted-foreground">
                Crie o primeiro módulo na coluna ao lado.
              </div>
            )}
            {course.modules.map((module, moduleIndex) => (
              <article
                className="paper-surface border p-6 sm:p-8"
                id={`module-${module.id}`}
                key={module.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="brand-eyebrow">
                      Módulo {String(moduleIndex + 1).padStart(2, "0")} · /
                      {module.slug}
                    </p>
                    <h3 className="mt-2 font-display text-3xl">
                      {module.title}
                    </h3>
                  </div>
                  <div className="flex gap-1">
                    <form action={moveModule}>
                      <input name="moduleId" type="hidden" value={module.id} />
                      <input name="direction" type="hidden" value="up" />
                      <Button
                        aria-label="Mover módulo para cima"
                        size="icon"
                        type="submit"
                        variant="ghost"
                      >
                        <ArrowUpIcon aria-hidden="true" />
                      </Button>
                    </form>
                    <form action={duplicateModule}>
                      <input name="moduleId" type="hidden" value={module.id} />
                      <Button
                        aria-label="Duplicar módulo"
                        size="icon"
                        type="submit"
                        variant="ghost"
                      >
                        <CopyIcon aria-hidden="true" />
                      </Button>
                    </form>
                    <form action={moveModule}>
                      <input name="moduleId" type="hidden" value={module.id} />
                      <input name="direction" type="hidden" value="down" />
                      <Button
                        aria-label="Mover módulo para baixo"
                        size="icon"
                        type="submit"
                        variant="ghost"
                      >
                        <ArrowDownIcon aria-hidden="true" />
                      </Button>
                    </form>
                  </div>
                  <Badge
                    variant={
                      module.status === "PUBLISHED" ? "default" : "outline"
                    }
                  >
                    {statusLabel(module.status)}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {module.status !== "PUBLISHED" && (
                    <form action={setContentStatus}>
                      <input name="entity" type="hidden" value="module" />
                      <input name="id" type="hidden" value={module.id} />
                      <input name="status" type="hidden" value="PUBLISHED" />
                      <Button size="sm" type="submit" variant="outline">
                        Publicar módulo
                      </Button>
                    </form>
                  )}
                  {module.status === "PUBLISHED" && (
                    <form action={setContentStatus}>
                      <input name="entity" type="hidden" value="module" />
                      <input name="id" type="hidden" value={module.id} />
                      <input name="status" type="hidden" value="ARCHIVED" />
                      <Button size="sm" type="submit" variant="ghost">
                        Arquivar módulo
                      </Button>
                    </form>
                  )}
                </div>
                <details className="mt-5 border-border border-t pt-5">
                  <summary className="cursor-pointer text-muted-foreground text-sm underline underline-offset-4">
                    Editar módulo
                  </summary>
                  <form action={updateModule} className="mt-4 grid gap-3">
                    <input name="moduleId" type="hidden" value={module.id} />
                    <Input defaultValue={module.title} name="title" required />
                    <Input defaultValue={module.slug} name="slug" required />
                    <Textarea
                      defaultValue={module.description ?? ""}
                      name="description"
                      placeholder="O que este módulo ajuda a compreender?"
                    />
                    <Textarea
                      defaultValue={module.objectives.join("\n")}
                      name="objectives"
                      placeholder="Um objetivo por linha"
                    />
                    <div className="flex justify-end">
                      <Button size="sm" type="submit">
                        Salvar módulo
                      </Button>
                    </div>
                  </form>
                </details>
                <div className="mt-6 divide-y border-border border-y">
                  {module.lessons.length === 0 && (
                    <p className="py-4 text-muted-foreground text-sm">
                      Sem aulas ainda.
                    </p>
                  )}
                  {module.lessons.map((lesson, lessonIndex) => (
                    <div
                      className="py-4"
                      id={`lesson-${lesson.id}`}
                      key={lesson.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="brand-eyebrow">
                            Aula {String(lessonIndex + 1).padStart(2, "0")} ·{" "}
                            {lesson.kind}
                          </p>
                          <p className="mt-1 font-medium">{lesson.title}</p>
                          <p className="mt-1 text-muted-foreground text-sm">
                            {lesson.description ?? "Sem descrição"}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <form action={moveLesson}>
                            <input
                              name="lessonId"
                              type="hidden"
                              value={lesson.id}
                            />
                            <input name="direction" type="hidden" value="up" />
                            <Button
                              aria-label="Mover aula para cima"
                              size="icon"
                              type="submit"
                              variant="ghost"
                            >
                              <ArrowUpIcon aria-hidden="true" />
                            </Button>
                          </form>
                          <form action={duplicateLesson}>
                            <input
                              name="lessonId"
                              type="hidden"
                              value={lesson.id}
                            />
                            <Button
                              aria-label="Duplicar aula"
                              size="icon"
                              type="submit"
                              variant="ghost"
                            >
                              <CopyIcon aria-hidden="true" />
                            </Button>
                          </form>
                          <form action={moveLesson}>
                            <input
                              name="lessonId"
                              type="hidden"
                              value={lesson.id}
                            />
                            <input
                              name="direction"
                              type="hidden"
                              value="down"
                            />
                            <Button
                              aria-label="Mover aula para baixo"
                              size="icon"
                              type="submit"
                              variant="ghost"
                            >
                              <ArrowDownIcon aria-hidden="true" />
                            </Button>
                          </form>
                        </div>
                        <Badge
                          variant={
                            lesson.status === "PUBLISHED"
                              ? "default"
                              : "outline"
                          }
                        >
                          {statusLabel(lesson.status)}
                        </Badge>
                      </div>
                      <details className="mt-4">
                        <summary className="cursor-pointer text-muted-foreground text-sm underline underline-offset-4">
                          Editar aula
                        </summary>
                        <form action={updateLesson} className="mt-4 grid gap-3">
                          <input
                            name="lessonId"
                            type="hidden"
                            value={lesson.id}
                          />
                          <Input
                            defaultValue={lesson.title}
                            name="title"
                            required
                          />
                          <Input
                            defaultValue={lesson.slug}
                            name="slug"
                            required
                          />
                          <Input
                            defaultValue={lesson.description ?? ""}
                            name="description"
                            placeholder="Descrição curta"
                          />
                          <select
                            className="h-11 rounded-sm border bg-transparent px-3 text-sm"
                            defaultValue={lesson.kind}
                            name="kind"
                          >
                            <option value="TEXT">Texto</option>
                            <option value="READING">Leitura</option>
                            <option value="MIXED">Misto</option>
                            <option value="MATERIAL">Material</option>
                            <option value="VIDEO">Vídeo</option>
                          </select>
                          <Textarea
                            defaultValue={lesson.objectives.join("\n")}
                            name="objectives"
                            placeholder="Objetivos da aula, um por linha"
                          />
                          <TopicEditor
                            ariaLabel="Conteúdo da aula"
                            defaultValue={lesson.content as JSONContent}
                          />
                          <div className="flex justify-end">
                            <Button size="sm" type="submit">
                              Salvar aula
                            </Button>
                          </div>
                        </form>
                      </details>
                      <div className="mt-3 flex gap-2">
                        {lesson.status !== "PUBLISHED" && (
                          <form action={setContentStatus}>
                            <input name="entity" type="hidden" value="lesson" />
                            <input name="id" type="hidden" value={lesson.id} />
                            <input
                              name="status"
                              type="hidden"
                              value="PUBLISHED"
                            />
                            <Button size="sm" type="submit" variant="outline">
                              Publicar
                            </Button>
                          </form>
                        )}
                        {lesson.status === "PUBLISHED" && (
                          <form action={setContentStatus}>
                            <input name="entity" type="hidden" value="lesson" />
                            <input name="id" type="hidden" value={lesson.id} />
                            <input
                              name="status"
                              type="hidden"
                              value="ARCHIVED"
                            />
                            <Button size="sm" type="submit" variant="ghost">
                              Arquivar
                            </Button>
                          </form>
                        )}
                      </div>
                      <div className="mt-4 border-border border-t pt-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="brand-eyebrow">Materiais vinculados</p>
                          <span className="font-data text-muted-foreground text-xs">
                            {lesson.resources.length
                              .toString()
                              .padStart(2, "0")}
                          </span>
                        </div>
                        {lesson.resources.length > 0 && (
                          <ul className="mt-3 divide-y border-border border-y">
                            {lesson.resources.map((resource) => (
                              <li className="py-3 text-sm" key={resource.id}>
                                <div className="flex items-center justify-between gap-3">
                                  <a
                                    className="min-w-0 truncate text-brand-structural underline underline-offset-4"
                                    href={resource.url}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    {resource.title}
                                  </a>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <form action={removeLessonResource}>
                                      <input
                                        name="resourceId"
                                        type="hidden"
                                        value={resource.id}
                                      />
                                      <Button
                                        aria-label={`Remover ${resource.title}`}
                                        size="icon"
                                        type="submit"
                                        variant="ghost"
                                      >
                                        <Trash2Icon aria-hidden="true" />
                                      </Button>
                                    </form>
                                  </div>
                                </div>
                                <details className="mt-2">
                                  <summary className="cursor-pointer text-muted-foreground text-xs underline underline-offset-4">
                                    Editar material
                                  </summary>
                                  <form
                                    action={updateLessonResource}
                                    className="mt-2 grid gap-2 sm:grid-cols-[1.2fr_0.8fr_1.5fr_auto] sm:items-end"
                                  >
                                    <input
                                      name="resourceId"
                                      type="hidden"
                                      value={resource.id}
                                    />
                                    <Input
                                      defaultValue={resource.title}
                                      name="title"
                                      required
                                    />
                                    <select
                                      className="h-10 rounded-sm border bg-transparent px-3 text-sm"
                                      defaultValue={resource.kind}
                                      name="kind"
                                    >
                                      <option value="RECOMMENDED_READING">
                                        Leitura
                                      </option>
                                      <option value="PDF">PDF</option>
                                      <option value="ARTICLE">Artigo</option>
                                      <option value="EXTERNAL_LINK">
                                        Link
                                      </option>
                                      <option value="FILE">Arquivo</option>
                                    </select>
                                    <Input
                                      defaultValue={resource.url}
                                      name="url"
                                      required
                                      type="url"
                                    />
                                    <Button
                                      size="sm"
                                      type="submit"
                                      variant="outline"
                                    >
                                      Salvar
                                    </Button>
                                  </form>
                                </details>
                              </li>
                            ))}
                          </ul>
                        )}
                        <form
                          action={createLessonResource}
                          className="mt-3 grid gap-2 sm:grid-cols-[1.2fr_0.8fr_1.5fr_auto] sm:items-end"
                        >
                          <input
                            name="lessonId"
                            type="hidden"
                            value={lesson.id}
                          />
                          <Input
                            name="title"
                            placeholder="Nome do material"
                            required
                          />
                          <select
                            className="h-10 rounded-sm border bg-transparent px-3 text-sm"
                            defaultValue="RECOMMENDED_READING"
                            name="kind"
                          >
                            <option value="RECOMMENDED_READING">Leitura</option>
                            <option value="PDF">PDF</option>
                            <option value="ARTICLE">Artigo</option>
                            <option value="EXTERNAL_LINK">Link</option>
                            <option value="FILE">Arquivo</option>
                          </select>
                          <Input
                            name="url"
                            placeholder="https://..."
                            required
                            type="url"
                          />
                          <Button size="sm" type="submit" variant="outline">
                            Adicionar
                          </Button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
                <details className="mt-6">
                  <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-brand-structural">
                    <PlusIcon aria-hidden="true" className="size-4" /> Nova aula
                  </summary>
                  <form action={createLesson} className="mt-4 grid gap-3">
                    <input name="moduleId" type="hidden" value={module.id} />
                    <Input name="title" placeholder="Título da aula" required />
                    <Input name="slug" placeholder="slug-da-aula" required />
                    <Input name="description" placeholder="Descrição curta" />
                    <Textarea
                      name="objectives"
                      placeholder="Objetivos da aula, um por linha"
                    />
                    <select
                      className="h-11 rounded-sm border bg-transparent px-3 text-sm"
                      defaultValue="TEXT"
                      name="kind"
                    >
                      <option value="TEXT">Texto</option>
                      <option value="READING">Leitura</option>
                      <option value="MIXED">Misto</option>
                      <option value="MATERIAL">Material</option>
                      <option value="VIDEO">Vídeo</option>
                    </select>
                    <TopicEditor ariaLabel="Conteúdo da aula" />
                    <div className="flex justify-end">
                      <Button size="sm" type="submit">
                        Criar aula
                      </Button>
                    </div>
                  </form>
                </details>
              </article>
            ))}
          </div>
        </section>
        <aside className="paper-surface border p-6 lg:sticky lg:top-24">
          <p className="brand-eyebrow">Estrutura</p>
          <h2 className="mt-3 font-display text-2xl">Novo módulo</h2>
          <form action={createModule} className="mt-6 space-y-4">
            <input name="courseId" type="hidden" value={course.id} />
            <label className="block" htmlFor="module-title">
              <span className="brand-eyebrow">Título</span>
              <Input
                className="mt-2"
                id="module-title"
                name="title"
                placeholder="Primeiros conceitos"
                required
              />
            </label>
            <label className="block" htmlFor="module-slug">
              <span className="brand-eyebrow">Slug</span>
              <Input
                className="mt-2"
                id="module-slug"
                name="slug"
                placeholder="primeiros-conceitos"
                required
              />
            </label>
            <label className="block" htmlFor="module-description">
              <span className="brand-eyebrow">Descrição</span>
              <Textarea
                className="mt-2"
                id="module-description"
                name="description"
                placeholder="A pergunta central deste módulo"
              />
            </label>
            <label className="block" htmlFor="module-objectives">
              <span className="brand-eyebrow">Objetivos</span>
              <Textarea
                className="mt-2"
                id="module-objectives"
                name="objectives"
                placeholder="Um objetivo por linha"
              />
            </label>
            <Button className="w-full" type="submit">
              Criar módulo
            </Button>
          </form>
          <div className="mt-8 border-border border-t pt-6">
            <p className="text-muted-foreground text-sm leading-6">
              A publicação acontece por nível: primeiro a aula, depois o curso.
              Um draft nunca aparece para membros.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default AdminCoursePage;
