"use client";

import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  moveGestaoCollectionItem,
  removeGestaoCollectionItem,
  saveGestaoCollection,
} from "@/app/(authenticated)/gestao/ensino/colecoes/actions";
import type { getGestaoCollectionEditorData } from "@/lib/gestao-collections";
import type { GestaoCollectionFormState } from "@/lib/gestao-collections-domain";
import { CollectionCoverPicker } from "./collection-cover-picker";
import { CollectionResourcePicker } from "./collection-resource-picker";

type EditorData = NonNullable<
  Awaited<ReturnType<typeof getGestaoCollectionEditorData>>
>;
type CollectionItem = EditorData["items"][number];

const initialFormState: GestaoCollectionFormState = { status: "idle" };

const statusLabel = (status: string) => {
  if (status === "PUBLISHED") {
    return "Publicado";
  }
  if (status === "ARCHIVED") {
    return "Arquivado";
  }
  return "Rascunho";
};

const dateTimeLocal = (value: Date | null | undefined) => {
  if (!value) {
    return "";
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
};

const savedAtLabel = (value: Date | undefined) =>
  value
    ? `Salvo em ${new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(value)}`
    : "Novo rascunho";

const StatusBadge = ({ status }: { readonly status: string }) => (
  <span className={`gco-status is-${status.toLowerCase()}`}>
    <span aria-hidden="true">{status === "PUBLISHED" ? "✓" : "✎"}</span>
    {statusLabel(status)}
  </span>
);

const FieldError = ({
  id,
  message,
}: {
  readonly id?: string;
  readonly message?: string;
}) =>
  message ? (
    <small className="gco-field-error" id={id}>
      {message}
    </small>
  ) : null;

const itemSymbol = (type: string) => {
  if (type === "EXERCISE_LIST") {
    return "☷";
  }
  if (type === "LIBRARY_ITEM") {
    return "Ⅱ";
  }
  if (type === "RECORDING") {
    return "◷";
  }
  return "▷";
};

const CollectionItemRow = ({
  disabled,
  item,
  nextId,
  onMove,
  onRemove,
  pending,
  previousId,
}: {
  readonly disabled: boolean;
  readonly item: CollectionItem;
  readonly nextId: string | null;
  readonly onMove: (itemId: string, targetId: string, before: boolean) => void;
  readonly onRemove: (item: CollectionItem) => void;
  readonly pending: boolean;
  readonly previousId: string | null;
}) => (
  // biome-ignore lint/a11y/noNoninteractiveElementInteractions: The row is also a drop target; keyboard users have adjacent move controls.
  <li
    className="gco-item-row"
    onDragOver={(event) => event.preventDefault()}
    onDrop={(event) => {
      event.preventDefault();
      const sourceId = event.dataTransfer.getData("text/plain");
      if (sourceId && sourceId !== item.id) {
        const bounds = event.currentTarget.getBoundingClientRect();
        onMove(
          sourceId,
          item.id,
          event.clientY < bounds.top + bounds.height / 2
        );
      }
    }}
  >
    <button
      aria-label={`Arrastar para reordenar ${item.title}`}
      className="gco-drag-handle"
      draggable={!(disabled || pending)}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.id);
      }}
      type="button"
    >
      ⠿
    </button>
    <span aria-hidden="true" className="gco-item-symbol">
      {itemSymbol(item.itemType)}
    </span>
    <div className="gco-item-copy">
      <strong>{item.title}</strong>
      <span>
        {item.typeLabel} · origem: {item.origin}
      </span>
    </div>
    <fieldset className="gco-item-move-actions">
      <legend className="sr-only">Mover {item.title}</legend>
      <button
        aria-label={`Mover ${item.title} para cima`}
        disabled={disabled || pending || !previousId}
        onClick={() => previousId && onMove(item.id, previousId, true)}
        type="button"
      >
        ↑
      </button>
      <button
        aria-label={`Mover ${item.title} para baixo`}
        disabled={disabled || pending || !nextId}
        onClick={() => nextId && onMove(item.id, nextId, false)}
        type="button"
      >
        ↓
      </button>
    </fieldset>
    <button
      aria-label={`Remover ${item.title} desta coleção`}
      className="gco-remove-item"
      disabled={disabled || pending}
      onClick={() => onRemove(item)}
      type="button"
    >
      ×
    </button>
  </li>
);

