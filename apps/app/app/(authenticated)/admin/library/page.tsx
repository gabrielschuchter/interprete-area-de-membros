import { randomUUID } from "node:crypto";
import { libraryCatalog } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import type { ReactNode } from "react";
import { getCourseOptions } from "@/lib/admin-learning";
import { getStaffLibraryItems } from "@/lib/library";
import { IntentLink } from "../../components/intent-link";

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
  importCuratedLibraryCatalog,
  setLibraryStatus,
  updateLibraryItem,
} from "../../biblioteca/actions";

interface AdminLibraryPageProperties {
  readonly searchParams: Promise<{
    catalog?: string;
    page?: string;
    uploadPaused?: string;
  }>;
}

const LibraryEditField = ({
  children,
  fieldId,
  label,
}: {
  readonly children: ReactNode;
  readonly fieldId: string;
  readonly label: string;
}) => (
  <div className="grid gap-1.5 text-sm">
    <label className="brand-eyebrow" htmlFor={fieldId}>
      {label}
    </label>
    {children}
  </div>
);

const AdminLibraryPage = async ({
  searchParams,
}: AdminLibraryPageProperties) => {
  const query = await searchParams;
  const requestedPage = Number(query.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, 10_000)
      : 1;
  const [catalog, courses] = await Promise.all([
    getStaffLibraryItems(page),
    getCourseOptions(),
  ]);
  const { hasMore, items } = catalog;

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
        <form
          action={importCuratedLibraryCatalog}
          className="mt-6 flex flex-col gap-3 border-y py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-medium text-sm">Curadoria PBE revisada</p>
            <p className="mt-1 max-w-2xl text-muted-foreground text-xs leading-5">
              {libraryCatalog.length} recursos institucionais gratuitos. A
              importação é aditiva, evita duplicatas por link/DOI e atualiza
              metadados de itens correspondentes.
            </p>
          </div>
          <Button className="shrink-0" type="submit">
            Importar curadoria verificada
          </Button>
        </form>
        {query.catalog === "imported" && (
          <output className="mt-4 block border border-brand-action/35 bg-brand-action/5 px-4 py-3 text-sm">
            Curadoria importada. Recursos correspondentes foram atualizados sem
            remover relações ou materiais existentes.
          </output>
        )}
        {query.uploadPaused === "1" && (
          <output className="mt-4 block border border-brand-action/35 bg-brand-action/5 px-4 py-3 text-sm">
            O envio de arquivos está temporariamente pausado durante a janela de
            segurança. Você ainda pode cadastrar ou editar referências por link;
            tente enviar o arquivo novamente depois da liberação.
          </output>
        )}
      </header>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section>
          <h2 className="border-border border-b pb-3 font-display text-3xl">
            Itens catalogados
          </h2>
          <div className="mt-5 divide-y border-border border-y">
            {items.length === 0 ? (
              <p className="py-5 text-muted-foreground">
                {page === 1
                  ? "Nenhum item criado."
                  : "Nenhum item nesta página."}
              </p>
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
                    <p className="mt-1 text-muted-foreground text-xs">
                      {item.language ?? "idioma não informado"} ·{" "}
                      {item.difficulty ?? "nível não informado"} ·{" "}
                      {item.accessType ?? "acesso não classificado"}
                      {item.version ? ` · ${item.version}` : ""}
                    </p>
                    {item.coverUrl && (
                      <p className="mt-1 max-w-md truncate text-muted-foreground text-xs">
                        Capa: {item.coverUrl}
                      </p>
                    )}
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
                        <LibraryEditField
                          fieldId={`library-${item.id}-edit-title`}
                          label="Título"
                        >
                          <Input
                            defaultValue={item.title}
                            id={`library-${item.id}-edit-title`}
                            name="title"
                            required
                          />
                        </LibraryEditField>
                        <LibraryEditField
                          fieldId={`library-${item.id}-edit-description`}
                          label="Descrição"
                        >
                          <Textarea
                            defaultValue={item.description ?? ""}
                            id={`library-${item.id}-edit-description`}
                            name="description"
                            placeholder="Descrição"
                          />
                        </LibraryEditField>
                        <LibraryEditField
                          fieldId={`library-${item.id}-edit-cover`}
                          label="URL HTTPS da capa"
                        >
                          <Input
                            defaultValue={item.coverUrl ?? ""}
                            id={`library-${item.id}-edit-cover`}
                            name="coverUrl"
                            placeholder="URL HTTPS da capa (opcional)"
                            type="url"
                          />
                        </LibraryEditField>
                        <LibraryEditField
                          fieldId={`library-${item.id}-edit-kind`}
                          label="Tipo do material"
                        >
                          <select
                            className="h-11 rounded-sm border bg-transparent px-3 text-sm"
                            defaultValue={item.kind}
                            id={`library-${item.id}-edit-kind`}
                            name="kind"
                          >
                            <option value="ARTICLE">Artigo</option>
                            <option value="PDF">PDF</option>
                            <option value="GUIDE">Guia</option>
                            <option value="LINK">Link</option>
                            <option value="VIDEO">Vídeo</option>
                          </select>
                        </LibraryEditField>
                        <LibraryEditField
                          fieldId={`library-${item.id}-edit-category`}
                          label="Categoria"
                        >
                          <Input
                            defaultValue={item.category ?? ""}
                            id={`library-${item.id}-edit-category`}
                            name="category"
                            placeholder="Categoria"
                          />
                        </LibraryEditField>
                        <LibraryEditField
                          fieldId={`library-${item.id}-edit-tags`}
                          label="Tags separadas por vírgula"
                        >
                          <Input
                            defaultValue={item.tags.join(", ")}
                            id={`library-${item.id}-edit-tags`}
                            name="tags"
                            placeholder="Tags"
                          />
                        </LibraryEditField>
                        <LibraryEditField
                          fieldId={`library-${item.id}-edit-url`}
                          label="URL do material"
                        >
                          <Input
                            defaultValue={item.url}
                            id={`library-${item.id}-edit-url`}
                            name="url"
                            type="url"
                          />
                        </LibraryEditField>
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
                        <LibraryEditField
                          fieldId={`library-${item.id}-edit-authors`}
                          label="Autor ou instituição"
                        >
                          <Input
                            defaultValue={item.authors ?? ""}
                            id={`library-${item.id}-edit-authors`}
                            name="authors"
                            placeholder="Autores"
                          />
                        </LibraryEditField>
                        <LibraryEditField
                          fieldId={`library-${item.id}-edit-year`}
                          label="Ano de publicação"
                        >
                          <Input
                            defaultValue={item.year ?? ""}
                            id={`library-${item.id}-edit-year`}
                            name="year"
                            placeholder="Ano"
                            type="number"
                          />
                        </LibraryEditField>
                        <LibraryEditField
                          fieldId={`library-${item.id}-edit-doi`}
                          label="DOI (opcional)"
                        >
                          <Input
                            defaultValue={item.doi ?? ""}
                            id={`library-${item.id}-edit-doi`}
                            name="doi"
                            placeholder="DOI (opcional)"
                          />
                        </LibraryEditField>
                        <LibraryEditField
                          fieldId={`library-${item.id}-edit-pmid`}
                          label="PMID (opcional)"
                        >
                          <Input
                            defaultValue={item.pmid ?? ""}
                            id={`library-${item.id}-edit-pmid`}
                            name="pmid"
                            placeholder="PMID (opcional)"
                          />
                        </LibraryEditField>
                        <LibraryEditField
                          fieldId={`library-${item.id}-edit-language`}
                          label="Idiomas (use códigos como en, pt ou es)"
                        >
                          <Input
                            defaultValue={item.language ?? ""}
                            id={`library-${item.id}-edit-language`}
                            name="language"
                            placeholder="Idioma(s), ex.: en,pt"
                          />
                        </LibraryEditField>
                        <LibraryEditField
                          fieldId={`library-${item.id}-edit-difficulty`}
                          label="Nível de dificuldade"
                        >
                          <select
                            className="h-11 rounded-sm border bg-transparent px-3 text-sm"
                            defaultValue={item.difficulty ?? ""}
                            id={`library-${item.id}-edit-difficulty`}
                            name="difficulty"
                          >
                            <option value="">Nível não classificado</option>
                            <option value="INTRODUCTORY">Introdutório</option>
                            <option value="INTERMEDIATE">Intermediário</option>
                            <option value="ADVANCED">Avançado</option>
                          </select>
                        </LibraryEditField>
                        <LibraryEditField
                          fieldId={`library-${item.id}-edit-access-type`}
                          label="Classificação de acesso"
                        >
                          <select
                            className="h-11 rounded-sm border bg-transparent px-3 text-sm"
                            defaultValue={item.accessType ?? ""}
                            id={`library-${item.id}-edit-access-type`}
                            name="accessType"
                          >
                            <option value="">Acesso não classificado</option>
                            <option value="OPEN_ACCESS">Acesso aberto</option>
                            <option value="FREE_TO_READ">
                              Leitura gratuita
                            </option>
                            <option value="FREE_TOOL">
                              Ferramenta gratuita
                            </option>
                          </select>
                        </LibraryEditField>
                        <LibraryEditField
                          fieldId={`library-${item.id}-edit-version`}
                          label="Versão ou edição"
                        >
                          <Input
                            defaultValue={item.version ?? ""}
                            id={`library-${item.id}-edit-version`}
                            name="version"
                            placeholder="Versão/edição (opcional)"
                          />
                        </LibraryEditField>
                        <LibraryEditField
                          fieldId={`library-${item.id}-edit-access-note`}
                          label="Condições de acesso e limitações"
                        >
                          <Textarea
                            defaultValue={item.accessNote ?? ""}
                            id={`library-${item.id}-edit-access-note`}
                            name="accessNote"
                            placeholder="Condições de acesso e eventuais limitações"
                          />
                        </LibraryEditField>
                        <LibraryEditField
                          fieldId={`library-${item.id}-edit-lesson`}
                          label="Aula relacionada (opcional)"
                        >
                          <select
                            className="h-11 rounded-sm border bg-transparent px-3 text-sm"
                            defaultValue={item.lesson?.id ?? ""}
                            id={`library-${item.id}-edit-lesson`}
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
                        </LibraryEditField>
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
          {items.length > 0 && (page > 1 || hasMore) && (
            <nav
              aria-label="Paginação do catálogo"
              className="mt-8 flex flex-wrap items-center justify-between gap-3"
            >
              {page > 1 ? (
                <Button asChild variant="outline">
                  <IntentLink href={`/admin/library?page=${page - 1}`}>
                    Página anterior
                  </IntentLink>
                </Button>
              ) : (
                <span />
              )}
              <span
                aria-live="polite"
                className="text-muted-foreground text-sm"
              >
                Página {page}
              </span>
              {hasMore && (
                <Button asChild variant="outline">
                  <IntentLink href={`/admin/library?page=${page + 1}`}>
                    Próxima página
                  </IntentLink>
                </Button>
              )}
            </nav>
          )}
        </section>
        <aside className="paper-surface border p-6 lg:sticky lg:top-24">
          <p className="brand-eyebrow">Novo material</p>
          <form
            action={createLibraryItem}
            className="mt-5 space-y-4"
            encType="multipart/form-data"
          >
            <input name="idempotencyKey" type="hidden" value={randomUUID()} />
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
            <label className="block" htmlFor="library-cover-url">
              <span className="brand-eyebrow">Capa ou imagem (URL HTTPS)</span>
              <Input
                className="mt-2"
                id="library-cover-url"
                name="coverUrl"
                placeholder="https://…"
                type="url"
              />
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
                placeholder="https://…"
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
            <label className="block" htmlFor="library-authors">
              <span className="brand-eyebrow">Autor ou instituição</span>
              <Input
                className="mt-2"
                id="library-authors"
                name="authors"
                placeholder="Autores"
              />
            </label>
            <label className="block" htmlFor="library-year">
              <span className="brand-eyebrow">Ano</span>
              <Input
                className="mt-2"
                id="library-year"
                name="year"
                placeholder="Ano"
                type="number"
              />
            </label>
            <label className="block" htmlFor="library-doi">
              <span className="brand-eyebrow">DOI (opcional)</span>
              <Input className="mt-2" id="library-doi" name="doi" />
            </label>
            <label className="block" htmlFor="library-pmid">
              <span className="brand-eyebrow">PMID (opcional)</span>
              <Input className="mt-2" id="library-pmid" name="pmid" />
            </label>
            <label className="block" htmlFor="library-language">
              <span className="brand-eyebrow">Idioma(s)</span>
              <Input
                className="mt-2"
                id="library-language"
                name="language"
                placeholder="en,pt"
              />
              <span className="mt-1 block text-muted-foreground text-xs">
                Use códigos como en, pt ou es.
              </span>
            </label>
            <label className="block" htmlFor="library-difficulty">
              <span className="brand-eyebrow">Nível</span>
              <select
                className="mt-2 h-11 w-full rounded-sm border bg-transparent px-3 text-sm"
                defaultValue="INTERMEDIATE"
                id="library-difficulty"
                name="difficulty"
              >
                <option value="INTRODUCTORY">Introdutório</option>
                <option value="INTERMEDIATE">Intermediário</option>
                <option value="ADVANCED">Avançado</option>
              </select>
            </label>
            <label className="block" htmlFor="library-access-type">
              <span className="brand-eyebrow">Acesso</span>
              <select
                className="mt-2 h-11 w-full rounded-sm border bg-transparent px-3 text-sm"
                defaultValue="FREE_TO_READ"
                id="library-access-type"
                name="accessType"
              >
                <option value="OPEN_ACCESS">Acesso aberto</option>
                <option value="FREE_TO_READ">Leitura gratuita</option>
                <option value="FREE_TOOL">Ferramenta gratuita</option>
              </select>
            </label>
            <label className="block" htmlFor="library-version">
              <span className="brand-eyebrow">Versão/edição</span>
              <Input
                className="mt-2"
                id="library-version"
                name="version"
                placeholder="Versão/edição (opcional)"
              />
            </label>
            <label className="block" htmlFor="library-access-note">
              <span className="brand-eyebrow">Condições de acesso</span>
              <Textarea
                className="mt-2"
                id="library-access-note"
                name="accessNote"
                placeholder="Acesso aberto, cadastro gratuito ou limitações"
              />
            </label>
            <label className="grid gap-2 text-sm" htmlFor="library-lesson">
              <span className="brand-eyebrow">Aula relacionada (opcional)</span>
              <select
                className="h-11 rounded-sm border bg-transparent px-3 text-sm"
                defaultValue=""
                id="library-lesson"
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

export default AdminLibraryPage;
