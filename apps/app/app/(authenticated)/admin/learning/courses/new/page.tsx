import { database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import { createCourse } from "../../../actions";

const NewCoursePage = async () => {
  const paths = await database.learningPath.findMany({
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: { id: true, title: true },
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 lg:py-14">
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4"
        href="/admin/learning"
      >
        ← Voltar ao conteúdo
      </Link>
      <p className="brand-eyebrow mt-10">Professor · novo curso</p>
      <h1 className="mt-4 font-display text-5xl leading-none">
        Um curso é uma pergunta longa.
      </h1>
      <p className="mt-5 max-w-2xl text-muted-foreground leading-7">
        Comece com uma intenção clara. Depois você poderá dividir o percurso em
        módulos e aulas.
      </p>
      <form
        action={createCourse}
        className="paper-surface mt-10 space-y-6 border p-6 sm:p-10"
      >
        <label className="block" htmlFor="course-title">
          <span className="brand-eyebrow">Título</span>
          <Input
            className="mt-2"
            id="course-title"
            name="title"
            placeholder="Introdução à prática baseada em evidências"
            required
          />
        </label>
        <label className="block" htmlFor="course-subtitle">
          <span className="brand-eyebrow">Subtítulo</span>
          <Input
            className="mt-2"
            id="course-subtitle"
            name="subtitle"
            placeholder="Uma frase que orienta a promessa do curso"
          />
        </label>
        <label className="block" htmlFor="course-slug">
          <span className="brand-eyebrow">Slug</span>
          <Input
            className="mt-2"
            id="course-slug"
            name="slug"
            placeholder="introducao-a-pratica-baseada-em-evidencias"
            required
          />
        </label>
        <label className="block" htmlFor="course-path">
          <span className="brand-eyebrow">Percurso</span>
          <select
            className="mt-2 h-11 w-full rounded-sm border bg-transparent px-3 text-sm"
            defaultValue=""
            id="course-path"
            name="learningPathId"
          >
            <option value="">Sem percurso por enquanto</option>
            {paths.map((path) => (
              <option key={path.id} value={path.id}>
                {path.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block" htmlFor="course-description">
          <span className="brand-eyebrow">Descrição</span>
          <Textarea
            className="mt-2 min-h-32"
            id="course-description"
            name="description"
            placeholder="O que o membro vai conseguir compreender?"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block" htmlFor="course-format">
            <span className="brand-eyebrow">Formato</span>
            <Input
              className="mt-2"
              id="course-format"
              name="format"
              placeholder="Curso, trilha..."
            />
          </label>
          <label className="block" htmlFor="course-level">
            <span className="brand-eyebrow">Nível</span>
            <Input
              className="mt-2"
              id="course-level"
              name="level"
              placeholder="Inicial, intermediário..."
            />
          </label>
          <label className="block" htmlFor="course-duration">
            <span className="brand-eyebrow">Duração (min)</span>
            <Input
              className="mt-2"
              id="course-duration"
              min="1"
              name="durationMinutes"
              type="number"
            />
          </label>
        </div>
        <label className="block" htmlFor="course-category">
          <span className="brand-eyebrow">Categoria</span>
          <Input
            className="mt-2"
            id="course-category"
            name="category"
            placeholder="Fundamentos de PBE"
          />
        </label>
        <label className="block" htmlFor="course-tags">
          <span className="brand-eyebrow">Tags separadas por vírgula</span>
          <Input
            className="mt-2"
            id="course-tags"
            name="tags"
            placeholder="pbe, leitura crítica"
          />
        </label>
        <div className="flex flex-wrap justify-end gap-3 border-border border-t pt-6">
          <Button asChild variant="ghost">
            <Link href="/admin/learning">Cancelar</Link>
          </Button>
          <Button type="submit">Criar curso</Button>
        </div>
      </form>
    </main>
  );
};

export default NewCoursePage;
