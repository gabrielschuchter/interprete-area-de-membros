"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { CollectionCoverPicker } from "@/components/gestao/collection-cover-picker";
import { communitySpaceSlugBase } from "@/lib/community-space-rules";
import { useGestaoDirtyRegistration } from "../../dirty-registry";
import { GestaoIcon } from "../../gestao-icon";
import {
  createGestaoGroup,
  type GestaoGroupFormState,
  updateGestaoGroup,
} from "./actions";

interface CoverOption {
  readonly id: string;
  readonly label: string;
  readonly url: string;
}

const initial: GestaoGroupFormState = { done: false, error: null };

const GroupFormFields = ({
  address,
  covers,
  coverUrl,
  description,
  onDirty,
  onTitle,
  status,
  title,
}: {
  readonly address: React.ReactNode;
  readonly coverUrl: string;
  readonly covers: readonly CoverOption[];
  readonly description: string;
  readonly onDirty: () => void;
  readonly onTitle: (value: string) => void;
  readonly status: "error" | "idle" | "success";
  readonly title: string;
}) => (
  <>
    <label className="gk-label">
      <span>
        Nome <em>*</em>
      </span>
      <input
        className="gk-input"
        maxLength={80}
        name="title"
        onChange={(event) => onTitle(event.target.value)}
        required
        value={title}
      />
    </label>
    {address}
    <label className="gk-label">
      <span>Descrição</span>
      <textarea
        className="gk-input gk-textarea"
        defaultValue={description}
        maxLength={500}
        name="description"
        onChange={onDirty}
        placeholder="Para quem é e sobre o que conversam"
        rows={3}
      />
    </label>
    <div className="gk-label">
      <span>Imagem do grupo</span>
      <CollectionCoverPicker
        coverOptions={covers}
        initialUrl={coverUrl}
        mutationStatus={status}
        noun="imagem"
        onValueChange={onDirty}
        sizeHint=""
      />
    </div>
  </>
);

const DialogHead = ({
  onClose,
  sub,
  title,
}: {
  readonly onClose: () => void;
  readonly sub: string;
  readonly title: string;
}) => (
  <div className="gk-modal-head">
    <div>
      <DialogTitle className="gk-modal-title">{title}</DialogTitle>
      <DialogDescription className="sr-only">{sub}</DialogDescription>
    </div>
    <button
      aria-label="Fechar"
      className="gk-icon-btn gk-icon-btn--bare"
      onClick={onClose}
      type="button"
    >
      <GestaoIcon name="x" size={18} />
    </button>
  </div>
);

