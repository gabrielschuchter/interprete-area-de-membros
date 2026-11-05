"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GestaoErase } from "@/app/(authenticated)/gestao/apagar/erase-dialog";
import { setGestaoCollectionStatus } from "@/app/(authenticated)/gestao/ensino/colecoes/actions";
import { GestaoIcon } from "@/app/(authenticated)/gestao/gestao-icon";
import { collectionCoverStyle } from "@/lib/collection-covers";
import type { getGestaoCollectionsCatalog } from "@/lib/gestao-collections";

type CatalogData = Awaited<ReturnType<typeof getGestaoCollectionsCatalog>>;
type Collection = CatalogData["items"][number];
type ActionKeys = Readonly<
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

const labels: Record<string, string> = {
  ARCHIVED: "Arquivada",
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
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

const nextStatus = {
  ARCHIVED: { label: "Reabrir como rascunho", key: "restore", status: "DRAFT" },
  DRAFT: { label: "Publicar", key: "publish", status: "PUBLISHED" },
  PUBLISHED: { label: "Arquivar", key: "archive", status: "ARCHIVED" },
} as const;

const StatusForm = ({
  collection,
  idempotencyKey,
}: {
  readonly collection: Collection;
  readonly idempotencyKey: string;
}) => {
  const next = nextStatus[collection.status];
  return (
    <form action={setGestaoCollectionStatus}>
      <input name="id" type="hidden" value={collection.id} />
      <input
        name="version"
        type="hidden"
        value={collection.updatedAt.toISOString()}
      />
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <input name="status" type="hidden" value={next.status} />
      <button className="gk-menu-form-btn" type="submit">
        {next.label}
      </button>
    </form>
  );
};

const CollectionMenu = ({
  collection,
  keys,
}: {
  readonly collection: Collection;
  readonly keys: ActionKeys[string];
}) => {
  const router = useRouter();
  const statusKey = keys[nextStatus[collection.status].key];
  return (
    <GestaoErase
      consequence="Os itens continuam existindo; só a coleção some."
      id={collection.id}
      kind="collection"
      noun="coleção"
      title={collection.title}
    >
      {(openErase) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`Mais ações para ${collection.title}`}
              className="gk-icon-btn"
              type="button"
            >
              <GestaoIcon name="dots" size={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="gk-menu">
            <DropdownMenuItem
              onSelect={() =>
                router.push(`/gestao/ensino/colecoes/${collection.id}`)
              }
            >
              Editar coleção
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                router.push(`/gestao/ensino/colecoes/${collection.id}/previa`)
              }
            >
              Pré-visualizar como aluno
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <StatusForm collection={collection} idempotencyKey={statusKey} />
            </DropdownMenuItem>
            <DropdownMenuItem className="gk-menu-danger" onSelect={openErase}>
              Apagar coleção
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </GestaoErase>
  );
};

const emptyKeys = { archive: "", delete: "", publish: "", restore: "" };

const CollectionCard = ({
  collection,
  keys,
}: {
  readonly collection: Collection;
  readonly keys: ActionKeys[string];
}) => (
  <article className="gk-colcard">
    <div
      aria-label={
        collection.coverUrl ? `Capa: ${collection.title}` : "Capa editorial"
      }
      className="gk-colcover"
      role="img"
      style={collectionCoverStyle(collection.coverUrl)}
    />
    <div className="gk-colbody">
      <div className="gk-colhead">
        <Link
          className="gk-coltitle"
          href={`/gestao/ensino/colecoes/${collection.id}`}
          prefetch={false}
        >
          {collection.title}
        </Link>
        <span
          className="gk-chip"
          data-tone={collection.status === "PUBLISHED" ? "active" : "neutral"}
        >
          <GestaoIcon
            name={collection.status === "PUBLISHED" ? "check-circle" : "pencil"}
            size={12}
          />
          {statusLabel(collection)}
        </span>
      </div>
      <p className="gk-colmeta">
        {collection._count.items}{" "}
        {collection._count.items === 1 ? "item" : "itens"} ·{" "}
        {collection.status === "DRAFT"
          ? "Ainda não visível"
          : (collection.audienceSpace?.title ?? "Todos os membros")}
      </p>
      <div className="gk-colactions">
        <Link
          className="gk-btn"
          href={`/gestao/ensino/colecoes/${collection.id}`}
          prefetch={false}
        >
          Editar
        </Link>
        <CollectionMenu collection={collection} keys={keys} />
      </div>
    </div>
  </article>
);

export const GestaoCollectionCatalog = ({
  data,
  actionKeys,
}: {
  readonly data: CatalogData;
  readonly actionKeys: ActionKeys;
}) =>
  data.items.length === 0 ? (
    <section aria-live="polite" className="gk-empty-card">
      <GestaoIcon name="columns" size={28} />
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
    <section aria-label="Coleções" className="gk-colgrid">
      {data.items.map((collection) => (
        <CollectionCard
          collection={collection}
          key={collection.id}
          keys={actionKeys[collection.id] ?? emptyKeys}
        />
      ))}
    </section>
  );
