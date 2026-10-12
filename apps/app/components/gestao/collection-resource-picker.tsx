"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  addGestaoCollectionItem,
  type GestaoCollectionMutationState,
  type GestaoCollectionSearchState,
  searchGestaoCollectionResources,
} from "@/app/(authenticated)/gestao/ensino/colecoes/actions";

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
  const addKeyRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState("");
  const [searchState, searchAction, searchPending] = useActionState(
    searchGestaoCollectionResources,
    initialSearchState
  );
  const [addState, addAction, addPending] = useActionState(
    addGestaoCollectionItem,
    initialMutationState
  );

  useEffect(() => {
    if (addState.status === "success") {
      setSelectedId("");
      router.refresh();
    }
  }, [addState, router]);

  const searchedType = searchState.type ?? "LESSON";

  return (
    <details className="gco-add-panel">
      <summary>Adicionar recursos</summary>
      <div className="gco-resource-search">
        <form action={searchAction} className="gco-resource-search-form">
          <label>
            <span>Tipo de recurso</span>
            <select defaultValue="LESSON" name="itemType">
              {itemTypes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="gco-resource-query">
            <span>Buscar recurso</span>
            <input
              maxLength={100}
              minLength={2}
              name="query"
              placeholder="Digite ao menos duas letras"
              required
            />
          </label>
          <Button disabled={searchPending} type="submit" variant="outline">
            {searchPending ? "Buscando…" : "Buscar"}
          </Button>
        </form>
        {searchState.message ? (
          <p
            aria-live="polite"
            className={`gco-inline-message ${searchState.status === "error" ? "is-error" : ""}`}
            role={searchState.status === "error" ? "alert" : "status"}
          >
            {searchState.message}
          </p>
        ) : null}
        {searchState.options.length > 0 ? (
          <form
            action={addAction}
            className="gco-resource-add-form"
            onSubmit={() => {
              if (addKeyRef.current) {
                addKeyRef.current.value = crypto.randomUUID();
              }
            }}
          >
            <input name="collectionId" type="hidden" value={collectionId} />
            <input name="version" type="hidden" value={version} />
            <input
              defaultValue={idempotencyKey}
              name="idempotencyKey"
              ref={addKeyRef}
              type="hidden"
            />
            <input name="itemType" type="hidden" value={searchedType} />
            <label>
              <span>Recurso encontrado</span>
              <select
                name="resourceId"
                onChange={(event) => setSelectedId(event.currentTarget.value)}
                required
                value={selectedId}
              >
                <option value="">Escolha um recurso</option>
                {searchState.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} · {option.origin}
                  </option>
                ))}
              </select>
            </label>
            <Button disabled={!selectedId || addPending} type="submit">
              {addPending ? "Adicionando…" : "Adicionar à coleção"}
            </Button>
          </form>
        ) : null}
        {addState.message ? (
          <p
            aria-live="polite"
            className={`gco-inline-message ${addState.status === "error" ? "is-error" : ""}`}
            role={addState.status === "error" ? "alert" : "status"}
          >
            {addState.message}
          </p>
        ) : null}
      </div>
    </details>
  );
};
