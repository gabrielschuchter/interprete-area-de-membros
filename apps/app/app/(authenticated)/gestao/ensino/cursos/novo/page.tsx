import { database } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { createCourse } from "../../../../admin/actions";

const GestaoNewCoursePage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  await requireGestaoAction("content.manage");
  const [paths, query] = await Promise.all([
    database.learningPath.findMany({
      orderBy: [{ position: "asc" }, { title: "asc" }],
      select: { id: true, title: true },
    }),
    searchParams,
  ]);
  const requestedPathId = Array.isArray(query.percurso)
    ? query.percurso[0]
    : query.percurso;
  const initialPathId = paths.some((path) => path.id === requestedPathId)
    ? requestedPathId
    : "";

  return (
    <section className="ge-course-create">
      <header className="ge-course-create-header">
        <Link href="/gestao/ensino/cursos">← Cursos e percursos</Link>
        <p className="ge-courses-eyebrow">Gestão · Ensino</p>
        <h1>Novo curso</h1>
        <p>Comece com uma intenção clara. Depois, organize módulos e aulas.</p>
      </header>
      <form action={createCourse} className="ge-course-create-form">
        <input name="gestaoReturn" type="hidden" value="GESTAO" />
        <label htmlFor="course-title">
          <span>Título</span>
          <Input
            autoComplete="off"
            id="course-title"
            maxLength={180}
            name="title"
            required
          />
        </label>
        <label htmlFor="course-subtitle">
          <span>Subtítulo</span>
          <Input id="course-subtitle" maxLength={240} name="subtitle" />
        </label>
        <label htmlFor="course-slug">
          <span>Slug</span>
          <Input
            autoComplete="off"
            id="course-slug"
            maxLength={80}
            name="slug"
            required
          />
        </label>
        <label htmlFor="course-path">
          <span>Percurso</span>
          <select
            defaultValue={initialPathId}
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
        <label
          className="ge-course-create-description"
          htmlFor="course-description"
        >
          <span>Descrição</span>
          <Textarea
            id="course-description"
            maxLength={5000}
            name="description"
            rows={5}
          />
        </label>
        <div className="ge-course-create-meta">
          <label htmlFor="course-format">
            <span>Formato</span>
            <Input id="course-format" maxLength={80} name="format" />
          </label>
          <label htmlFor="course-level">
            <span>Nível</span>
            <Input id="course-level" maxLength={80} name="level" />
          </label>
          <label htmlFor="course-duration">
            <span>Duração (min)</span>
            <Input
              id="course-duration"
              min="1"
              name="durationMinutes"
              type="number"
            />
          </label>
          <label htmlFor="course-category">
            <span>Categoria</span>
            <Input id="course-category" maxLength={120} name="category" />
          </label>
          <label className="ge-course-create-tags" htmlFor="course-tags">
            <span>Tags separadas por vírgula</span>
            <Input id="course-tags" maxLength={500} name="tags" />
          </label>
        </div>
        <footer>
          <Button asChild variant="ghost">
            <Link href="/gestao/ensino/cursos">Cancelar</Link>
          </Button>
          <Button type="submit">Criar curso</Button>
        </footer>
      </form>
    </section>
  );
};

export default GestaoNewCoursePage;