const CollectionItemList = ({
  data,
  disabled,
  onMove,
  onRemove,
  pending,
}: {
  readonly data: EditorData;
  readonly disabled: boolean;
  readonly onMove: (itemId: string, targetId: string, before: boolean) => void;
  readonly onRemove: (item: CollectionItem) => void;
  readonly pending: boolean;
}) => (
  <ul aria-label="Itens ordenados da coleção" className="gco-item-list">
    {data.items.map((item, index) => {
      const previousId =
        index > 0 ? data.items[index - 1]?.id : data.previousItemId;
      const nextId =
        index < data.items.length - 1
          ? data.items[index + 1]?.id
          : data.nextItemId;
      return (
        <CollectionItemRow
          disabled={disabled}
          item={item}
          key={item.id}
          nextId={nextId ?? null}
          onMove={onMove}
          onRemove={onRemove}
          pending={pending}
          previousId={previousId ?? null}
        />
      );
    })}
  </ul>
);

const CollectionItemPagination = ({ data }: { readonly data: EditorData }) => {
  if (!(data.itemPageCount > 1 && data.collection)) {
    return null;
  }
  const pageHref = (page: number) =>
    `/gestao/ensino/colecoes/${data.collection?.id}?itensPagina=${page}`;
  return (
    <nav
      aria-label="Páginas dos itens da coleção"
      className="gco-item-pagination"
    >
      {data.itemPage > 1 ? (
        <Link href={pageHref(data.itemPage - 1)} prefetch={false}>
          Itens anteriores
        </Link>
      ) : (
        <span />
      )}
      <span>
        Página {data.itemPage} de {data.itemPageCount}
      </span>
      {data.itemPage < data.itemPageCount ? (
        <Link href={pageHref(data.itemPage + 1)} prefetch={false}>
          Próximos itens
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
};

const CollectionItemFeedback = ({
  detailsDirty,
  message,
}: {
  readonly detailsDirty: boolean;
  readonly message: string | null;
}) => (
  <>
    {detailsDirty ? (
      <output aria-live="polite" className="gco-inline-message">
        Salve os detalhes para depois alterar a ordem ou os itens.
      </output>
    ) : null}
    {message ? (
      <output
        aria-live="polite"
        className={`gco-inline-message ${message.includes("não foi") || message.includes("Outra edição") ? "is-error" : ""}`}
      >
        {message}
      </output>
    ) : null}
  </>
);

const CollectionItemRemovalPrompt = ({
  item,
  onCancel,
  onConfirm,
}: {
  readonly item: CollectionItem;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      aria-describedby="gco-remove-item-description"
      aria-labelledby="gco-remove-item-heading"
      className="gco-remove-confirmation"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      ref={dialogRef}
    >
      <div className="gco-remove-confirmation-card">
        <h3 id="gco-remove-item-heading">Remover item publicado?</h3>
        <p id="gco-remove-item-description">
          “{item.title}” deixará de aparecer para os membros. O recurso original
          continuará preservado.
        </p>
        <div>
          <Button autoFocus onClick={onCancel} type="button" variant="outline">
            Cancelar
          </Button>
          <Button onClick={onConfirm} type="button">
            Remover da coleção
          </Button>
        </div>
      </div>
    </dialog>
  );
};

const CollectionItemsPanel = ({
  addItemIdempotencyKey,
  data,
  detailsDirty,
  isArchived,
  version,
}: {
  readonly addItemIdempotencyKey: string;
  readonly data: EditorData;
  readonly detailsDirty: boolean;
  readonly isArchived: boolean;
  readonly version: string;
}) => {
  const router = useRouter();
  const [itemMessage, setItemMessage] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<CollectionItem | null>(
    null
  );
  const [isItemPending, startItemTransition] = useTransition();
  const collection = data.collection;
  const collectionId = collection?.id ?? "";

  const moveItem = (itemId: string, targetItemId: string, before: boolean) => {
    if (!(collectionId && version) || detailsDirty || isArchived) {
      setItemMessage("Salve os detalhes antes de reordenar os itens.");
      return;
    }
    setItemMessage(null);
    startItemTransition(async () => {
      const result = await moveGestaoCollectionItem({
        before,
        collectionId,
        idempotencyKey: crypto.randomUUID(),
        itemId,
        targetItemId,
        version,
      });
      setItemMessage(result.message ?? null);
      router.refresh();
    });
  };

  const executeRemoval = (item: CollectionItem) => {
    if (!(collectionId && version)) {
      setItemMessage("Atualize a página antes de remover itens.");
      setPendingRemoval(null);
      return;
    }
    setPendingRemoval(null);
    setItemMessage(null);
    startItemTransition(async () => {
      const result = await removeGestaoCollectionItem({
        collectionId,
        idempotencyKey: crypto.randomUUID(),
        itemId: item.id,
        version,
      });
      setItemMessage(result.message ?? null);
      router.refresh();
    });
  };

  const requestRemoval = (item: CollectionItem) => {
    if (!(collectionId && version) || detailsDirty || isArchived) {
      setItemMessage("Salve os detalhes antes de remover itens.");
      return;
    }
    if (collection?.status === "PUBLISHED") {
      setPendingRemoval(item);
      return;
    }
    executeRemoval(item);
  };

  return (
    <section aria-labelledby="gco-items-heading" className="gco-items-card">
      <header className="gco-items-heading">
        <div>
          <h2 id="gco-items-heading">Itens da coleção</h2>
          <p>{data.itemCount} recurso(s) em ordem editorial</p>
        </div>
        {collection && !isArchived ? (
          <CollectionResourcePicker
            collectionId={collection.id}
            idempotencyKey={addItemIdempotencyKey}
            version={version}
          />
        ) : (
          <Button disabled type="button">
            Adicionar recursos
          </Button>
        )}
      </header>
      {data.items.length === 0 ? (
        <div className="gco-items-empty">
          <span aria-hidden="true">＋</span>
          <strong>Esta coleção ainda não tem itens.</strong>
          <p>Adicione aulas, listas, materiais ou gravações preservadas.</p>
        </div>
      ) : (
        <CollectionItemList
          data={data}
          disabled={detailsDirty || isArchived || !collection}
          onMove={moveItem}
          onRemove={requestRemoval}
          pending={isItemPending}
        />
      )}
      <CollectionItemPagination data={data} />
      <p className="gco-order-hint">
        Arraste para reordenar ou use os controles de movimento. Remover tira o
        item só desta coleção.
      </p>
      <CollectionItemFeedback
        detailsDirty={detailsDirty}
        message={itemMessage}
      />
      {pendingRemoval ? (
        <CollectionItemRemovalPrompt
          item={pendingRemoval}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={() => executeRemoval(pendingRemoval)}
        />
      ) : null}
    </section>
  );
};

type CollectionFormAction = (formData: FormData) => void;

const CollectionDetailsForm = ({
  action,
  collection,
  coverOptions,
  idempotencyKey,
  groups,
  onChange,
  savePending,
  state,
  version,
}: {
  readonly action: CollectionFormAction;
  readonly collection: EditorData["collection"];
  readonly coverOptions: EditorData["covers"];
  readonly groups: EditorData["groups"];
  readonly idempotencyKey: string;
  readonly onChange: () => void;
  readonly savePending: boolean;
  readonly state: GestaoCollectionFormState;
  readonly version: string;
}) => (
  <form
    action={action}
    aria-busy={savePending}
    className="gco-details-card"
    encType="multipart/form-data"
    id="gco-collection-details"
    onChangeCapture={onChange}
  >
    <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
    {collection ? (
      <>
        <input name="id" type="hidden" value={collection.id} />
        <input name="version" type="hidden" value={version} />
      </>
    ) : null}
    <h2>Detalhes</h2>
    <label className="gco-field" htmlFor="gco-title">
      <span>
        Título <b aria-hidden="true">*</b>
      </span>
      <input
        aria-describedby={
          state.fieldErrors?.title ? "gco-title-error" : undefined
        }
        aria-invalid={Boolean(state.fieldErrors?.title)}
        defaultValue={collection?.title ?? ""}
        id="gco-title"
        maxLength={120}
        name="title"
        placeholder="Ex.: Prática baseada em evidências"
        required
      />
      {state.fieldErrors?.title ? (
        <FieldError id="gco-title-error" message={state.fieldErrors.title} />
      ) : null}
    </label>
    <label className="gco-field" htmlFor="gco-description">
      <span>Descrição</span>
      <textarea
        aria-describedby={
          state.fieldErrors?.description ? "gco-description-error" : undefined
        }
        aria-invalid={Boolean(state.fieldErrors?.description)}
        defaultValue={collection?.description ?? ""}
        id="gco-description"
        maxLength={500}
        name="description"
        rows={3}
      />
      <small>Até 500 caracteres.</small>
      {state.fieldErrors?.description ? (
        <FieldError
          id="gco-description-error"
          message={state.fieldErrors.description}
        />
      ) : null}
    </label>
    <fieldset className="gco-cover-fieldset">
      <legend>Capa</legend>
      <CollectionCoverPicker
        coverOptions={coverOptions}
        initialUrl={collection?.coverUrl ?? ""}
        mutationStatus={state.status}
        onValueChange={onChange}
      />
      <FieldError
        message={state.fieldErrors?.coverUrl ?? state.fieldErrors?.coverFile}
      />
    </fieldset>
    <label className="gco-field" htmlFor="gco-audience">
      <span>Quem vê</span>
      <select
        aria-describedby={
          state.fieldErrors?.audienceSpaceId ? "gco-audience-error" : undefined
        }
        aria-invalid={Boolean(state.fieldErrors?.audienceSpaceId)}
        defaultValue={collection?.audienceSpaceId ?? ""}
        id="gco-audience"
        name="audienceSpaceId"
      >
        <option value="">Todos os membros</option>
        {collection?.audienceSpaceId &&
        !groups.some(({ id }) => id === collection.audienceSpaceId) ? (
          <option value={collection.audienceSpaceId}>
            {collection.audienceSpace?.title ?? "Grupo atual"}
          </option>
        ) : null}
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.title}
          </option>
        ))}
      </select>
      <FieldError
        id="gco-audience-error"
        message={state.fieldErrors?.audienceSpaceId}
      />
    </label>
    <fieldset className="gco-period-fields">
      <legend>Período (opcional)</legend>
      <label className="gco-field" htmlFor="gco-available-at">
        <span>Início</span>
        <input
          aria-describedby={
            state.fieldErrors?.availableAt
              ? "gco-available-at-error"
              : undefined
          }
          aria-invalid={Boolean(state.fieldErrors?.availableAt)}
          defaultValue={dateTimeLocal(collection?.availableAt)}
          id="gco-available-at"
          name="availableAt"
          type="datetime-local"
        />
        <FieldError
          id="gco-available-at-error"
          message={state.fieldErrors?.availableAt}
        />
      </label>
      <label className="gco-field" htmlFor="gco-expires-at">
        <span>Fim</span>
        <input
          aria-describedby={
            state.fieldErrors?.expiresAt ? "gco-expires-at-error" : undefined
          }
          aria-invalid={Boolean(state.fieldErrors?.expiresAt)}
          defaultValue={dateTimeLocal(collection?.expiresAt)}
          id="gco-expires-at"
          name="expiresAt"
          type="datetime-local"
        />
        <FieldError
          id="gco-expires-at-error"
          message={state.fieldErrors?.expiresAt}
        />
      </label>
    </fieldset>
    <output
      aria-live="polite"
      className={`gco-save-feedback ${state.status === "error" ? "is-error" : ""}`}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message ?? "As alterações ficam privadas até publicar."}
    </output>
  </form>
);

