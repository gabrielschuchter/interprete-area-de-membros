import { LibraryItemDifficulty, LibraryItemKind } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { importCuratedLibraryCatalog } from "@/app/(authenticated)/biblioteca/actions";
import { GestaoLibraryCatalog } from "@/components/gestao/library-catalog";
import { getGestaoLibraryCatalog } from "@/lib/gestao-library";
import { buildGestaoLibraryHref } from "@/lib/gestao-library-domain";

interface GestaoLibraryPageProperties {
  readonly searchParams: Promise<{
    readonly categoria?: string;
    readonly idioma?: string;
    readonly modo?: string;
    readonly nivel?: string;
    readonly pagina?: string;
    readonly q?: string;
    readonly resultado?: string;
    readonly estado?: string;
    readonly tipo?: string;
    readonly catalog?: string;
    readonly uploadPaused?: string;
  }>;
}

const typeLabels: Record<LibraryItemKind, string> = {
  ARTICLE: "Artigo",
  GUIDE: "Guia",
  LINK: "Link",
  PDF: "PDF",
  VIDEO: "Vídeo",
};

const statusLabels: Record<string, string> = {
  ALL: "Todos",
  ARCHIVED: "Arquivados",
  DRAFT: "Rascunhos",
  PUBLISHED: "Publicados",
};

const difficultyLabels: Record<LibraryItemDifficulty, string> = {
  ADVANCED: "Avançado",
  INTRODUCTORY: "Introdutório",
  INTERMEDIATE: "Intermediário",
};

const resultMessages: Record<string, string> = {
  "material-atualizado": "Material atualizado.",
  "material-criado": "Material salvo como rascunho.",
  "material-existente": "Este material já tinha sido salvo.",
};

const catalogMessages: Record<string, string> = {
  imported:
    "A curadoria verificada foi sincronizada; correspondências existentes foram atualizadas e duplicatas evitadas.",
};

const GestaoLibraryPage = async ({
  searchParams,
}: GestaoLibraryPageProperties) => {
  const query = await searchParams;
  const data = await getGestaoLibraryCatalog({
    category: query.categoria,
    difficulty: query.nivel,
    kind: query.tipo,
    language: query.idioma,
    page: query.pagina,
    query: query.q,
    status: query.estado,
    view: query.modo,
  });
  const filters = data.filters;
  const result = query.resultado ? resultMessages[query.resultado] : null;
  const catalogMessage = query.catalog ? catalogMessages[query.catalog] : null;

  return (
    <section className="gestao-page-content gl-page">
      <header className="gl-heading">
        <div>
          <p className="gestao-eyebrow">
            Gestão <span aria-hidden="true">›</span> Ensino{" "}
            <span aria-hidden="true">›</span> Biblioteca
          </p>
          <h1>Biblioteca</h1>
          <p>
            {data.total} resultado(s) para os filtros atuais. A curadoria
            revisada é aditiva e evita duplicatas.
          </p>
        </div>
        <div className="gl-heading-actions">
          <form action={importCuratedLibraryCatalog}>
            <input name="surface" type="hidden" value="gestao" />
            <Button type="submit" variant="outline">
              Importar curadoria verificada
            </Button>
          </form>
          <Button asChild>
            <Link href="/gestao/ensino/biblioteca/novo" prefetch={false}>
              Novo material
            </Link>
          </Button>
        </div>
      </header>
      {result ? <output className="gl-result">{result}</output> : null}
      {catalogMessage ? (
        <output className="gl-result">{catalogMessage}</output>
      ) : null}
      {query.uploadPaused === "1" ? (
        <output className="gl-result">
          O envio de arquivo está pausado. Nenhuma alteração foi aplicada; use
          um link ou tente novamente quando o Storage estiver disponível.
        </output>
      ) : null}
      <form
        action="/gestao/ensino/biblioteca"
        className="gl-filters"
        method="get"
      >
        <label className="gl-search" htmlFor="gl-query">
          <span aria-hidden="true">⌕</span>
          <input
            defaultValue={filters.query}
            id="gl-query"
            maxLength={120}
            name="q"
            placeholder="Buscar por título, autor, DOI ou PMID"
          />
        </label>
        <label>
          <span className="sr-only">Tipo</span>
          <select defaultValue={filters.kind} name="tipo">
            <option value="">Tipo</option>
            {Object.values(LibraryItemKind).map((kind) => (
              <option key={kind} value={kind}>
                {typeLabels[kind]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Categoria</span>
          <select defaultValue={filters.category} name="categoria">
            <option value="">Categoria</option>
            {data.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Idioma</span>
          <select defaultValue={filters.language} name="idioma">
            <option value="">Idioma</option>
            {data.languages.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Nível</span>
          <select defaultValue={filters.difficulty} name="nivel">
            <option value="">Nível</option>
            {Object.values(LibraryItemDifficulty).map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {difficultyLabels[difficulty]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Estado</span>
          <select defaultValue={filters.status} name="estado">
            {Object.entries(statusLabels).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <input name="modo" type="hidden" value={filters.view} />
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
        <fieldset className="gl-view-switch">
          <legend className="sr-only">Modo de visualização</legend>
          <Link
            aria-current={filters.view === "list" ? "page" : undefined}
            className={filters.view === "list" ? "is-active" : ""}
            href={buildGestaoLibraryHref("/gestao/ensino/biblioteca", filters, {
              view: "list",
              page: 1,
            })}
            prefetch={false}
          >
            Lista
          </Link>
          <Link
            aria-current={filters.view === "grid" ? "page" : undefined}
            className={filters.view === "grid" ? "is-active" : ""}
            href={buildGestaoLibraryHref("/gestao/ensino/biblioteca", filters, {
              view: "grid",
              page: 1,
            })}
            prefetch={false}
          >
            Grade
          </Link>
        </fieldset>
      </form>
      <GestaoLibraryCatalog data={data} />
      {data.pageCount > 1 ? (
        <nav aria-label="Paginação da biblioteca" className="gl-pagination">
          <span>
            {data.total} materiais · página {filters.page} de {data.pageCount}
          </span>
          <div>
            {filters.page <= 1 ? (
              <Button disabled type="button" variant="outline">
                Anterior
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link
                  href={buildGestaoLibraryHref(
                    "/gestao/ensino/biblioteca",
                    filters,
                    { page: filters.page - 1 }
                  )}
                  prefetch={false}
                >
                  Anterior
                </Link>
              </Button>
            )}
            {filters.page >= data.pageCount ? (
              <Button disabled type="button" variant="outline">
                Próxima
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link
                  href={buildGestaoLibraryHref(
                    "/gestao/ensino/biblioteca",
                    filters,
                    { page: filters.page + 1 }
                  )}
                  prefetch={false}
                >
                  Próxima
                </Link>
              </Button>
            )}
          </div>
        </nav>
      ) : (
        <p aria-live="polite" className="gl-pagination-caption">
          {data.total} material(is) nesta busca
        </p>
      )}
    </section>
  );
};

export default GestaoLibraryPage;
