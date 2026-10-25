"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { GestaoIcon } from "./gestao-icon";

const debounceMs = 250;

export interface FilterSelect {
  readonly label: string;
  readonly options: readonly (readonly [string, string])[];
  readonly param: string;
  readonly value: string;
}

/** Busca (250 ms) e filtros por lista; tudo vive na URL e zera a paginação. */
export const GestaoFilterBar = ({
  compact = false,
  placeholder,
  query,
  resetParams = ["pagina"],
  selects,
}: {
  /** Empilha os controles na largura do contêiner (painéis estreitos). */
  readonly compact?: boolean;
  /** Parâmetros descartados a cada mudança de filtro. */
  readonly resetParams?: readonly string[];
  readonly placeholder: string;
  readonly query: string;
  readonly selects: readonly FilterSelect[];
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

  const navigate = (param: string, next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set(param, next);
    } else {
      params.delete(param);
    }
    for (const reset of resetParams) {
      params.delete(reset);
    }
    startTransition(() =>
      router.replace(`${pathname}${params.size ? `?${params}` : ""}`, {
        scroll: false,
      })
    );
  };

  return (
    <div
      aria-busy={pending}
      className={`gk-toolbar-group${compact ? "gk-toolbar-group--stack" : ""}`}
      data-pending={String(pending)}
    >
      <span className="gk-field" style={compact ? undefined : { width: 300 }}>
        <GestaoIcon name="search" size={16} />
        <input
          aria-label={placeholder}
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
              () => navigate("q", next.trim()),
              debounceMs
            );
          }}
          placeholder={placeholder}
          type="search"
          value={value}
        />
      </span>
      {selects.map((select) => (
        <span
          className="gk-field"
          key={select.param}
          style={compact ? undefined : { width: 190 }}
        >
          <select
            aria-label={select.label}
            className="gk-select"
            onChange={(event) => navigate(select.param, event.target.value)}
            value={select.value}
          >
            <option value="">{select.label}</option>
            {select.options.map(([key, text]) => (
              <option key={key} value={key}>
                {text}
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
      ))}
    </div>
  );
};
