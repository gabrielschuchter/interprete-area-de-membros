"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { GestaoIcon } from "../../gestao-icon";

export const StudentRowMenu = ({
  id,
  name,
}: {
  readonly id: string;
  readonly name: string;
}) => {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Mais ações para ${name}`}
          className="gk-icon-btn gk-icon-btn--bare"
          type="button"
        >
          <GestaoIcon name="dots" size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="gk-menu">
        <DropdownMenuItem
          onSelect={() => router.push(`/gestao/alunos/perfil/${id}`)}
        >
          Ver perfil
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            router.push(
              `/gestao/alunos/correcoes?q=${encodeURIComponent(name)}`
            )
          }
        >
          Ver correções
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
