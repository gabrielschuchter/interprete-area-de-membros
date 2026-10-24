"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { GestaoIcon } from "../../../../gestao-icon";

const debounceMs = 250;

/** Busca do aluno da turma (atraso de 250 ms) e filtro de situação na URL. */
export const RosterFilters = ({
  query,
  situation,
}: {
  readonly query: string;
  readonly situation: string;
}) => {
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
          aria-label="Buscar aluno da turma"
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
          placeholder="Buscar aluno da turma"
          type="search"
          value={value}
        />
      </span>
      <span className="gk-field" style={{ width: 190 }}>
        <select
          aria-label="Situação"
          className="gk-select"
          onChange={(event) => navigate({ situacao: event.target.value })}
          value={situation}
        >
          <option value="">Situação</option>
          <option value="ON_TRACK">Em ritmo</option>
          <option value="ATTENTION">Atenção</option>
          <option value="INACTIVE">Inativo</option>
        </select>
        <GestaoIcon
          className="gk-select-caret"
          name="chevron-down"
          size={14}
          strokeWidth={1.8}
        />
      </span>
    </div>
  );
};
