"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { GestaoIcon } from "../../gestao-icon";

interface CohortFiltersProperties {
  readonly query: string;
  readonly responsibleOptions: readonly {
    readonly displayName: string | null;
    readonly id: string;
  }[];
  readonly selectedTeacherId: string;
}

const debounceMs = 250;

/** Busca (com atraso de 250 ms) e filtro de responsável; ambos vivem na URL. */
export const CohortFilters = ({
  query,
  responsibleOptions,
  selectedTeacherId,
}: CohortFiltersProperties) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(query);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(query), [query]);
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );

  const navigate = (values: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, next] of Object.entries(values)) {
      if (next) {
        params.set(key, next);
      } else {
        params.delete(key);
      }
    }
    params.delete("pagina");
    startTransition(() =>
      router.replace(`${pathname}${params.size ? `?${params}` : ""}`, {
        scroll: false,
      })
    );
  };

  return (
    <div
      aria-busy={pending}
      className="gk-toolbar-group"
      data-pending={String(pending)}
    >
      <span className="gk-field" style={{ width: 300 }}>
        <GestaoIcon name="search" size={16} />
        <input
          aria-label="Buscar turmas"
          autoComplete="off"
          className="gk-input"
          maxLength={120}
          onChange={(event) => {
            const next = event.target.value;
            setValue(next);
            if (timer.current) {
              clearTimeout(timer.current);
            }
            timer.current = setTimeout(
              () => navigate({ q: next.trim() }),
              debounceMs
            );
          }}
          placeholder="Buscar turmas"
          type="search"
          value={value}
        />
      </span>
      {responsibleOptions.length > 1 ? (
        <span className="gk-field" style={{ width: 190 }}>
          <select
            aria-label="Responsável"
            className="gk-select"
            onChange={(event) => navigate({ responsavel: event.target.value })}
            value={selectedTeacherId}
          >
            <option value="">Responsável</option>
            {responsibleOptions.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.displayName ?? "Sem nome"}
              </option>
            ))}
          </select>
          <GestaoIcon
            className="gk-select-caret"
            name="chevron-down"
            size={14}
            strokeWidth={1.8}
          />
        </span>
      ) : null}
    </div>
  );
};
