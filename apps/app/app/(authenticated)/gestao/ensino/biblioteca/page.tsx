import { LibraryItemDifficulty, LibraryItemKind } from "@repo/database";
import Link from "next/link";
import { importCuratedLibraryCatalog } from "@/app/(authenticated)/biblioteca/actions";
import { GestaoLibraryCatalog } from "@/components/gestao/library-catalog";
import { getGestaoLibraryCatalog } from "@/lib/gestao-library";
import { buildGestaoLibraryHref } from "@/lib/gestao-library-domain";
import { GestaoFilterBar } from "../../gestao-filter-bar";
import { GestaoIcon } from "../../gestao-icon";

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
  const base = "/gestao/ensino/biblioteca";
  const first = data.total === 0 ? 0 : (filters.page - 1) * 24 + 1;
  const last = Math.min(filters.page * 24, data.total);

  return (
    <section className="gt-page gk-library">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Biblioteca</h1>
          <p>
            Artigos, guias, PDFs e vídeos que o aluno encontra na Biblioteca.
          </p>
        </div>
        <div className="gk-head-actions">
          <form action={importCuratedLibraryCatalog}>
            <input name="surface" type="hidden" value="gestao" />
            <button className="gk-btn" type="submit">
              Importar curadoria verificada
            </button>
          </form>
          <Link
            className="gk-btn gk-btn--primary gk-btn--wide"
            href={`${base}/novo`}
            prefetch={false}
          >
            <GestaoIcon name="plus" size={16} /> Novo material
          </Link>
        </div>
      </header>
      {result ? <output className="gk-result">{result}</output> : null}
      {catalogMessage ? (
        <output className="gk-result">{catalogMessage}</output>
      ) : null}
      {query.uploadPaused === "1" ? (
        <output className="gk-result">
          O envio de arquivo está pausado. Nenhuma alteração foi aplicada; use
          um link ou tente novamente quando o Storage estiver disponível.
        </output>
      ) : null}
      <div className="gk-toolbar">
        <GestaoFilterBar
          placeholder="Buscar por título, autor, DOI ou PMID"
          query={filters.query}
          selects={[
            {
              label: "Tipo",
              param: "tipo",
              value: filters.kind,
              options: Object.values(LibraryItemKind).map((kind) => [
                kind,
                typeLabels[kind],
              ]),
            },
            {
              label: "Categoria",
              param: "categoria",
              value: filters.category,
              options: data.categories.map((category) => [category, category]),
            },
            {
              label: "Idioma",
              param: "idioma",
              value: filters.language,
              options: data.languages.map((language) => [language, language]),
            },
            {
              label: "Nível",
              param: "nivel",
              value: filters.difficulty,
              options: Object.values(LibraryItemDifficulty).map((level) => [
                level,
                difficultyLabels[level],
              ]),
            },
            {
              label: "Estado",
              param: "estado",
              value: filters.status === "ALL" ? "" : filters.status,
              options: [
                ["DRAFT", "Rascunho"],
                ["PUBLISHED", "Publicado"],
                ["ARCHIVED", "Arquivado"],
              ],
            },
          ]}
        />
        <fieldset className="gk-viewswitch">
          <legend className="sr-only">Modo de visualização</legend>
          {(["list", "grid"] as const).map((view) => (
            <Link
              aria-current={filters.view === view ? "page" : undefined}
              aria-label={view === "list" ? "Lista" : "Grade"}
              className={filters.view === view ? "is-active" : ""}
              href={buildGestaoLibraryHref(base, filters, { view, page: 1 })}
              key={view}
              prefetch={false}
            >
              <GestaoIcon name={view === "list" ? "list" : "grid"} size={16} />
              {view === "list" ? "Lista" : "Grade"}
            </Link>
          ))}
        </fieldset>
      </div>
      <GestaoLibraryCatalog data={data} />
      <nav aria-label="Paginação da biblioteca" className="gk-pager">
        <span>
          {data.total === 0
            ? "0 materiais"
            : `${first} a ${last} de ${data.total}`}
        </span>
        <div>
          {filters.page > 1 ? (
            <Link
              className="gk-btn"
              href={buildGestaoLibraryHref(base, filters, {
                page: filters.page - 1,
              })}
              prefetch={false}
            >
              Anterior
            </Link>
          ) : (
            <span aria-disabled="true" className="gk-btn" data-disabled="true">
              Anterior
            </span>
          )}
          {filters.page < data.pageCount ? (
            <Link
              className="gk-btn"
              href={buildGestaoLibraryHref(base, filters, {
                page: filters.page + 1,
              })}
              prefetch={false}
            >
              Próxima
            </Link>
          ) : (
            <span aria-disabled="true" className="gk-btn" data-disabled="true">
              Próxima
            </span>
          )}
        </div>
      </nav>
    </section>
  );
};

export default GestaoLibraryPage;