const NewGroupForm = ({
  covers,
  onClose,
}: {
  readonly covers: readonly CoverOption[];
  readonly onClose: () => void;
}) => {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"institutional" | "study">("study");
  const [touched, setTouched] = useState(false);
  const [state, action, pending] = useActionState(createGestaoGroup, initial);
  useGestaoDirtyRegistration(touched && !state.done);
  useEffect(() => {
    if (state.done) {
      onClose();
      router.refresh();
    }
  }, [state.done, onClose, router]);
  const slug = communitySpaceSlugBase(title);
  return (
    <form action={action} onChange={() => setTouched(true)}>
      <DialogHead
        onClose={onClose}
        sub="O endereço sai do nome. Um grupo de estudo não concede acesso a conteúdo."
        title="Novo grupo"
      />
      <div className="gk-modal-body gk-form-stack">
        <GroupFormFields
          address={
            title.trim() ? (
              <small className="gk-hint">
                Endereço gerado automaticamente:{" "}
                <b className="gk-mono">/{slug}</b>
              </small>
            ) : null
          }
          covers={covers}
          coverUrl=""
          description=""
          onDirty={() => setTouched(true)}
          onTitle={setTitle}
          status={state.done ? "success" : "idle"}
          title={title}
        />
        <div className="gk-label">
          <span>Tipo</span>
          <input name="kind" type="hidden" value={kind} />
          <fieldset className="gk-segmented gk-segmented--full">
            <legend className="sr-only">Tipo</legend>
            {(
              [
                ["study", "De estudo"],
                ["institutional", "Institucional"],
              ] as const
            ).map(([value, label]) => (
              <button
                aria-pressed={kind === value}
                key={value}
                onClick={() => setKind(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </fieldset>
        </div>
        {state.error ? (
          <p className="gk-alert" role="alert">
            <GestaoIcon name="alert-circle" size={16} /> {state.error}
          </p>
        ) : null}
      </div>
      <div className="gk-modal-foot">
        <button
          className="gk-btn gk-btn--primary"
          disabled={pending}
          type="submit"
        >
          Criar grupo
        </button>
        <button className="gk-btn" onClick={onClose} type="button">
          Cancelar
        </button>
      </div>
    </form>
  );
};

export const NewGroupButton = ({
  covers,
}: {
  readonly covers: readonly CoverOption[];
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <button className="gk-btn gk-btn--primary gk-btn--wide" type="button">
          Novo grupo
        </button>
      </DialogTrigger>
      <DialogContent
        className="gk-modal"
        overlayClassName="gk-modal-overlay"
        showCloseButton={false}
      >
        {open ? (
          <NewGroupForm covers={covers} onClose={() => setOpen(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

interface ManagedGroup {
  readonly coverUrl: string;
  readonly description: string;
  readonly id: string;
  readonly kind: "institutional" | "study";
  readonly slug: string;
  readonly title: string;
}

const ManageGroupForm = ({
  covers,
  group,
  onClose,
}: {
  readonly covers: readonly CoverOption[];
  readonly group: ManagedGroup;
  readonly onClose: () => void;
}) => {
  const router = useRouter();
  const [title, setTitle] = useState(group.title);
  const [slug, setSlug] = useState(group.slug);
  const [touched, setTouched] = useState(false);
  const [state, action, pending] = useActionState(updateGestaoGroup, initial);
  useGestaoDirtyRegistration(touched && !state.done);
  useEffect(() => {
    if (state.done) {
      onClose();
      router.refresh();
    }
  }, [state.done, onClose, router]);
  const addressChanged = communitySpaceSlugBase(slug) !== group.slug;
  return (
    <form action={action} onChange={() => setTouched(true)}>
      <input name="id" type="hidden" value={group.id} />
      <DialogHead
        onClose={onClose}
        sub={`${group.kind === "study" ? "Grupo de estudo" : "Grupo institucional"}. Membros e publicações seguem como estão.`}
        title="Gerenciar grupo"
      />
      <div className="gk-modal-body gk-form-stack">
        <GroupFormFields
          address={
            <div className="gk-label">
              <label htmlFor={`group-slug-${group.id}`}>Endereço</label>
              <input
                className="gk-input gk-mono"
                id={`group-slug-${group.id}`}
                maxLength={80}
                name="slug"
                onChange={(event) => setSlug(event.target.value)}
                value={slug}
              />
              {addressChanged ? (
                <label className="gk-check">
                  <input name="confirmAddress" type="checkbox" />
                  <span>
                    Entendo que links já compartilhados com o endereço antigo
                    deixam de funcionar.
                  </span>
                </label>
              ) : (
                <small className="gk-hint">
                  Mudar o endereço exige confirmação.
                </small>
              )}
            </div>
          }
          covers={covers}
          coverUrl={group.coverUrl}
          description={group.description}
          onDirty={() => setTouched(true)}
          onTitle={setTitle}
          status={state.done ? "success" : "idle"}
          title={title}
        />
        {state.error ? (
          <p className="gk-alert" role="alert">
            <GestaoIcon name="alert-circle" size={16} /> {state.error}
          </p>
        ) : null}
      </div>
      <div className="gk-modal-foot">
        <button
          className="gk-btn gk-btn--primary"
          disabled={pending}
          type="submit"
        >
          Salvar grupo
        </button>
        <button className="gk-btn" onClick={onClose} type="button">
          Cancelar
        </button>
      </div>
    </form>
  );
};

export const ManageGroupButton = ({
  covers,
  group,
}: {
  readonly covers: readonly CoverOption[];
  readonly group: ManagedGroup;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <button className="gk-btn" type="button">
          Gerenciar
        </button>
      </DialogTrigger>
      <DialogContent
        className="gk-modal"
        overlayClassName="gk-modal-overlay"
        showCloseButton={false}
      >
        {open ? (
          <ManageGroupForm
            covers={covers}
            group={group}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
