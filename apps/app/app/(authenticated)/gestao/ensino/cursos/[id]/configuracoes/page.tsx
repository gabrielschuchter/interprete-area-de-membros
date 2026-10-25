import { notFound } from "next/navigation";
import { getAdminCourse } from "@/lib/admin-learning";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { GestaoCourseHeader } from "../course-header";
import { saveGestaoCourseSettings } from "../structure-actions";

type SearchParameters = Record<string, string | string[] | undefined>;

const errors: Record<string, string> = {
  dados:
    "Informe um título e um endereço com letras minúsculas, números e hífens.",
  capa: "A capa precisa ser um link http ou https válido.",
  endereco: "Já existe outro curso com este endereço. Escolha outro.",
};

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const CourseSettingsPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<SearchParameters>;
}) => {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  await requireGestaoAction("content.manage", { contentId: id });
  const course = await getAdminCourse(id);
  if (!course) {
    notFound();
  }
  const error = errors[first(search.erro) ?? ""];
  return (
    <>
      <GestaoCourseHeader active="configuracoes" course={course} />
      <form
        action={saveGestaoCourseSettings}
        className="gk-panel gk-form-panel"
      >
        <input name="courseId" type="hidden" value={course.id} />
        <h2 className="gk-panel-title">Informações do curso</h2>
        <p className="gk-panel-copy">
          Estes dados aparecem para os alunos na lista de cursos e na página do
          curso.
        </p>
        {first(search.salvo) ? (
          <output className="gk-result">Configurações salvas.</output>
        ) : null}
        {error ? (
          <p className="gk-error-box" role="alert">
            {error}
          </p>
        ) : null}
        <div className="gk-form-grid">
          <label className="gk-label gk-span-2">
            <span>Título</span>
            <input
              className="gk-input"
              defaultValue={course.title}
              maxLength={180}
              name="title"
              required
            />
          </label>
          <label className="gk-label gk-span-2">
            <span>Subtítulo</span>
            <input
              className="gk-input"
              defaultValue={course.subtitle ?? ""}
              maxLength={240}
              name="subtitle"
            />
          </label>
          <label className="gk-label">
            <span>Endereço do curso</span>
            <input
              className="gk-input"
              defaultValue={course.slug}
              name="slug"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
            />
            <small>
              Aparece em /cursos/{course.slug}. Mudar quebra links antigos.
            </small>
          </label>
          <label className="gk-label">
            <span>Capa (link da imagem)</span>
            <input
              className="gk-input"
              defaultValue={course.coverUrl ?? ""}
              name="coverUrl"
              placeholder="https://"
              type="url"
            />
            <small>
              O envio de arquivo de capa depende do armazenamento de imagens e
              entra depois.
            </small>
          </label>
          <label className="gk-label gk-span-2">
            <span>Descrição</span>
            <textarea
              className="gk-input gk-textarea"
              defaultValue={course.description ?? ""}
              name="description"
              rows={4}
            />
          </label>
          <label className="gk-label">
            <span>Formato</span>
            <input
              className="gk-input"
              defaultValue={course.format ?? ""}
              name="format"
              placeholder="Curso gravado"
            />
          </label>
          <label className="gk-label">
            <span>Nível</span>
            <input
              className="gk-input"
              defaultValue={course.level ?? ""}
              name="level"
              placeholder="Introdutório"
            />
          </label>
          <label className="gk-label">
            <span>Duração estimada (min)</span>
            <input
              className="gk-input"
              defaultValue={course.durationMinutes ?? ""}
              min="1"
              name="durationMinutes"
              type="number"
            />
          </label>
          <label className="gk-label">
            <span>Categoria</span>
            <input
              className="gk-input"
              defaultValue={course.category ?? ""}
              name="category"
            />
          </label>
          <label className="gk-label gk-span-2">
            <span>Etiquetas</span>
            <input
              className="gk-input"
              defaultValue={course.tags.join(", ")}
              name="tags"
              placeholder="busca, PICO, revisão"
            />
          </label>
        </div>
        <div className="gk-form-actions">
          <button className="gk-btn gk-btn--primary" type="submit">
            Salvar configurações
          </button>
        </div>
      </form>
    </>
  );
};

export default CourseSettingsPage;
