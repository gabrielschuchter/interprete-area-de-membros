"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { GestaoIcon } from "../../../gestao-icon";

const debounceMs = 250;

interface QuestionFiltersProperties {
  readonly categories: readonly {
    readonly id: string;
    readonly title: string;
  }[];
  readonly category: string;
  readonly query: string;
  readonly status: string;
}

const FilterSelect = ({
  label,
  onChange,
  options,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly (readonly [string, string])[];
  readonly value: string;
}) => (
  <span className="gk-field" style={{ width: 190 }}>
    <select
      aria-label={label}
      className="gk-select"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      <option value="">{label}</option>
      {options.map(([key, text]) => (
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
);

/** Busca, categoria e estado da lista; todos vivem na URL. */
export const QuestionFilters = ({
  categories,
  category,
  query,
  status,
}: QuestionFiltersProperties) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(query);
  const [, startTransition] = useTransition();
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
    <div className="gk-toolbar-group">
      <span className="gk-field" style={{ width: 300 }}>
        <GestaoIcon name="search" size={16} />
        <input
          aria-label="Buscar nesta lista"
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
          placeholder="Buscar nesta lista"
          type="search"
          value={value}
        />
      </span>
      <FilterSelect
        label="Categoria"
        onChange={(next) => navigate({ categoria: next })}
        options={categories.map((item) => [item.id, item.title] as const)}
        value={category}
      />
      <FilterSelect
        label="Estado"
        onChange={(next) => navigate({ estado: next })}
        options={[
          ["DRAFT", "Rascunho"],
          ["PUBLISHED", "Publicado"],
          ["ARCHIVED", "Arquivado"],
        ]}
        value={status}
      />
    </div>
  );
};
