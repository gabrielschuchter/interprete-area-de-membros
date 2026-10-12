"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CollectionCoverPicker } from "@/components/gestao/collection-cover-picker";
import type { GestaoLearningPathFormState } from "@/lib/gestao-learning-path-domain";

type PathAction = (
  state: GestaoLearningPathFormState,
  formData: FormData
) => Promise<GestaoLearningPathFormState>;

const SavePathButton = () => {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} type="submit">
      {pending ? "Salvando…" : "Salvar percurso"}
    </Button>
  );
};

export const LearningPathForm = ({
  action,
  coverOptions,
  idempotencyKey,
  path,
}: {
  readonly action: PathAction;
  readonly coverOptions: readonly {
    readonly id: string;
    readonly label: string;
    readonly url: string;
  }[];
  readonly idempotencyKey: string;
  readonly path?: {
    readonly coverUrl: string | null;
    readonly description: string | null;
    readonly id: string;
    readonly published: boolean;
    readonly page?: number;
    readonly slug: string;
    readonly title: string;
    readonly updatedAt: string;
  };
}) => {
  const [currentIdempotencyKey, setCurrentIdempotencyKey] =
    useState(idempotencyKey);
  const [draft, setDraft] = useState({
    description: path?.description ?? "",
    expectedUpdatedAt: path?.updatedAt ?? "",
    slug: path?.slug ?? "",
    title: path?.title ?? "",
  });
  const [state, formAction] = useActionState(action, {
    idempotencyKey,
    status: "idle",
  });
  const titleError = state.fieldErrors?.title;
  const slugError = state.fieldErrors?.slug;
  const descriptionError = state.fieldErrors?.description;

  return (
    <form action={formAction} className="ge-path-form">
      {path ? (
        <>
          <input name="pathId" type="hidden" value={path.id} />
          <input name="page" type="hidden" value={path.page ?? 1} />
          <input
            name="expectedUpdatedAt"
            type="hidden"
            value={draft.expectedUpdatedAt}
          />
        </>
      ) : null}
      <input
        name="idempotencyKey"
        type="hidden"
        value={currentIdempotencyKey}
      />
      <label className="ge-path-field" htmlFor="path-title">
        <span>Título</span>
        <Input
          aria-describedby={titleError ? "path-title-error" : undefined}
          aria-invalid={Boolean(titleError)}
          autoComplete="off"
          id="path-title"
          maxLength={120}
          name="title"
          onChange={(event) => {
            setDraft((current) => ({
              ...current,
              title: event.target.value,
            }));
            setCurrentIdempotencyKey(globalThis.crypto.randomUUID());
          }}
          placeholder="Ex.: Fundamentos da PBE"
          required
          value={draft.title}
        />
        {titleError ? (
          <small className="ge-path-error" id="path-title-error">
            {titleError}
          </small>
        ) : null}
      </label>
      <details className="ge-path-advanced-field" open={!path}>
        <summary>Endereço público</summary>
        <label className="ge-path-field" htmlFor="path-slug">
          <span>Endereço</span>
          <div className="ge-path-slug-input">
            <span aria-hidden="true">/aprender/trilhas/</span>
            <Input
              aria-describedby={slugError ? "path-slug-error" : undefined}
              aria-invalid={Boolean(slugError)}
              autoCapitalize="none"
              autoComplete="off"
              id="path-slug"
              maxLength={120}
              name="slug"
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  slug: event.target.value,
                }));
                setCurrentIdempotencyKey(globalThis.crypto.randomUUID());
              }}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="fundamentos-da-pbe"
              required
              spellCheck={false}
              value={draft.slug}
            />
          </div>
          {slugError ? (
            <small className="ge-path-error" id="path-slug-error">
              {slugError}
            </small>
          ) : null}
        </label>
      </details>
      <label className="ge-path-field" htmlFor="path-description">
        <span>Descrição</span>
        <Textarea
          aria-describedby={
            descriptionError ? "path-description-error" : undefined
          }
          aria-invalid={Boolean(descriptionError)}
          id="path-description"
          maxLength={5000}
          name="description"
          onChange={(event) => {
            setDraft((current) => ({
              ...current,
              description: event.target.value,
            }));
            setCurrentIdempotencyKey(globalThis.crypto.randomUUID());
          }}
          placeholder="O que esta jornada ajuda a compreender?"
          rows={5}
          value={draft.description}
        />
        {descriptionError ? (
          <small className="ge-path-error" id="path-description-error">
            {descriptionError}
          </small>
        ) : null}
      </label>
      <fieldset className="gco-cover-fieldset">
        <legend>Capa</legend>
        <CollectionCoverPicker
          coverOptions={coverOptions}
          initialUrl={path?.coverUrl ?? ""}
          mutationStatus={state.status}
          onValueChange={() =>
            setCurrentIdempotencyKey(globalThis.crypto.randomUUID())
          }
        />
        {state.fieldErrors?.coverUrl ? (
          <small className="ge-path-error" role="alert">
            {state.fieldErrors.coverUrl}
          </small>
        ) : null}
      </fieldset>
      {path?.published ? (
        <label className="ge-path-confirm">
          <input name="confirmPublishedChange" required type="checkbox" />
          <span>
            Confirmo que as alterações podem ficar visíveis imediatamente para
            os alunos.
          </span>
        </label>
      ) : null}
      {state.message ? (
        <output aria-live="polite" className="ge-path-feedback">
          {state.message}
        </output>
      ) : null}
      <div className="ge-path-form-actions">
        <SavePathButton />
      </div>
    </form>
  );
};
