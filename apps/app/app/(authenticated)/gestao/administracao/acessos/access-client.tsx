"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useState } from "react";
import { revokeGestaoAccess } from "./actions";
import { GrantAccessDrawer } from "./grant-drawer";

type Tree = Parameters<typeof GrantAccessDrawer>[0]["tree"];

export const GrantButton = ({
  initialMember,
  tree,
}: {
  readonly initialMember: { id: string; name: string } | null;
  readonly tree: Tree;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="gk-btn gk-btn--primary gk-btn--wide"
        onClick={() => setOpen(true)}
        type="button"
      >
        Conceder acesso
      </button>
      {open ? (
        <GrantAccessDrawer
          initialMember={initialMember}
          onClose={() => setOpen(false)}
          tree={tree}
        />
      ) : null}
    </>
  );
};

export const RevokeButton = ({
  grantId,
  kind,
  memberId,
  title,
}: {
  readonly grantId: string;
  readonly kind: "legacy" | "source";
  readonly memberId: string;
  readonly title: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="gk-link-btn gk-link-btn--accent"
        onClick={() => setOpen(true)}
        type="button"
      >
        Revogar
      </button>
      {open ? (
        <Dialog onOpenChange={setOpen} open>
          <DialogContent
            className="gk-modal gk-modal--narrow"
            overlayClassName="gk-modal-overlay"
            showCloseButton={false}
          >
            <form action={revokeGestaoAccess}>
              <input name="memberId" type="hidden" value={memberId} />
              <input name="grantId" type="hidden" value={grantId} />
              <input name="kind" type="hidden" value={kind} />
              <div className="gk-modal-head">
                <div>
                  <DialogTitle className="gk-modal-title">
                    Revogar esta concessão?
                  </DialogTitle>
                  <DialogDescription className="gk-modal-sub">
                    “{title}” deixa de ser liberado por esta concessão direta.
                    Acessos que continuam válidos por turma, matrícula ou
                    atribuição não mudam.
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
                <button className="gk-btn gk-btn--primary" type="submit">
                  Revogar concessão
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
};
