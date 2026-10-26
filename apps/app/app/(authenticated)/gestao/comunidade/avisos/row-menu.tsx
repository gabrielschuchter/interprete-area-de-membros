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
import type { GestaoNoticeState } from "@/lib/gestao-notices-domain";
import { GestaoIcon } from "../../gestao-icon";
import { setGestaoNoticeState } from "./actions";

interface NoticeRowMenuProperties {
  readonly id: string;
  readonly isPinned: boolean;
  readonly state: GestaoNoticeState;
  readonly title: string;
}

type Confirmation = "delete" | "end";

const copy: Record<
  Confirmation,
  { action: string; body: string; title: string }
> = {
  delete: {
    action: "Excluir aviso",
    body: "O aviso sai da lista e deixa de aparecer para os membros. As notificações já enviadas continuam nas caixas de entrada.",
    title: "Excluir este aviso?",
  },
  end: {
    action: "Encerrar aviso",
    body: "O aviso deixa de aparecer para os membros agora. Você pode reabri-lo como rascunho depois.",
    title: "Encerrar este aviso?",
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
      <form action={setGestaoNoticeState} onSubmit={onClose}>
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

export const NoticeRowMenu = ({
  id,
  isPinned,
  state,
  title,
}: NoticeRowMenuProperties) => {
  const router = useRouter();
  const [confirming, setConfirming] = useState<Confirmation | null>(null);
  const run = (operation: string) => {
    const data = new FormData();
    data.set("id", id);
    data.set("operation", operation);
    setGestaoNoticeState(data).then(() => router.refresh());
  };
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
          <DropdownMenuItem
            onSelect={() => router.push(`/gestao/comunidade/avisos/${id}`)}
          >
            Editar aviso
          </DropdownMenuItem>
          {state === "draft" ? (
            <DropdownMenuItem onSelect={() => run("publish")}>
              Publicar
            </DropdownMenuItem>
          ) : null}
          {state === "published" || state === "scheduled" ? (
            <DropdownMenuItem onSelect={() => run(isPinned ? "unpin" : "pin")}>
              {isPinned ? "Soltar do topo" : "Fixar no topo"}
            </DropdownMenuItem>
          ) : null}
          {state === "published" || state === "scheduled" ? (
            <DropdownMenuItem onSelect={() => setConfirming("end")}>
              Encerrar aviso
            </DropdownMenuItem>
          ) : null}
          {state === "ended" ? (
            <DropdownMenuItem onSelect={() => run("reopen")}>
              Reabrir como rascunho
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setConfirming("delete")}>
            Excluir aviso
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
