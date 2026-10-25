"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  addGestaoCollectionItem,
  type GestaoCollectionMutationState,
  type GestaoCollectionSearchState,
  searchGestaoCollectionResources,
} from "@/app/(authenticated)/gestao/ensino/colecoes/actions";
import { GestaoIcon } from "@/app/(authenticated)/gestao/gestao-icon";

const initialSearchState: GestaoCollectionSearchState = {
  options: [],
  status: "idle",
};
const initialMutationState: GestaoCollectionMutationState = { status: "idle" };

const itemTypes = [
  ["LESSON", "Aula"],
  ["COURSE", "Curso"],
  ["EXERCISE_LIST", "Lista de exercícios"],
  ["LIBRARY_ITEM", "Material da biblioteca"],
  ["RECORDING", "Gravação"],
] as const;

const ResourceRow = ({
  collectionId,
  idempotencyKey,
  itemType,
  onAdded,
  option,
  version,
}: {
  readonly collectionId: string;
  readonly idempotencyKey: string;
  readonly itemType: string;
  readonly onAdded: () => void;
  readonly option: GestaoCollectionSearchState["options"][number];
  readonly version: string;
}) => {
  const keyRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(
    addGestaoCollectionItem,
    initialMutationState
  );
  useEffect(() => {
    if (state.status === "success") {
      onAdded();
    }
  }, [onAdded, state.status]);
  let buttonLabel = "Adicionar";
  if (state.status === "success") {
    buttonLabel = "Adicionado";
  } else if (pending) {
    buttonLabel = "Adicionando…";
  }
  return (
    <li>
      <form
        action={action}
        onSubmit={() => {
          if (keyRef.current) {
            keyRef.current.value = crypto.randomUUID();
          }
        }}
      >
        <input name="collectionId" type="hidden" value={collectionId} />
        <input name="version" type="hidden" value={version} />
        <input
          defaultValue={idempotencyKey}
          name="idempotencyKey"
          ref={keyRef}
          type="hidden"
        />
        <input name="itemType" type="hidden" value={itemType} />
        <input name="resourceId" type="hidden" value={option.id} />
        <div className="gk-resrow-copy">
          <strong>{option.label}</strong>
          <small>origem: {option.origin}</small>
          {state.status === "error" && state.message ? (
            <small className="gk-error" role="alert">
              {state.message}
            </small>
          ) : null}
        </div>
        <button
          className="gk-btn gk-btn--sm"
          disabled={pending || state.status === "success"}
          type="submit"
        >
          {buttonLabel}
        </button>
      </form>
    </li>
  );
};

export const CollectionResourcePicker = ({
  collectionId,
  idempotencyKey,
  version,
}: {
  readonly collectionId: string;
  readonly idempotencyKey: string;
  readonly version: string;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchState, searchAction, searchPending] = useActionState(
    searchGestaoCollectionResources,
    initialSearchState
  );
  const searchedType = searchState.type ?? "LESSON";

  return (
    <>
      <button
        className="gk-btn gk-btn--primary"
        onClick={() => setOpen(true)}
        type="button"
      >
        Adicionar recursos
      </button>
      {open ? (
        <Dialog onOpenChange={setOpen} open>
          <DialogContent
            className="gk-modal"
            overlayClassName="gk-modal-overlay"
            showCloseButton={false}
          >
            <div className="gk-modal-head">
              <div>
                <DialogTitle className="gk-modal-title">
                  Adicionar recursos
                </DialogTitle>
                <DialogDescription className="gk-modal-sub">
                  Busque aulas, cursos, listas, materiais e gravações. Os itens
                  são referenciados, nunca duplicados.
                </DialogDescription>
              </div>
            </div>
            <div className="gk-modal-body">
              <form action={searchAction} className="gk-resource-search">
                <span className="gk-field">
                  <select
                    aria-label="Tipo de recurso"
                    className="gk-select"
                    defaultValue="LESSON"
                    name="itemType"
                  >
                    {itemTypes.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <GestaoIcon
                    className="gk-select-caret"
                    name="chevron-down"
                    size={14}
                    strokeWidth={1.8}
                  />
                </span>
                <span className="gk-field gk-field--grow">
                  <GestaoIcon name="search" size={16} />
                  <input
                    aria-label="Buscar recurso"
                    autoFocus
                    className="gk-input"
                    maxLength={100}
                    minLength={2}
                    name="query"
                    placeholder="Digite ao menos duas letras"
                    required
                  />
                </span>
                <button
                  className="gk-btn"
                  disabled={searchPending}
                  type="submit"
                >
                  {searchPending ? "Buscando…" : "Buscar"}
                </button>
              </form>
              {searchState.message ? (
                <p
                  aria-live="polite"
                  className={
                    searchState.status === "error" ? "gk-error" : "gk-hint"
                  }
                  role={searchState.status === "error" ? "alert" : "status"}
                >
                  {searchState.message}
                </p>
              ) : null}
              {searchState.options.length > 0 ? (
                <ul className="gk-resource-list">
                  {searchState.options.map((option) => (
                    <ResourceRow
                      collectionId={collectionId}
                      idempotencyKey={idempotencyKey}
                      itemType={searchedType}
                      key={option.id}
                      onAdded={() => router.refresh()}
                      option={option}
                      version={version}
                    />
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="gk-modal-foot">
              <span className="gk-spacer" />
              <button
                className="gk-btn gk-btn--primary"
                onClick={() => setOpen(false)}
                type="button"
              >
                Concluir
              </button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
};
