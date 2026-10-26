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
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GestaoIcon } from "../../gestao-icon";
import { setGestaoPublicationState } from "./actions";

interface PublicationRowMenuProperties {
  readonly href: string;
  readonly id: string;
  readonly isFeatured: boolean;
  readonly isPinned: boolean;
  readonly status: "ARCHIVED" | "PUBLISHED";
  readonly title: string;
}

type Confirmation = "archive" | "remove";

const copy: Record<
  Confirmation,
  { action: string; body: string; title: string }
> = {
  archive: {
    action: "Arquivar publicação",
    body: "Ela sai do feed. O conteúdo fica preservado e pode ser restaurado. O autor recebe um aviso.",
    title: "Arquivar esta publicação?",
  },
  remove: {
    action: "Remover publicação",
    body: "Ela some do feed e das listas de moderação. Use para o que realmente precisa sair; para o resto, prefira arquivar.",
    title: "Remover esta publicação?",
  },
};

const ConfirmDialog = ({
  id,
  kind,
  onClose,
  title,
}: {
  readonly id: string;
  readonly kind: Confirmation;
  readonly onClose: () => void;
  readonly title: string;
}) => (
  <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
    <DialogContent
      className="gk-modal gk-modal--narrow"
      overlayClassName="gk-modal-overlay"
      showCloseButton={false}
    >
      <form action={setGestaoPublicationState} onSubmit={onClose}>
        <input name="id" type="hidden" value={id} />
        <input name="operation" type="hidden" value={kind} />
        <div className="gk-modal-head">
          <div>
            <DialogTitle className="gk-modal-title">
              {copy[kind].title}
            </DialogTitle>
            <DialogDescription className="gk-modal-sub">
              “{title}”. {copy[kind].body}
            </DialogDescription>
          </div>
        </div>
        {kind === "archive" ? (
          <div className="gk-modal-body">
            <label className="gk-label">
              <span>
                Motivo <em>opcional, o autor lê</em>
              </span>
              <textarea
                className="gk-input gk-textarea"
                maxLength={500}
                name="reason"
                placeholder="Ex.: conteúdo fora do tema do grupo."
                rows={3}
              />
            </label>
          </div>
        ) : null}
        <div className="gk-modal-foot">
          <span className="gk-spacer" />
          <button className="gk-btn" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="gk-btn gk-btn--primary" type="submit">
            {copy[kind].action}
          </button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
);

export const PublicationRowMenu = ({
  href,
  id,
  isFeatured,
  isPinned,
  status,
  title,
}: PublicationRowMenuProperties) => {
  const router = useRouter();
  const [confirming, setConfirming] = useState<Confirmation | null>(null);
  const run = (operation: string) => {
    const data = new FormData();
    data.set("id", id);
    data.set("operation", operation);
    setGestaoPublicationState(data).then(() => router.refresh());
  };
  const live = status === "PUBLISHED";
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`Mais ações para ${title}`}
            className="gk-icon-btn gk-icon-btn--bare"
            type="button"
          >
            <GestaoIcon name="dots" size={18} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="gk-menu">
          <DropdownMenuItem onSelect={() => router.push(href)}>
            <GestaoIcon name="external" size={16} /> Abrir publicação
          </DropdownMenuItem>
          {live ? (
            <DropdownMenuItem onSelect={() => run(isPinned ? "unpin" : "pin")}>
              <GestaoIcon name="pin" size={16} />{" "}
              {isPinned ? "Soltar do feed" : "Fixar no feed"}
            </DropdownMenuItem>
          ) : null}
          {live ? (
            <DropdownMenuItem
              onSelect={() => run(isFeatured ? "unfeature" : "feature")}
            >
              <GestaoIcon name="star" size={16} />{" "}
              {isFeatured ? "Retirar destaque" : "Destacar"}
            </DropdownMenuItem>
          ) : null}
          {live ? (
            <DropdownMenuItem onSelect={() => setConfirming("archive")}>
              <GestaoIcon name="archive" size={16} /> Arquivar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => run("restore")}>
              <GestaoIcon name="refresh" size={16} /> Restaurar
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="gk-menu-danger"
            onSelect={() => setConfirming("remove")}
          >
            <GestaoIcon name="trash" size={16} /> Remover…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirming ? (
        <ConfirmDialog
          id={id}
          kind={confirming}
          onClose={() => setConfirming(null)}
          title={title}
        />
      ) : null}
    </>
  );
};