const CollectionPublicationCard = ({
  defaultPublishMode,
  savePending,
  status,
  onChange,
}: {
  readonly defaultPublishMode: "now" | "schedule";
  readonly savePending: boolean;
  readonly status: string;
  readonly onChange: () => void;
}) => (
  <section
    aria-labelledby="gco-publication-heading"
    className="gco-publication-card"
  >
    <h2 id="gco-publication-heading">Publicação</h2>
    <div className="gco-publication-state">
      <span>Estado atual</span>
      <StatusBadge status={status} />
    </div>
    <fieldset className="gco-publish-mode">
      <legend>Quando publicar</legend>
      <label>
        <input
          defaultChecked={defaultPublishMode === "now"}
          form="gco-collection-details"
          name="publishMode"
          onChange={onChange}
          type="radio"
          value="now"
        />
        Agora
      </label>
      <label>
        <input
          defaultChecked={defaultPublishMode === "schedule"}
          form="gco-collection-details"
          name="publishMode"
          onChange={onChange}
          type="radio"
          value="schedule"
        />
        Agendar
      </label>
    </fieldset>
    <div className="gco-publication-actions">
      <Button
        disabled={savePending}
        form="gco-collection-details"
        name="intent"
        type="submit"
        value="publish"
      >
        {savePending ? "Salvando…" : "Publicar"}
      </Button>
      <Button
        disabled={savePending}
        form="gco-collection-details"
        name="intent"
        type="submit"
        value="draft"
        variant="outline"
      >
        Salvar rascunho
      </Button>
    </div>
    <p>Nada aparece para os membros antes de publicar.</p>
  </section>
);

