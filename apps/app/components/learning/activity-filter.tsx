"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export const ActivityFilter = () => {
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();
  const [pending, startTransition] = useTransition();
  return (
    <label className="activity-filter">
      Mostrar
      <select
        aria-label="Mostrar atividades"
        defaultValue={query.get("status") ?? "all"}
        onChange={(event) => {
          const value = event.target.value;
          startTransition(() =>
            router.replace(
              value === "all" ? pathname : `${pathname}?status=${value}`,
              { scroll: false }
            )
          );
        }}
      >
        <option value="all">Todas</option>
        <option value="pending">Pendentes</option>
        <option value="submitted">Enviadas</option>
        <option value="reviewed">Com feedback</option>
      </select>
      <span aria-live="polite" className="text-sm">
        {pending ? "Atualizando…" : ""}
      </span>
    </label>
  );
};
