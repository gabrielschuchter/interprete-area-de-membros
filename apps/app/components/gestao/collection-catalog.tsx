"use client";

import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import {
  deleteGestaoCollection,
  setGestaoCollectionStatus,
} from "@/app/(authenticated)/gestao/ensino/colecoes/actions";
import { collectionCoverStyle } from "@/lib/collection-covers";
import type { getGestaoCollectionsCatalog } from "@/lib/gestao-collections";

type CatalogData = Awaited<ReturnType<typeof getGestaoCollectionsCatalog>>;
type Collection = CatalogData["items"][number];

const labels: Record<string, string> = {
  ALL: "Todas",
  ARCHIVED: "Arquivado",
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
};

const statusLabel = (collection: Collection) => {
  if (
    collection.status === "PUBLISHED" &&
    collection.availableAt &&
    collection.availableAt > new Date()
  ) {
    return "Agendada";
  }
  return labels[collection.status] ?? collection.status;
};

const CollectionCard = ({
  collection,
  keys,
}: {
  readonly collection: Collection;
  readonly keys: {
    readonly archive: string;
    readonly delete: string;
    readonly publish: string;
    readonly restore: string;
  };
}) => (
  <article className="gco-collection-card">
    <div
      aria-label={
        collection.coverUrl ? `Capa: ${collection.title}` : "Capa editorial"
      }
      className="gco-card-cover"
      role="img"
      style={collectionCoverStyle(collection.coverUrl)}
    />
    <div className="gco-card-body">
      <div className="gco-card-title-row">
        <Link
          className="gco-card-title"
          href={`/gestao/ensino/colecoes/${collection.id}`}
          prefetch={false}
        >
          {collection.title}
        </Link>
        <span className={`gco-status is-${collection.status.toLowerCase()}`}>
          <span aria-hidden="true">
            {collection.status === "PUBLISHED" ? "✓" : "✎"}
          </span>
          {statusLabel(collection)}
        </span>
      </div>
      <p className="gco-card-meta">
        {collection._count.items}{" "}
        {collection._count.items === 1 ? "item" : "itens"}
        <span aria-hidden="true"> · </span>
        {collection.audienceSpace?.title ?? "Todos os membros"}
      </p>
      <div className="gco-card-actions">
        <Button asChild variant="outline">
          <Link
            href={`/gestao/ensino/colecoes/${collection.id}`}
            prefetch={false}
          >
            Editar
          </Link>
        </Button>
        <details className="gco-card-menu">
          <summary aria-label={`Mais ações para ${collection.title}`}>
            <span aria-hidden="true">···</span>
          </summary>
          <div className="gco-card-menu-popover">
            {collection.status === "DRAFT" ? (
              <form action={setGestaoCollectionStatus}>
                <input name="id" type="hidden" value={collection.id} />
                <input
                  name="version"
                  type="hidden"
                  value={collection.updatedAt.toISOString()}
                />
                <input
                  name="idempotencyKey"
                  type="hidden"
                  value={keys.publish}
                />
                <input name="status" type="hidden" value="PUBLISHED" />
                <button type="submit">Publicar</button>
              </form>
            ) : null}
            {collection.status === "PUBLISHED" ? (
              <form action={setGestaoCollectionStatus}>
                <input name="id" type="hidden" value={collection.id} />
                <input
                  name="version"
                  type="hidden"
                  value={collection.updatedAt.toISOString()}
                />
                <input
                  name="idempotencyKey"
                  type="hidden"
                  value={keys.archive}
                />
                <input name="status" type="hidden" value="ARCHIVED" />
                <button type="submit">Arquivar</button>
              </form>
            ) : null}
            {collection.status === "ARCHIVED" ? (
              <form action={setGestaoCollectionStatus}>
                <input name="id" type="hidden" value={collection.id} />
                <input
                  name="version"
                  type="hidden"
                  value={collection.updatedAt.toISOString()}
                />
                <input
                  name="idempotencyKey"
                  type="hidden"
                  value={keys.restore}
                />
                <input name="status" type="hidden" value="DRAFT" />
                <button type="submit">Reabrir como rascunho</button>
              </form>
            ) : null}
            {collection.status === "DRAFT" && collection._count.items === 0 ? (
              <details className="gco-delete-confirmation">
                <summary>Excluir rascunho</summary>
                <p>Esta ação não pode ser desfeita.</p>
                <form action={deleteGestaoCollection}>
                  <input name="id" type="hidden" value={collection.id} />
                  <input
                    name="version"
                    type="hidden"
                    value={collection.updatedAt.toISOString()}
                  />
                  <input
                    name="idempotencyKey"
                    type="hidden"
                    value={keys.delete}
                  />
                  <button type="submit">Confirmar exclusão</button>
                </form>
              </details>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  </article>
);

export const GestaoCollectionCatalog = ({
  data,
  actionKeys,
}: {
  readonly data: CatalogData;
  readonly actionKeys: Readonly<
    Record<
      string,
      {
        readonly archive: string;
        readonly delete: string;
        readonly publish: string;
        readonly restore: string;
      }
    >
  >;
}) => (
  <div className="gco-catalog-results">
    {data.items.length === 0 ? (
      <section aria-live="polite" className="gco-empty">
        <span aria-hidden="true">◫</span>
        <h2>
          {data.total === 0
            ? "Nenhuma coleção criada ainda."
            : "Nenhuma coleção nesta busca."}
        </h2>
        <p>
          {data.total === 0
            ? "Crie uma curadoria para reunir recursos já existentes, sem duplicá-los."
            : "Altere a busca ou o estado selecionado."}
        </p>
      </section>
    ) : (
      <section aria-label="Coleções" className="gco-collection-grid">
        {data.items.map((collection) => (
          <CollectionCard
            collection={collection}
            key={collection.id}
            keys={
              actionKeys[collection.id] ?? {
                archive: "",
                delete: "",
                publish: "",
                restore: "",
              }
            }
          />
        ))}
      </section>
    )}
  </div>
);
