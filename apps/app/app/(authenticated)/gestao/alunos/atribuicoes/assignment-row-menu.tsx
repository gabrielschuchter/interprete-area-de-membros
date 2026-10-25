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
import { revokeGestaoAssignment } from "./actions";

interface AssignmentRowMenuProperties {
  readonly batchId: string;
  readonly canRevoke: boolean;
  readonly recipients: number;
  readonly title: string;
}

const RevokeDialog = ({
  batchId,
  onClose,
  recipients,
  title,
}: Omit<AssignmentRowMenuProperties, "canRevoke"> & {
  readonly onClose: () => void;
}) => (
  <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
    <DialogContent
      className="gk-modal gk-modal--narrow"
      overlayClassName="gk-modal-overlay"
      showCloseButton={false}
    >
      <form action={revokeGestaoAssignment}>
        <input name="batchId" type="hidden" value={batchId} />
        <div className="gk-modal-head">
          <div>
            <DialogTitle className="gk-modal-title">
              Revogar esta atribuição?
            </DialogTitle>
            <DialogDescription className="gk-modal-sub">
              “{title}” deixa de aparecer como pendência para {recipients}{" "}
              {recipients === 1 ? "aluno" : "alunos"}. Acessos que o aluno já
              tem por turma ou curso continuam. O registro da atribuição fica no
              histórico.
            </DialogDescription>
          </div>
        </div>
        <div className="gk-modal-foot">
          <span className="gk-spacer" />
          <button className="gk-btn" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="gk-btn gk-btn--primary" type="submit">
            Revogar atribuição
          </button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
);

export const AssignmentRowMenu = ({
  batchId,
  canRevoke,
  recipients,
  title,
}: AssignmentRowMenuProperties) => {
  const router = useRouter();
  const [revoking, setRevoking] = useState(false);
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
            onSelect={() =>
              router.push(
                `/gestao/alunos/atribuicoes/nova?de=${encodeURIComponent(batchId)}`
              )
            }
          >
            Duplicar atribuição
          </DropdownMenuItem>
          {canRevoke ? (
            <DropdownMenuItem onSelect={() => setRevoking(true)}>
              Revogar atribuição
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {revoking ? (
        <RevokeDialog
          batchId={batchId}
          onClose={() => setRevoking(false)}
          recipients={recipients}
          title={title}
        />
      ) : null}
    </>
  );
};
