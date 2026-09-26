import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import { getCourseOptions } from "@/lib/admin-learning";
import { getStaffLibraryItems } from "@/lib/library";

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
  createLibraryItem,
  setLibraryStatus,
  updateLibraryItem,
} from "../../biblioteca/actions";

const AdminLibraryPage = async () => {
  const [items, courses] = await Promise.all([
    getStaffLibraryItems(),
    getCourseOptions(),
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
        <p className="brand-eyebrow">Professor · biblioteca</p>
        <h1 className="mt-4 font-display text-5xl leading-none">
          Curadoria é escolher o que merece atenção.
        </h1>
        <p className="mt-5 text-muted-foreground leading-7">
          Adicione artigos, PDFs, guias e links externos. O arquivo não
          substitui um Storage: ele organiza referências que já têm uma origem
          segura.
        </p>
      </header>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section>
          <h2 className="border-border border-b pb-3 font-display text-3xl">
            Itens catalogados
          </h2>
          <div className="mt-5 divide-y border-border border-y">
            {items.length === 0 ? (
              <p className="py-5 text-muted-foreground">Nenhum item criado.</p>
            ) : (
              // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the card keeps reference editing, relations, and publishing controls together.
              items.map((item) => (
                <article
                  className="flex flex-col justify-between gap-4 py-5 sm:flex-row sm:items-center"
                  key={item.id}
                >
                  <div>
                    <Badge
                      variant={
                        item.status === "PUBLISHED" ? "default" : "outline"
                      }
                    >
                      {statusLabel(item.status)}
                    </Badge>
                    <h3 className="mt-2 font-display text-2xl">{item.title}</h3>
                    <p className="mt-1 text-muted-foreground text-sm">
                      {item.kind} · {item.category ?? "sem categoria"}
                    </p>
                    {(item.lesson || item.activities.length > 0) && (
                      <p className="mt-1 text-muted-foreground text-xs">
                        {item.lesson ? `Aula: ${item.lesson.title}` : ""}
                        {item.activities.length > 0
                          ? `${item.lesson ? " · " : ""}Atividade: ${item.activities[0].title}`
                          : ""}
                      </p>
                    )}
                    <details className="mt-3">
                      <summary className="cursor-pointer text-muted-foreground text-sm underline underline-offset-4">
                        Editar material
                      </summary>
                      <form
                        action={updateLibraryItem}
                        className="mt-4 grid gap-3"
                        encType="multipart/form-data"
                      >
                        <input name="id" type="hidden" value={item.id} />
                        <Input
                          defaultValue={item.title}
                          name="title"
                          required
                        />
                        <Textarea
                          defaultValue={item.description ?? ""}
                          name="description"
                          placeholder="Descrição"
                        />
                        <select
                          className="h-11 rounded-sm border bg-transparent px-3 text-sm"
                          defaultValue={item.kind}
                          name="kind"
                        >
                          <option value="ARTICLE">Artigo</option>
                          <option value="PDF">PDF</option>
                          <option value="GUIDE">Guia</option>
                          <option value="LINK">Link</option>
                          <option value="VIDEO">Vídeo</option>
                        </select>
                        <Input
                          defaultValue={item.category ?? ""}
                          name="category"
                          placeholder="Categoria"
                        />
                        <Input
                          defaultValue={item.tags.join(", ")}
                          name="tags"
                          placeholder="Tags"
                        />
                        <Input defaultValue={item.url} name="url" type="url" />
                        <label
                          className="grid gap-2 text-sm"
                          htmlFor={`library-file-${item.id}`}
                        >
                          <span className="brand-eyebrow">
                            Substituir arquivo
                          </span>
                          <Input
                            accept="application/pdf,image/jpeg,image/png,image/webp,text/plain"
                            id={`library-file-${item.id}`}
                            name="file"
                            type="file"
                          />
                        </label>
                        <Input
                          defaultValue={item.authors ?? ""}
                          name="authors"
                          placeholder="Autores"
                        />
                        <Input
                          defaultValue={item.year ?? ""}
                          name="year"
                          placeholder="Ano"
                          type="number"
                        />
                        <Input
                          defaultValue={item.doi ?? ""}
                          name="doi"
                          placeholder="DOI (opcional)"
                        />
                        <Input
                          defaultValue={item.pmid ?? ""}
                          name="pmid"
                          placeholder="PMID (opcional)"
                        />
                        <select
                          className="h-11 rounded-sm border bg-transparent px-3 text-sm"
                          defaultValue={item.lesson?.id ?? ""}
                          name="lessonId"
                        >
                          <option value="">Nenhuma aula relacionada</option>
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
                        <Button size="sm" type="submit">
                          Salvar alterações
                        </Button>
                      </form>
                    </details>
                  </div>
                  <div className="flex gap-2">
                    {item.status !== "PUBLISHED" && (
                      <form action={setLibraryStatus}>
                        <input name="id" type="hidden" value={item.id} />
                        <input name="status" type="hidden" value="PUBLISHED" />
                        <Button size="sm" type="submit">
                          Publicar
                        </Button>
                      </form>
                    )}
                    {item.status === "PUBLISHED" && (
                      <form action={setLibraryStatus}>
                        <input name="id" type="hidden" value={item.id} />
                        <input name="status" type="hidden" value="ARCHIVED" />
                        <Button size="sm" type="submit" variant="outline">
                          Arquivar
                        </Button>
                      </form>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
        <aside className="paper-surface border p-6 lg:sticky lg:top-24">
          <p className="brand-eyebrow">Novo material</p>
          <form
            action={createLibraryItem}
            className="mt-5 space-y-4"
            encType="multipart/form-data"
          >
            <label className="block" htmlFor="library-title">
              <span className="brand-eyebrow">Título</span>
              <Input
                className="mt-2"
                id="library-title"
                name="title"
                required
              />
            </label>
            <label className="block" htmlFor="library-description">
              <span className="brand-eyebrow">Descrição</span>
              <Textarea
                className="mt-2 min-h-24"
                id="library-description"
                name="description"
              />
            </label>
            <label className="block" htmlFor="library-kind">
              <span className="brand-eyebrow">Tipo</span>
              <select
                className="mt-2 h-11 w-full rounded-sm border bg-transparent px-3 text-sm"
                defaultValue="ARTICLE"
                id="library-kind"
                name="kind"
              >
                <option value="ARTICLE">Artigo</option>
                <option value="PDF">PDF</option>
                <option value="GUIDE">Guia</option>
                <option value="LINK">Link</option>
                <option value="VIDEO">Vídeo</option>
              </select>
            </label>
            <label className="block" htmlFor="library-category">
              <span className="brand-eyebrow">Categoria</span>
              <Input className="mt-2" id="library-category" name="category" />
            </label>
            <label className="block" htmlFor="library-tags">
              <span className="brand-eyebrow">Tags separadas por vírgula</span>
              <Input
                className="mt-2"
                id="library-tags"
                name="tags"
                placeholder="pbe, leitura"
              />
            </label>
            <label className="block" htmlFor="library-url">
              <span className="brand-eyebrow">URL externa (opcional)</span>
              <Input
                className="mt-2"
                id="library-url"
                name="url"
                placeholder="https://..."
                type="url"
              />
            </label>
            <label className="block" htmlFor="library-file">
              <span className="brand-eyebrow">Ou envie um arquivo</span>
              <Input
                accept="application/pdf,image/jpeg,image/png,image/webp,text/plain"
                className="mt-2"
                id="library-file"
                name="file"
                type="file"
              />
              <span className="mt-2 block text-muted-foreground text-xs">
                PDF, imagem ou texto · até 20 MB.
              </span>
            </label>
            <Input name="authors" placeholder="Autores" />
            <Input name="year" placeholder="Ano" type="number" />
            <Input name="doi" placeholder="DOI (opcional)" />
            <Input name="pmid" placeholder="PMID (opcional)" />
            <select
              className="h-11 rounded-sm border bg-transparent px-3 text-sm"
              defaultValue=""
              name="lessonId"
            >
              <option value="">Nenhuma aula relacionada</option>
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
            <Button className="w-full" type="submit">
              Salvar como rascunho
            </Button>
          </form>
        </aside>
      </div>
    </main>
  );
};

export default AdminLibraryPage;
