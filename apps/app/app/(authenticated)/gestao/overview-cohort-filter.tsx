"use client";

import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { getGestaoOverviewAttention } from "@/lib/gestao-overview";

type Filter = Awaited<
  ReturnType<typeof getGestaoOverviewAttention>
>["cohortFilter"];
export const OverviewCohortFilter = ({
  filter,
}: {
  readonly filter: Filter;
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !details.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        if (details.current?.contains(document.activeElement)) {
          event.preventDefault();
          details.current.querySelector<HTMLElement>("summary")?.focus();
        }
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);
  const navigate = (values: Record<string, string | null>, close = true) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    if (close) {
      setOpen(false);
    }
    startTransition(() =>
      router.push(`/gestao${params.size ? `?${params}` : ""}`, {
        scroll: false,
      })
    );
  };
  const select = (id: string | null) =>
    navigate({ turma: id, qTurmas: null, paginaTurmas: null });
  return (
    <details
      className="go-cohort-filter"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
      ref={details}
    >
      <summary aria-busy={pending}>
        <span className="go-filter-surface">
          <span>{filter.selectedCohort?.name ?? "Todas as minhas turmas"}</span>
          <ChevronDownIcon aria-hidden="true" size={14} />
        </span>
      </summary>
      <div className="go-cohort-options">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            navigate(
              {
                qTurmas: String(
                  new FormData(event.currentTarget).get("qTurmas") ?? ""
                ),
                paginaTurmas: null,
              },
              false
            );
          }}
        >
          <label className="sr-only" htmlFor="overview-cohort-query">
            Buscar turma
          </label>
          <input
            defaultValue={filter.query}
            id="overview-cohort-query"
            key={filter.query}
            maxLength={120}
            name="qTurmas"
            placeholder="Buscar turma"
            type="search"
          />
          <button aria-label="Buscar turma" disabled={pending} type="submit">
            <SearchIcon aria-hidden="true" size={16} />
          </button>
        </form>
        <button
          aria-pressed={!filter.selectedCohort}
          disabled={pending}
          onClick={() => select(null)}
          type="button"
        >
          Todas as minhas turmas
        </button>
        <fieldset>
          <legend className="sr-only">Turmas encontradas</legend>
          {filter.cohorts.map((cohort) => (
            <button
              aria-pressed={filter.selectedCohort?.id === cohort.id}
              disabled={pending}
              key={cohort.id}
              onClick={() => select(cohort.id)}
              type="button"
            >
              {cohort.name}
            </button>
          ))}
          {filter.cohorts.length === 0 ? (
            <p>Nenhuma turma encontrada.</p>
          ) : null}
        </fieldset>
        {filter.query ? (
          <button
            disabled={pending}
            onClick={() =>
              navigate({ qTurmas: null, paginaTurmas: null }, false)
            }
            type="button"
          >
            Limpar busca
          </button>
        ) : null}
        <div className="go-filter-pagination">
          <button
            disabled={pending || filter.page <= 1}
            onClick={() =>
              navigate({ paginaTurmas: String(filter.page - 1) }, false)
            }
            type="button"
          >
            Anterior
          </button>
          <span>
            {filter.page} de {filter.pages}
          </span>
          <button
            disabled={pending || filter.page >= filter.pages}
            onClick={() =>
              navigate({ paginaTurmas: String(filter.page + 1) }, false)
            }
            type="button"
          >
            Próxima
          </button>
        </div>
        <output aria-live="polite">
          {pending
            ? "Carregando turmas…"
            : `${filter.total} turmas encontradas`}
        </output>
      </div>
    </details>
  );
};
