"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useRouter } from "next/navigation";
import { type ReactNode, useId, useState, useTransition } from "react";
import { eraseGestaoRecord } from "./actions";

export type GestaoEraseKind = Parameters<typeof eraseGestaoRecord>[0]["kind"];

interface GestaoEraseProperties {
  /** Recebe a função que abre a confirmação; desenha o gatilho. */
  readonly children: (open: () => void) => ReactNode;
  /** O que se perde junto, em uma frase. */
  readonly consequence: string;
  readonly id: string;
  readonly kind: GestaoEraseKind;
  /** Rótulo do tipo, no singular: "curso", "turma", "aula". */
  readonly noun: string;
  /** Para onde ir depois de apagar; sem ele, a página atual é atualizada. */
  readonly redirectTo?: string;
  readonly title: string;
}

const EraseDialog = ({
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

/** Gatilho + confirmação de exclusão real. Envolva o menu inteiro, não só o item. */
export const GestaoErase = ({
  children,
  ...properties
}: GestaoEraseProperties) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      {children(() => setOpen(true))}
      {open ? (
        <EraseDialog {...properties} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
};

/** Botão simples de apagar, para cabeçalhos e páginas de configuração. */
export const GestaoEraseButton = (
  properties: Omit<GestaoEraseProperties, "children"> & {
    readonly label?: string;
  }
) => (
  <GestaoErase {...properties}>
    {(open) => (
      <button
        className="gk-btn gk-btn--danger-ghost"
        onClick={open}
        type="button"
      >
        {properties.label ?? `Apagar ${properties.noun}`}
      </button>
    )}
  </GestaoErase>
);
