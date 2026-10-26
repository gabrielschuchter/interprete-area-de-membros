"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";

interface GestaoMobileDrawerProperties {
  readonly children: ReactNode;
  readonly onClickCapture: (event: ReactMouseEvent<HTMLDivElement>) => void;
  readonly onCloseFocus: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}

/** Carregado sob demanda: mantém o Dialog fora do JS inicial da Gestão. */
export const GestaoMobileDrawer = ({
  children,
  onClickCapture,
  onCloseFocus,
  onOpenChange,
  open,
}: GestaoMobileDrawerProperties) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent
      aria-describedby={undefined}
      className="gestao-drawer translate-x-0 translate-y-0"
      id="gestao-mobile-navigation"
      onClickCapture={onClickCapture}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onCloseFocus();
      }}
      overlayClassName="gestao-drawer-overlay"
      showCloseButton={false}
    >
      <DialogTitle className="sr-only">Menu da Gestão</DialogTitle>
      {children}
    </DialogContent>
  </Dialog>
);

export const GestaoWelcomeDialog = ({
  onDismiss,
  open,
}: {
  readonly onDismiss: () => void;
  readonly open: boolean;
}) => (
  <Dialog
    onOpenChange={(next) => {
      if (!next) {
        onDismiss();
      }
    }}
    open={open}
  >
    <DialogContent
      className="gestao-welcome-dialog"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        const heading = document.querySelector<HTMLElement>(
          "#gestao-main-content h1"
        );
        heading?.setAttribute("tabindex", "-1");
        heading?.focus({ preventScroll: true });
      }}
    >
      <DialogHeader>
        <p className="gestao-eyebrow">Interprete · Gestão</p>
        <DialogTitle className="gestao-welcome-title">
          Seu espaço de ensino, em um só lugar.
        </DialogTitle>
        <DialogDescription>
          Aqui você acompanha turmas, organiza conteúdos e cuida da comunidade.
          As permissões da sua conta definem quais áreas aparecem para você.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button onClick={onDismiss}>Começar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