export const GestaoCollectionEditor = ({
  data,
  defaultPublishMode,
  addItemIdempotencyKey,
  idempotencyKey,
}: {
  readonly data: EditorData;
  readonly defaultPublishMode: "now" | "schedule";
  readonly addItemIdempotencyKey: string;
  readonly idempotencyKey: string;
}) => {
  const router = useRouter();
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [formIdempotencyKey, setFormIdempotencyKey] = useState(idempotencyKey);
  const [state, formAction, savePending] = useActionState(
    saveGestaoCollection,
    initialFormState
  );
  const collection = data.collection;
  const collectionId = collection?.id ?? "";
  const version = data.updateVersion ?? "";
  const isArchived = collection?.status === "ARCHIVED";

  useEffect(() => {
    if (state.status !== "success" || !state.id) {
      return;
    }
    if (state.id !== collectionId) {
      router.replace(`/gestao/ensino/colecoes/${state.id}`);
    } else {
      setDetailsDirty(false);
      setFormIdempotencyKey(crypto.randomUUID());
      router.refresh();
    }
  }, [collectionId, router, state.id, state.status]);

  const rotateIdempotencyKey = () => {
    setFormIdempotencyKey(crypto.randomUUID());
    setDetailsDirty(true);
  };

  const previewUrl = collection
    ? `/gestao/ensino/colecoes/${collection.id}/previa`
    : null;
  const currentStatus = collection?.status ?? "DRAFT";
  const collectionTitle = collection?.title ?? "Nova coleção";

  return (
    <section className="gestao-page-content gco-editor-page">
      <header className="gco-editor-heading">
        <div className="gco-editor-title">
          <p className="gestao-eyebrow">
            Gestão <span aria-hidden="true">›</span> Ensino{" "}
            <span aria-hidden="true">›</span>{" "}
            <Link href="/gestao/ensino/colecoes" prefetch={false}>
              Coleções
            </Link>
          </p>
          <div className="gco-editor-title-line">
            <h1>{collectionTitle}</h1>
            <StatusBadge status={currentStatus} />
          </div>
          <p>
            Coleção · {data.itemCount} {data.itemCount === 1 ? "item" : "itens"}
          </p>
        </div>
        <div className="gco-editor-actions">
          <span aria-live="polite" className="gco-saved-at">
            <span aria-hidden="true">✓</span>
            {savedAtLabel(collection?.updatedAt)}
          </span>
          {previewUrl ? (
            <Button asChild variant="outline">
              <Link href={previewUrl} prefetch={false}>
                Pré-visualizar como aluno
              </Link>
            </Button>
          ) : null}
          <Button
            disabled={savePending}
            form="gco-collection-details"
            name="intent"
            type="submit"
            value="publish"
          >
            {savePending ? "Salvando…" : "Publicar"}
          </Button>
        </div>
      </header>

      <div className="gco-editor-layout">
        <CollectionItemsPanel
          addItemIdempotencyKey={addItemIdempotencyKey}
          data={data}
          detailsDirty={detailsDirty}
          isArchived={isArchived}
          version={version}
        />
        <aside className="gco-editor-aside">
          <CollectionDetailsForm
            action={formAction}
            collection={collection}
            coverOptions={data.covers}
            groups={data.groups}
            idempotencyKey={formIdempotencyKey}
            onChange={rotateIdempotencyKey}
            savePending={savePending}
            state={state}
            version={version}
          />
          <CollectionPublicationCard
            defaultPublishMode={defaultPublishMode}
            onChange={rotateIdempotencyKey}
            savePending={savePending}
            status={currentStatus}
          />
        </aside>
      </div>
    </section>
  );
};
