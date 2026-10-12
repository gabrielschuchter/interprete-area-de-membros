"use client";

import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import type { getGestaoLibraryCatalog } from "@/lib/gestao-library";
import {
  applyGestaoLibraryBulkAction,
  type GestaoLibraryBulkState,
} from "@/lib/gestao-library-actions";

type Catalog = Awaited<ReturnType<typeof getGestaoLibraryCatalog>>;
type LibraryItem = Catalog["items"][number];

const initialState: GestaoLibraryBulkState = { status: "idle" };
const maximumBulkSelection = 100;

const itemTypeLabels: Record<string, string> = {
  ARTICLE: "Artigo",
  PDF: "PDF",
  GUIDE: "Guia",
  LINK: "Link",
  VIDEO: "Vídeo",
};

const itemStatusLabels: Record<string, string> = {
  ARCHIVED: "Arquivado",
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
};

const accessLabels: Record<string, string> = {
  OPEN_ACCESS: "Acesso aberto",
  FREE_TO_READ: "Leitura gratuita",
  FREE_TOOL: "Ferramenta gratuita",
};

const difficultyLabels: Record<string, string> = {
  ADVANCED: "Avançado",
  INTRODUCTORY: "Introdutório",
  INTERMEDIATE: "Intermediário",
};

const itemDetail = (item: LibraryItem) =>
  [
    item.category,
    item.language,
    item.difficulty ? difficultyLabels[item.difficulty] : null,
  ]
    .filter(Boolean)
    .join(" · ");

const coverBackground = (value: string | null) => {
  if (!value) {
    return undefined;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      return undefined;
    }
    const cssSafeUrl = url.href
      .replaceAll('"', "%22")
      .replaceAll("(", "%28")
      .replaceAll(")", "%29");
    return { backgroundImage: `url("${cssSafeUrl}")` };
  } catch {
    return undefined;
  }
};

const ItemCheckbox = ({
  checked,
  item,
  onToggle,
}: {
  readonly checked: boolean;
  readonly item: LibraryItem;
  readonly onToggle: (id: string) => void;
}) => (
  <input
    aria-label={`Selecionar ${item.title}`}
    checked={checked}
    className="gl-checkbox"
    onChange={() => onToggle(item.id)}
    type="checkbox"
  />
);

const ItemStatus = ({ item }: { readonly item: LibraryItem }) => (
  <span className={`gl-status gl-status-${item.status.toLowerCase()}`}>
    {itemStatusLabels[item.status] ?? item.status}
  </span>
);

const LibraryListRow = ({
  item,
  onToggle,
  selected,
}: {
  readonly item: LibraryItem;
  readonly onToggle: (id: string) => void;
  readonly selected: boolean;
}) => (
  <li className={`gl-list-row ${selected ? "is-selected" : ""}`}>
    <ItemCheckbox checked={selected} item={item} onToggle={onToggle} />
    <div className="gl-material-cell">
      <span aria-hidden="true" className="gl-material-mark">
        <span>{"///"}</span>
      </span>
      <div className="gl-item-copy">
        <Link href={`/gestao/ensino/biblioteca/${item.id}`} prefetch={false}>
          {item.title}
        </Link>
        <small>{itemDetail(item) || item.authors || "Sem categoria"}</small>
      </div>
    </div>
    <span className="gl-cell-type">
      {itemTypeLabels[item.kind] ?? item.kind}
    </span>
    <span className="gl-cell-access">
      {item.accessType ? accessLabels[item.accessType] : "Não classificado"}
    </span>
    <ItemStatus item={item} />
    <Link
      aria-label={`Editar ${item.title}`}
      className="gl-edit-link"
      href={`/gestao/ensino/biblioteca/${item.id}`}
      prefetch={false}
    >
      Editar
    </Link>
  </li>
);

const LibraryGridCard = ({
  item,
  onToggle,
  selected,
}: {
  readonly item: LibraryItem;
  readonly onToggle: (id: string) => void;
  readonly selected: boolean;
}) => (
  <article className={`gl-grid-card ${selected ? "is-selected" : ""}`}>
    <div
      aria-hidden="true"
      className="gl-cover"
      style={coverBackground(item.coverUrl)}
    >
      <span>{itemTypeLabels[item.kind] ?? item.kind}</span>
    </div>
    <div className="gl-grid-copy">
      <div className="gl-grid-title-row">
        <ItemCheckbox checked={selected} item={item} onToggle={onToggle} />
        <Link href={`/gestao/ensino/biblioteca/${item.id}`} prefetch={false}>
          {item.title}
        </Link>
      </div>
      <p>{itemDetail(item) || item.authors || "Sem categoria"}</p>
      <div className="gl-grid-footer">
        <ItemStatus item={item} />
        <Link href={`/gestao/ensino/biblioteca/${item.id}`} prefetch={false}>
          Editar
        </Link>
      </div>
    </div>
  </article>
);

