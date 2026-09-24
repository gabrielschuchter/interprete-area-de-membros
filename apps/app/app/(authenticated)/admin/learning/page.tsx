import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { ArrowRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { getAdminLearningOverview } from "@/lib/admin-learning";
import { createLearningPath } from "../actions";

const statusLabel = (status: string) => {
  if (status === "PUBLISHED") {
    return "Publicado";
  }

  if (status === "ARCHIVED") {
    return "Arquivado";
  }

  return "Rascunho";
};

const AdminLearningPage = async () => {
  const paths = await getAdminLearningOverview();

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <header className="flex flex-col justify-between gap-6 border-border border-b pb-8 md:flex-row md:items-end">
        <div className="max-w-3xl">
          <p className="brand-eyebrow">Professor · conteúdo</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
            O conteúdo começa aqui.
          </h1>
          <p className="mt-5 text-muted-foreground leading-7">
            Crie percursos, organize cursos e escreva aulas que possam ser lidas
            com calma. Nada é publicado antes da sua decisão.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/learning/courses/new">
            <PlusIcon aria-hidden="true" /> Novo curso
          </Link>
        </Button>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section aria-labelledby="paths-heading">
          <div className="flex items-end justify-between border-border border-b pb-3">
            <h2 className="font-display text-3xl" id="paths-heading">
              Percursos editoriais
            </h2>
            <span className="font-data text-muted-foreground text-xs">
              {paths.length.toString().padStart(2, "0")}
            </span>
          </div>
          {paths.length === 0 ? (
            <div className="paper-surface mt-5 border p-8">
              <p className="text-muted-foreground">
                Nenhum percurso criado ainda.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-5">
              {paths.map((path) => (
                <article
                  className="paper-surface border p-6 sm:p-8"
                  key={path.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="brand-eyebrow">/{path.slug}</p>
                      <h3 className="mt-2 font-display text-3xl">
                        {path.title}
                      </h3>
                    </div>
                    <Badge
                      variant={
                        path.status === "PUBLISHED" ? "default" : "outline"
                      }
                    >
                      {statusLabel(path.status)}
                    </Badge>
                  </div>
                  <div className="mt-6 divide-y border-border border-y">
                    {path.courses.length === 0 ? (
                      <p className="py-4 text-muted-foreground text-sm">
                        Sem cursos neste percurso.
                      </p>
                    ) : (
                      path.courses.map((course) => (
                        <Link
                          className="flex items-center justify-between gap-4 py-4 transition-colors hover:text-brand-structural"
                          href={`/admin/learning/courses/${course.id}`}
                          key={course.id}
                        >
                          <span>
                            <span className="block font-medium">
                              {course.title}
                            </span>
                            <span className="mt-1 block text-muted-foreground text-xs">
                              {course.modules.length} módulos ·{" "}
                              {course.modules.reduce(
                                (sum, module) => sum + module.lessons.length,
                                0
                              )}{" "}
                              aulas
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            <Badge variant="outline">
                              {statusLabel(course.status)}
                            </Badge>
                            <ArrowRightIcon
                              aria-hidden="true"
                              className="size-4"
                            />
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="paper-surface border p-6 lg:sticky lg:top-24">
          <p className="brand-eyebrow">Primeiro passo</p>
          <h2 className="mt-3 font-display text-2xl">Novo percurso</h2>
          <form action={createLearningPath} className="mt-6 space-y-4">
            <label className="block" htmlFor="path-title">
              <span className="brand-eyebrow">Título</span>
              <Input
                className="mt-2"
                id="path-title"
                name="title"
                placeholder="Ex.: Fundamentos da PBE"
                required
              />
            </label>
            <label className="block" htmlFor="path-slug">
              <span className="brand-eyebrow">Slug</span>
              <Input
                className="mt-2"
                id="path-slug"
                name="slug"
                placeholder="fundamentos-da-pbe"
                required
              />
            </label>
            <label className="block" htmlFor="path-description">
              <span className="brand-eyebrow">Descrição</span>
              <Textarea
                className="mt-2 min-h-24"
                id="path-description"
                name="description"
                placeholder="O que este percurso ajuda a compreender?"
              />
            </label>
            <Button className="w-full" type="submit">
              Criar percurso
            </Button>
          </form>
        </aside>
      </div>
    </main>
  );
};

export default AdminLearningPage;
