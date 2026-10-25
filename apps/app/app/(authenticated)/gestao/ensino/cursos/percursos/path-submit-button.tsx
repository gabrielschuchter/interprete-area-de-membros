"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { type ReactNode, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

export const PathSubmitButton = ({
  label,
  pendingLabel,
  variant = "outline",
  size = "sm",
  ariaLabel,
  className,
  confirmText,
  confirmTitle,
  icon,
  title,
}: {
  readonly label: string;
  readonly pendingLabel: string;
  readonly variant?: "default" | "outline";
  readonly size?: "sm" | "icon";
  readonly ariaLabel?: string;
  readonly className?: string;
  /** Quando informado, o envio só acontece depois de confirmar no diálogo. */
  readonly confirmText?: string;
  readonly confirmTitle?: string;
  readonly icon?: ReactNode;
  readonly title?: string;
}) => {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const classes = [
    "gk-btn",
    variant === "default" ? "gk-btn--primary" : "",
    size === "icon" ? "gk-btn--icon" : "gk-btn--sm",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <button
        aria-busy={pending || undefined}
        aria-label={ariaLabel}
        className={classes}
        disabled={pending}
        onClick={(event) => {
          if (confirmText) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        ref={button}
        title={title}
        type="submit"
      >
        {pending ? pendingLabel : (icon ?? label)}
      </button>
      {confirmText ? (
        <Dialog onOpenChange={setOpen} open={open}>
          <DialogContent
            className="gk-modal gk-modal--confirm"
            overlayClassName="gk-overlay"
            showCloseButton={false}
          >
            <div className="gk-modal-body">
              <DialogTitle className="gk-modal-title">
                {confirmTitle ?? "Confirmar alteração?"}
              </DialogTitle>
              <DialogDescription className="gk-modal-copy">
                {confirmText}
              </DialogDescription>
              <div className="gk-modal-actions">
                <button
                  className="gk-btn"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="gk-btn gk-btn--primary"
                  onClick={() => {
                    setOpen(false);
                    button.current?.form?.requestSubmit();
                  }}
                  type="button"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
};