export const GestaoLibraryCatalog = ({ data }: { readonly data: Catalog }) => {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    applyGestaoLibraryBulkAction,
    initialState
  );
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [selectionLimitHit, setSelectionLimitHit] = useState(false);
  const allSelected =
    data.items.length > 0 && data.items.every(({ id }) => selected.has(id));

  const toggleSelected = (id: string) => {
    if (!selected.has(id) && selected.size >= maximumBulkSelection) {
      setSelectionLimitHit(true);
      return;
    }
    setSelectionLimitHit(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const togglePage = () => {
    const pageIds = data.items.map(({ id }) => id);
    if (allSelected) {
      setSelectionLimitHit(false);
      setSelected((current) => {
        const next = new Set(current);
        for (const id of pageIds) {
          next.delete(id);
        }
        return next;
      });
      return;
    }
    const newSelections = pageIds.filter((id) => !selected.has(id)).length;
    if (selected.size + newSelections > maximumBulkSelection) {
      setSelectionLimitHit(true);
      return;
    }
    setSelectionLimitHit(false);
    setSelected((current) => new Set([...current, ...pageIds]));
  };

  useEffect(() => {
    if (state.status === "success") {
      setSelected(new Set());
      setSelectionLimitHit(false);
      router.refresh();
    }
  }, [router, state]);

  let catalogContent: React.ReactNode;
  if (data.items.length === 0) {
    catalogContent = (
      <div className="gl-empty">
        <h2>Nenhum material nesta busca.</h2>
        <p>Altere os filtros ou cadastre uma referência para a biblioteca.</p>
      </div>
    );
  } else if (data.filters.view === "list") {
    catalogContent = (
      <ul aria-label="Materiais da biblioteca" className="gl-list">
        <li aria-hidden="true" className="gl-list-heading">
          <span />
          <span>Material</span>
          <span>Tipo</span>
          <span>Acesso</span>
          <span>Estado</span>
          <span />
        </li>
        {data.items.map((item) => (
          <LibraryListRow
            item={item}
            key={item.id}
            onToggle={toggleSelected}
            selected={selected.has(item.id)}
          />
        ))}
      </ul>
    );
  } else {
    catalogContent = (
      <div className="gl-grid">
        {data.items.map((item) => (
          <LibraryGridCard
            item={item}
            key={item.id}
            onToggle={toggleSelected}
            selected={selected.has(item.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <form action={formAction} className="gl-bulk-form">
      {[...selected].map((id) => (
        <input key={id} name="itemIds" type="hidden" value={id} />
      ))}
      <div
        aria-label="Ações em lote"
        className="gl-bulk-toolbar"
        role="toolbar"
      >
        <label className="gl-select-page">
          <input checked={allSelected} onChange={togglePage} type="checkbox" />
          <span className="sr-only">Selecionar materiais desta página</span>
          <span>{selected.size} selecionado(s)</span>
        </label>
        <Button
          disabled={pending || selected.size === 0}
          name="intent"
          type="submit"
          value="publish"
        >
          Publicar
        </Button>
        <Button
          disabled={pending || selected.size === 0}
          name="intent"
          type="submit"
          value="archive"
          variant="outline"
        >
          Arquivar
        </Button>
        <label className="gl-bulk-category">
          <span className="sr-only">Categoria para os itens selecionados</span>
          <input maxLength={80} name="category" placeholder="Nova categoria" />
        </label>
        <Button
          disabled={pending || selected.size === 0}
          name="intent"
          type="submit"
          value="category"
          variant="outline"
        >
          Aplicar categoria
        </Button>
        <label className="gl-bulk-collection">
          <span className="sr-only">Coleção para os itens selecionados</span>
          <select defaultValue="" name="collectionId">
            <option disabled value="">
              Adicionar a uma coleção
            </option>
            {data.collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.title}
              </option>
            ))}
          </select>
        </label>
        <Button
          disabled={pending || selected.size === 0}
          name="intent"
          type="submit"
          value="collection"
          variant="outline"
        >
          Adicionar
        </Button>
        <Button
          className="gl-clear-selection"
          disabled={selected.size === 0 || pending}
          onClick={() => setSelected(new Set())}
          type="button"
          variant="ghost"
        >
          Limpar seleção
        </Button>
      </div>
      {selectionLimitHit ? (
        <output aria-live="polite" className="gl-result is-error">
          Selecione no máximo {maximumBulkSelection} materiais por ação.
        </output>
      ) : null}
      {state.message ? (
        <output
          aria-live={state.status === "error" ? "assertive" : "polite"}
          className={`gl-result ${state.status === "error" ? "is-error" : ""}`}
        >
          {state.message}
        </output>
      ) : null}
      {catalogContent}
    </form>
  );
};
