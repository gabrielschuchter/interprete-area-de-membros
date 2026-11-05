"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { eraseGestaoRecord } from "./actions";
import type { GestaoEraseProperties } from "./erase-types";

export const EraseDialog = ({
  consequence,
  id,
  kind,
  noun,
  onClose,
  redirectTo,
  title,
}: Omit<GestaoEraseProperties, "children"> & {
  readonly onClose: () => void;
}) => {
  const router = useRouter();
  const inputId = useId();
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ready = confirmation.trim().toUpperCase() === "APAGAR";

  const submit = () => {
    if (!ready || pending) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await eraseGestaoRecord({
          confirmation,
          id,
          kind,
          title,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        onClose();
        if (redirectTo) {
          router.replace(redirectTo);
        }
        router.refresh();
      } catch {
        setError("Não foi possível apagar agora. Tente de novo.");
      }
    });
  };

  return (
    <Dialog onOpenChange={(open) => (open || pending ? null : onClose())} open>
      <DialogContent
        className="gk-modal gk-modal--narrow"
        overlayClassName="gk-modal-overlay"
        showCloseButton={false}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="gk-modal-head">
            <div>
              <DialogTitle className="gk-modal-title">
                Apagar {noun} de vez?
              </DialogTitle>
              <DialogDescription className="gk-modal-sub">
                “{title}” será apagado da plataforma, não só arquivado.{" "}
                {consequence} Não dá para desfazer.
              </DialogDescription>
            </div>
          </div>
          <div className="gk-modal-body gk-erase-body">
            <label className="gk-erase-label" htmlFor={inputId}>
              Digite <strong>APAGAR</strong> para confirmar
            </label>
            <input
              autoCapitalize="characters"
              autoComplete="off"
              className="gk-input"
              id={inputId}
              onChange={(event) => setConfirmation(event.target.value)}
              spellCheck={false}
              value={confirmation}
            />
            {error ? (
              <p className="gk-erase-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <div className="gk-modal-foot">
            <span className="gk-spacer" />
            <button
              className="gk-btn"
              disabled={pending}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="gk-btn gk-btn--danger"
              disabled={!ready || pending}
              type="submit"
            >
              {pending ? "Apagando…" : `Apagar ${noun}`}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
