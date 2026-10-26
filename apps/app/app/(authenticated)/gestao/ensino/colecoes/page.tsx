import { randomUUID } from "node:crypto";
import Link from "next/link";
import { GestaoCollectionCatalog } from "@/components/gestao/collection-catalog";
import { getGestaoCollectionsCatalog } from "@/lib/gestao-collections";
import {
  buildGestaoCollectionsHref,
  gestaoCollectionsPageSize,
} from "@/lib/gestao-collections-domain";
import { GestaoFilterBar } from "../../gestao-filter-bar";

interface GestaoCollectionsPageProperties {
  readonly searchParams: Promise<{
    readonly estado?: string;
    readonly pagina?: string;
    readonly q?: string;
    readonly resultado?: string;
  }>;
}

const resultMessages: Record<string, { message: string; tone: string }> = {
  "status-atualizado": { message: "Estado da coleção atualizado.", tone: "" },
  "colecao-excluida": { message: "Rascunho excluído.", tone: "" },
  conflito: {
    message:
      "A coleção mudou desde que esta tela foi aberta. Atualize os resultados e revise a versão mais recente.",
    tone: "is-error",
  },
  "nao-excluida": {
    message: "Somente rascunhos vazios podem ser excluídos.",
    tone: "is-error",
  },
  "dados-invalidos": {
    message: "A solicitação da coleção está inválida.",
    tone: "is-error",
  },
  erro: {
    message: "Não foi possível atualizar a coleção. Tente novamente.",
    tone: "is-error",
  },
};

const GestaoCollectionsPage = async ({
  searchParams,
}: GestaoCollectionsPageProperties) => {
  const query = await searchParams;
  const data = await getGestaoCollectionsCatalog({
    page: query.pagina,
    query: query.q,
    status: query.estado,
  });
  const result = query.resultado ? resultMessages[query.resultado] : null;
  const actionKeys = Object.fromEntries(
    data.items.map((collection) => [
      collection.id,
      {
        archive: randomUUID(),
        delete: randomUUID(),
        publish: randomUUID(),
        restore: randomUUID(),
      },
    ])
  );

  const filters = data.filters;
  const base = "/gestao/ensino/colecoes";
  const first =
    data.total === 0 ? 0 : (filters.page - 1) * gestaoCollectionsPageSize + 1;
  const last = Math.min(filters.page * gestaoCollectionsPageSize, data.total);

  return (
    <section className="gt-page gk-collections">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Coleções</h1>
          <p>
            Curadorias que reúnem aulas, listas, materiais e gravações de
            qualquer origem, sem duplicá-los.
          </p>
        </div>
        <div className="gk-head-actions">
          <Link
            className="gk-btn gk-btn--primary gk-btn--wide"
            href={`${base}/novo`}
            prefetch={false}
          >
            Nova coleção
          </Link>
        </div>
      </header>

      {result ? (
        <output
          aria-live="polite"
          className={result.tone ? "gk-error-box" : "gk-result"}
        >
          {result.message}
        </output>
      ) : null}

      <div className="gk-toolbar">
        <GestaoFilterBar
          placeholder="Buscar coleções"
          query={filters.query}
          selects={[
            {
              label: "Estado",
              param: "estado",
              value: filters.status === "ALL" ? "" : filters.status,
              options: [
                ["PUBLISHED", "Publicadas"],
                ["DRAFT", "Rascunhos"],
                ["ARCHIVED", "Arquivadas"],
              ],
            },
          ]}
        />
      </div>

      <GestaoCollectionCatalog actionKeys={actionKeys} data={data} />
      <nav aria-label="Paginação das coleções" className="gk-pager">
        <span>
          {data.total === 0
            ? "0 coleções"
            : `${first} a ${last} de ${data.total}`}
        </span>
        <div>
          {filters.page > 1 ? (
            <Link
              className="gk-btn"
              href={buildGestaoCollectionsHref(base, filters, {
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
              href={buildGestaoCollectionsHref(base, filters, {
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

export default GestaoCollectionsPage;
