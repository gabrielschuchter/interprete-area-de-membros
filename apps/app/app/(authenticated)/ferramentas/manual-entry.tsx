"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { ChevronDownIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import type { ManualStudyEntry } from "@/lib/study-week-shelf";
import {
  type ShelfGroup,
  shelfGroupColors,
  shelfGroupLabels,
  shelfGroups,
} from "@/lib/study-week-shelf-model";
import {
  addManualStudyEntryAction,
  deleteManualStudyEntryAction,
} from "./study-manual-actions";

const MONO = "font-data";
const QUICK_MINUTES = [5, 15, 30, 60] as const;

const entryTimeLabel = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));

const chipClass = (selected: boolean) =>
  cn(
    "min-h-11 rounded border px-2 text-[13px] transition-colors",
    selected
      ? "border-[#F1EBE8] bg-[#F1EBE8] font-semibold text-[#410230]"
      : "border-[#7A2446] text-[#E9C3C4] hover:bg-white/10"
  );

const EntryList = ({
  entries,
  onRemove,
  pending,
}: {
  readonly entries: readonly ManualStudyEntry[];
  readonly onRemove: (id: string) => void;
  readonly pending: boolean;
}) => (
  <div className="flex flex-col gap-1.5">
    <span
      className={cn(
        MONO,
        "text-[#CDB9B2] text-[11px] uppercase tracking-[.18em]"
      )}
    >
      Lançados nesta semana
    </span>
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {entries.map((entry) => (
        <li
          className="flex items-center gap-2.5 rounded border border-[#5A2233] px-3 py-1"
          key={entry.id}
        >
          <i
            className="h-5 w-1.5 shrink-0 rounded-[1px]"
            style={{ background: shelfGroupColors[entry.group] }}
          />
          <span className="min-w-0 flex-1 text-[#F1EBE8] text-[13px]">
            {shelfGroupLabels[entry.group]}
            <span className="ml-2 text-[#CDB9B2] text-xs">
              {entryTimeLabel(entry.at)}
            </span>
          </span>
          <span className={cn(MONO, "text-[#E9C3C4] text-[13px]")}>
            {entry.minutes} min
          </span>
          <Button
            aria-label={`Remover lançamento de ${entry.minutes} minutos`}
            className="size-11 text-[#E9C3C4] hover:bg-white/10 hover:text-white"
            disabled={pending}
            onClick={() => onRemove(entry.id)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <XIcon aria-hidden="true" className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  </div>
);

export interface ManualEntryProps {
  readonly entries: readonly ManualStudyEntry[];
  readonly pending: boolean;
  readonly run: (task: () => Promise<unknown>, success?: string) => void;
}

/**
 * Lançamento manual de tempo, recolhido por padrão: uma linha só até a
 * pessoa precisar. Aberto: tipo, minutos, botão principal e a lista da
 * semana (cada item com seu próprio "remover").
 */
export const ManualEntry = ({ entries, pending, run }: ManualEntryProps) => {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<ShelfGroup>("reading");
  const [minutes, setMinutes] = useState<number>(15);

  return (
    <div className="flex flex-col gap-3">
      <button
        aria-controls="manual-entry-panel"
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 rounded border border-[#7A2446] px-3 text-left text-[#E9C3C4] text-[13px] transition-colors hover:bg-white/10"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <PlusIcon aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          Estudou fora da plataforma? Lançar tempo
          {entries.length > 0 ? (
            <span className="ml-2 text-[#CDB9B2] text-xs">
              ({entries.length} nesta semana)
            </span>
          ) : null}
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <div className="flex flex-col gap-3" id="manual-entry-panel">
          <fieldset className="m-0 grid grid-cols-3 gap-2 border-0 p-0">
            <legend className="sr-only">Tipo de estudo</legend>
            {shelfGroups.map((item) => (
              <button
                aria-pressed={group === item}
                className={chipClass(group === item)}
                key={item}
                onClick={() => setGroup(item)}
                type="button"
              >
                {shelfGroupLabels[item]}
              </button>
            ))}
          </fieldset>
          <fieldset className="m-0 grid grid-cols-4 gap-2 border-0 p-0">
            <legend className="sr-only">Minutos</legend>
            {QUICK_MINUTES.map((value) => (
              <button
                aria-pressed={minutes === value}
                className={cn(chipClass(minutes === value), MONO)}
                key={value}
                onClick={() => setMinutes(value)}
                type="button"
              >
                {value} min
              </button>
            ))}
          </fieldset>
          <Button
            className="h-11 w-full rounded bg-[#F1EBE8] px-5 font-semibold text-[#410230] hover:bg-white"
            disabled={pending}
            onClick={() =>
              run(
                () => addManualStudyEntryAction({ group, minutes }),
                "Tempo lançado na estante."
              )
            }
            type="button"
          >
            Lançar {minutes} min de {shelfGroupLabels[group].toLowerCase()}
          </Button>
          {entries.length > 0 ? (
            <EntryList
              entries={entries}
              onRemove={(id) =>
                run(
                  () => deleteManualStudyEntryAction(id),
                  "Lançamento removido."
                )
              }
              pending={pending}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
