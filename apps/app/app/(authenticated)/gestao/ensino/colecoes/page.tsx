import { randomUUID } from "node:crypto";
import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { GestaoCollectionCatalog } from "@/components/gestao/collection-catalog";
import { getGestaoCollectionsCatalog } from "@/lib/gestao-collections";
import {
  buildGestaoCollectionsHref,
  type GestaoCollectionStatus,
} from "@/lib/gestao-collections-domain";

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

const statusOptions: ReadonlyArray<readonly [GestaoCollectionStatus, string]> =
  [
    ["ALL", "Estado"],
    ["PUBLISHED", "Publicadas"],
    ["DRAFT", "Rascunhos"],
    ["ARCHIVED", "Arquivadas"],
  ];

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

  return (
    <section className="gestao-page-content gco-catalog-page">
      <header className="gco-catalog-heading">
        <div>
          <p className="gestao-eyebrow">
            Gestão <span aria-hidden="true">›</span> Ensino{" "}
            <span aria-hidden="true">›</span> Coleções
          </p>
          <h1>Coleções</h1>
          <p>
            Curadorias que reúnem aulas, listas, materiais e gravações de
            qualquer origem, sem duplicá-los.
          </p>
        </div>
        <Button asChild>
          <Link href="/gestao/ensino/colecoes/novo" prefetch={false}>
            Nova coleção
          </Link>
        </Button>
      </header>

      {result ? (
        <p
          aria-live="polite"
          className={`gco-result ${result.tone}`}
          role={result.tone ? "alert" : "status"}
        >
          {result.message}
        </p>
      ) : null}

      <form
        action="/gestao/ensino/colecoes"
        className="gco-filters"
        method="get"
      >
        <label className="gco-search" htmlFor="gco-query">
          <span aria-hidden="true">⌕</span>
          <input
            defaultValue={data.filters.query}
            id="gco-query"
            maxLength={120}
            name="q"
            placeholder="Buscar coleções"
          />
        </label>
        <label className="gco-status-filter" htmlFor="gco-status">
          <span className="sr-only">Estado da coleção</span>
          <select
            defaultValue={data.filters.status}
            id="gco-status"
            name="estado"
          >
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      <GestaoCollectionCatalog actionKeys={actionKeys} data={data} />
      <nav aria-label="Paginação das coleções" className="gco-pagination">
        <span>
          {data.total} coleção(ões) · página {data.filters.page} de{" "}
          {data.pageCount}
        </span>
        <div>
          {data.filters.page <= 1 ? (
            <Button disabled type="button" variant="outline">
              Anterior
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link
                href={buildGestaoCollectionsHref(
                  "/gestao/ensino/colecoes",
                  data.filters,
                  { page: data.filters.page - 1 }
                )}
                prefetch={false}
              >
                Anterior
              </Link>
            </Button>
          )}
          {data.filters.page >= data.pageCount ? (
            <Button disabled type="button" variant="outline">
              Próxima
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link
                href={buildGestaoCollectionsHref(
                  "/gestao/ensino/colecoes",
                  data.filters,
                  { page: data.filters.page + 1 }
                )}
                prefetch={false}
              >
                Próxima
              </Link>
            </Button>
          )}
        </div>
      </nav>
    </section>
  );
};

export default GestaoCollectionsPage;
