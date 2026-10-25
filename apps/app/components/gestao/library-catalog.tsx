"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { GestaoIcon } from "@/app/(authenticated)/gestao/gestao-icon";
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

const statusIcons = {
  ARCHIVED: "archive",
  DRAFT: "pencil",
  PUBLISHED: "check-circle",
} as const;

const kindIcons = {
  ARTICLE: "file",
  GUIDE: "file",
  LINK: "link",
  PDF: "file",
  VIDEO: "video",
} as const;

const formId = "gestao-library-bulk";

const ItemStatus = ({ item }: { readonly item: LibraryItem }) => (
  <span
    className="gk-chip"
    data-tone={item.status === "PUBLISHED" ? "active" : "neutral"}
  >
    <GestaoIcon name={statusIcons[item.status]} size={12} />
    {itemStatusLabels[item.status] ?? item.status}
  </span>
);

const ItemMenu = ({ item }: { readonly item: LibraryItem }) => {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Mais ações de ${item.title}`}
          className="gk-icon-btn gk-icon-btn--bare"
          type="button"
        >
          <GestaoIcon name="dots" size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="gk-menu">
        <DropdownMenuItem
          onSelect={() => router.push(`/gestao/ensino/biblioteca/${item.id}`)}
        >
          Editar material
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const LibraryRow = ({
  item,
  onToggle,
  selected,
}: {
  readonly item: LibraryItem;
  readonly onToggle: (id: string) => void;
  readonly selected: boolean;
}) => (
  <tr data-selected={selected}>
    <td className="gk-col-check">
      <input
        aria-label={`Selecionar ${item.title}`}
        checked={selected}
        onChange={() => onToggle(item.id)}
        type="checkbox"
      />
    </td>
    <td>
      <div className="gk-person">
        <span aria-hidden="true" className="gk-kindtile">
          <GestaoIcon name="book" size={18} />
        </span>
        <div>
          <Link
            className="gk-qtitle"
            href={`/gestao/ensino/biblioteca/${item.id}`}
            prefetch={false}
          >
            {item.title}
          </Link>
          <small className="gk-qsub">
            {itemDetail(item) || item.authors || "Sem categoria"}
          </small>
        </div>
      </div>
    </td>
    <td>
      <span className="gk-kind">
        <GestaoIcon name={kindIcons[item.kind]} size={14} />
        {itemTypeLabels[item.kind] ?? item.kind}
      </span>
    </td>
    <td>
      {item.accessType
        ? accessLabels[item.accessType]
        : "Acesso não classificado"}
    </td>
    <td>
      <ItemStatus item={item} />
    </td>
    <td className="gk-col-menu">
      <ItemMenu item={item} />
    </td>
  </tr>
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
  <article className="gk-libcard" data-selected={selected}>
    <div
      aria-hidden="true"
      className="gk-libcover"
      style={coverBackground(item.coverUrl)}
    >
      <span>{itemTypeLabels[item.kind] ?? item.kind}</span>
    </div>
    <div className="gk-libcopy">
      <label className="gk-libpick">
        <input
          aria-label={`Selecionar ${item.title}`}
          checked={selected}
          onChange={() => onToggle(item.id)}
          type="checkbox"
        />
      </label>
      <Link
        className="gk-libtitle"
        href={`/gestao/ensino/biblioteca/${item.id}`}
        prefetch={false}
      >
        {item.title}
      </Link>
      <p>{itemDetail(item) || item.authors || "Sem categoria"}</p>
      <div className="gk-libfoot">
        <ItemStatus item={item} />
        <ItemMenu item={item} />
      </div>
    </div>
  </article>
);

const BulkDialog = ({
  children,
  description,
  intent,
  label,
  onClose,
  title,
}: {
  readonly children: React.ReactNode;
  readonly description: string;
  readonly intent: string;
  readonly label: string;
  readonly onClose: () => void;
  readonly title: string;
}) => (
  <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
    <DialogContent
      className="gk-modal gk-modal--narrow"
      overlayClassName="gk-modal-overlay"
      showCloseButton={false}
    >
      <div className="gk-modal-head">
        <div>
          <DialogTitle className="gk-modal-title">{title}</DialogTitle>
          <DialogDescription className="gk-modal-sub">
            {description}
          </DialogDescription>
        </div>
      </div>
      <div className="gk-modal-body">{children}</div>
      <div className="gk-modal-foot">
        <span className="gk-spacer" />
        <button className="gk-btn" onClick={onClose} type="button">
          Cancelar
        </button>
        <button
          className="gk-btn gk-btn--primary"
          form={formId}
          name="intent"
          onClick={() => window.setTimeout(onClose, 0)}
          type="submit"
          value={intent}
        >
          {label}
        </button>
      </div>
    </DialogContent>
  </Dialog>
);

export const GestaoLibraryCatalog = ({ data }: { readonly data: Catalog }) => {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    applyGestaoLibraryBulkAction,
    initialState
  );
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [selectionLimitHit, setSelectionLimitHit] = useState(false);
  const [dialog, setDialog] = useState<"category" | "collection" | null>(null);

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

  const allSelected =
    data.items.length > 0 && data.items.every(({ id }) => selected.has(id));
  const togglePage = () => {
    const pageIds = data.items.map(({ id }) => id);
    if (allSelected) {
      setSelected((current) => {
        const next = new Set(current);
        for (const id of pageIds) {
          next.delete(id);
        }
        return next;
      });
      return;
    }
    const additions = pageIds.filter((id) => !selected.has(id)).length;
    if (selected.size + additions > maximumBulkSelection) {
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
      <div className="gk-table-card">
        <p className="gk-empty-cell gk-empty-block">
          Nenhum material nesta busca. Altere os filtros ou cadastre uma
          referência para a biblioteca.
        </p>
      </div>
    );
  } else if (data.filters.view === "list") {
    catalogContent = (
      <div className="gk-table-card">
        <table className="gk-table gk-qtable">
          <thead>
            <tr>
              <th className="gk-col-check">
                <input
                  aria-label="Selecionar materiais desta página"
                  checked={allSelected}
                  onChange={togglePage}
                  type="checkbox"
                />
              </th>
              <th>Material</th>
              <th>Tipo</th>
              <th>Acesso</th>
              <th>Estado</th>
              <th className="gk-col-menu" />
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <LibraryRow
                item={item}
                key={item.id}
                onToggle={toggleSelected}
                selected={selected.has(item.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  } else {
    catalogContent = (
      <div className="gk-libgrid">
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
    <form action={formAction} id={formId}>
      {[...selected].map((id) => (
        <input key={id} name="itemIds" type="hidden" value={id} />
      ))}
      {selected.size ? (
        <div aria-label="Ações em lote" className="gk-bulkbar" role="toolbar">
          <strong>
            {selected.size}{" "}
            {selected.size === 1 ? "selecionado" : "selecionados"}
          </strong>
          <button
            disabled={pending}
            name="intent"
            type="submit"
            value="publish"
          >
            <GestaoIcon name="check" size={14} /> Publicar
          </button>
          <button
            disabled={pending}
            name="intent"
            type="submit"
            value="archive"
          >
            <GestaoIcon name="archive" size={14} /> Arquivar
          </button>
          <button onClick={() => setDialog("category")} type="button">
            <GestaoIcon name="sliders" size={14} /> Editar categoria
          </button>
          <button onClick={() => setDialog("collection")} type="button">
            <GestaoIcon name="star" size={14} /> Adicionar a uma coleção
          </button>
          <button
            className="gk-bulkbar-clear"
            onClick={() => setSelected(new Set())}
            type="button"
          >
            Limpar seleção
          </button>
        </div>
      ) : null}
      {selectionLimitHit ? (
        <output aria-live="polite" className="gk-error-box">
          Selecione no máximo {maximumBulkSelection} materiais por ação.
        </output>
      ) : null}
      {state.message ? (
        <output
          aria-live={state.status === "error" ? "assertive" : "polite"}
          className={state.status === "error" ? "gk-error-box" : "gk-result"}
        >
          {state.message}
        </output>
      ) : null}
      {catalogContent}
      {dialog === "category" ? (
        <BulkDialog
          description="A categoria nova substitui a atual dos materiais selecionados."
          intent="category"
          label="Aplicar categoria"
          onClose={() => setDialog(null)}
          title="Editar categoria"
        >
          <div className="gk-label">
            <label htmlFor="bulk-category">Categoria</label>
            <input
              autoFocus
              className="gk-input"
              form={formId}
              id="bulk-category"
              list="bulk-category-options"
              maxLength={80}
              name="category"
              placeholder="Ex.: Revisões sistemáticas"
            />
            <datalist id="bulk-category-options">
              {data.categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>
        </BulkDialog>
      ) : null}
      {dialog === "collection" ? (
        <BulkDialog
          description="Os materiais entram no fim da coleção; os que já estão nela são ignorados."
          intent="collection"
          label="Adicionar"
          onClose={() => setDialog(null)}
          title="Adicionar a uma coleção"
        >
          <div className="gk-label">
            <label htmlFor="bulk-collection">Coleção</label>
            <span className="gk-field gk-field--full">
              <select
                className="gk-select gk-select--plain"
                defaultValue=""
                form={formId}
                id="bulk-collection"
                name="collectionId"
              >
                <option disabled value="">
                  Escolha uma coleção
                </option>
                {data.collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.title}
                  </option>
                ))}
              </select>
            </span>
          </div>
        </BulkDialog>
      ) : null}
    </form>
  );
};
