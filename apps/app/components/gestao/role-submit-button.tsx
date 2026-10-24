"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { type MouseEvent, useId, useRef, useState } from "react";

const roleNames: Record<string, string> = {
  ADMIN: "Admin",
  TEACHER: "Professor",
  MEMBER: "Membro",
};

const effects: Record<string, string> = {
  ADMIN:
    "Admin acessa toda a Gestão, incluindo Administração, acessos, medalhas e registro de atividades.",
  TEACHER:
    "Professor acessa a Gestão apenas nas turmas pelas quais é responsável e não vê a Administração.",
  MEMBER:
    "Membro perde o acesso à Gestão. Turmas e conteúdos já criados continuam existindo.",
};

export const RoleSubmitButton = ({
  currentRole,
  memberName,
}: {
  readonly currentRole: string;
  readonly memberName: string;
}) => {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [next, setNext] = useState(currentRole);
  const onOpen = (event: MouseEvent<HTMLButtonElement>) => {
    const select = event.currentTarget.form?.elements.namedItem("role");
    const value =
      select instanceof HTMLSelectElement ? select.value : currentRole;
    if (value === currentRole) {
      return;
    }
    setNext(value);
    dialog.current?.showModal();
  };
  return (
    <>
      <Button onClick={onOpen} size="sm" type="button" variant="outline">
        Salvar papel
      </Button>
      <dialog
        aria-labelledby={titleId}
        className="m-auto max-w-md rounded-lg border border-border bg-background p-6 text-foreground backdrop:bg-black/40"
        ref={dialog}
      >
        <h2 className="font-semibold text-lg" id={titleId}>
          Alterar o papel de {memberName}?
        </h2>
        <p className="mt-2 text-sm">
          De {roleNames[currentRole] ?? currentRole} para{" "}
          {roleNames[next] ?? next}. {effects[next] ?? ""}
        </p>
        <p className="mt-2 text-muted-foreground text-sm">
          A mudança vale na próxima ação da pessoa e fica no registro de
          atividades.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            onClick={() => dialog.current?.close()}
            size="sm"
            type="button"
            variant="ghost"
          >
            Cancelar
          </Button>
          <Button size="sm" type="submit">
            Confirmar alteração
          </Button>
        </div>
      </dialog>
    </>
  );
};
