"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { GestaoIcon } from "../../gestao-icon";
import { setGestaoActivityStatus } from "./actions";

export const ActivityRowMenu = ({
  id,
  status,
  title,
  version,
}: {
  readonly id: string;
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  readonly title: string;
  readonly version: number;
}) => {
  const router = useRouter();
  const next = status === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Mais ações da atividade ${title}`}
          className="gk-icon-btn gk-icon-btn--bare"
          type="button"
        >
          <GestaoIcon name="dots" size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="gk-menu">
        <DropdownMenuItem
          onSelect={() => router.push(`/gestao/ensino/atividades/${id}`)}
        >
          Editar atividade
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            router.push(`/gestao/ensino/atividades/${id}/entregas`)
          }
        >
          Ver entregas
        </DropdownMenuItem>
        {status === "DRAFT" ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action={setGestaoActivityStatus}>
                <input name="activityId" type="hidden" value={id} />
                <input name="version" type="hidden" value={version} />
                <input name="status" type="hidden" value={next} />
                <button className="gk-menu-form-btn" type="submit">
                  {status === "PUBLISHED"
                    ? "Arquivar atividade"
                    : "Reativar atividade"}
                </button>
              </form>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
