"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useState } from "react";
import { GestaoIcon } from "../../gestao-icon";
import { deleteGestaoGroup } from "./actions";

export const DeleteGroupButton = ({
  id,
  posts,
  title,
}: {
  readonly id: string;
  readonly posts: number;
  readonly title: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="gk-link-btn gk-link-btn--muted"
        onClick={() => setOpen(true)}
        type="button"
      >
        <GestaoIcon name="trash" size={16} /> Apagar
      </button>
      {open ? (
        <Dialog onOpenChange={setOpen} open>
          <DialogContent
            className="gk-modal gk-modal--narrow"
            overlayClassName="gk-modal-overlay"
            showCloseButton={false}
          >
            <form action={deleteGestaoGroup} onSubmit={() => setOpen(false)}>
              <input name="id" type="hidden" value={id} />
              <div className="gk-modal-head">
                <div>
                  <DialogTitle className="gk-modal-title">
                    Apagar o grupo “{title}”?
                  </DialogTitle>
                  <DialogDescription className="gk-modal-sub">
                    {posts > 0
                      ? `As ${posts} publicações do grupo, com comentários e votos, saem junto. `
                      : ""}
                    Membros e convites deixam de existir. Isso não pode ser
                    desfeito; o registro fica na auditoria.
                  </DialogDescription>
                </div>
              </div>
              <div className="gk-modal-foot">
                <span className="gk-spacer" />
                <button
                  className="gk-btn"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button className="gk-btn gk-btn--danger" type="submit">
                  Apagar grupo
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
};
