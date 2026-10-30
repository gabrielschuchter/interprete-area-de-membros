"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { toast } from "@repo/design-system/lib/toast";
import { PlusIcon, SparklesIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type {
  StudyGoalTopicOverview,
  StudyGoalTopicPeriod,
} from "@/lib/study-goal-topics";
import { saveStudyGoalTopicsAction } from "./actions";

interface DraftRow {
  readonly sharePercent: number;
  readonly topic: string;
}

const MAX_TOPICS = 8;

// Mesma regra do servidor: partes inteiras, o resto vai para os primeiros.
const splitEvenly = (topics: readonly string[]): DraftRow[] => {
  const unique = [...new Set(topics)].slice(0, MAX_TOPICS);
  const base = unique.length ? Math.floor(100 / unique.length) : 0;
  const remainder = 100 - base * unique.length;
  return unique.map((topic, index) => ({
    topic,
    sharePercent: base + (index < remainder ? 1 : 0),
  }));
};

export function GoalTopics({
  overview,
  period,
  studied,
  targetMinutes,
}: {
  readonly overview: StudyGoalTopicOverview;
  readonly period: "WEEKLY" | "MONTHLY";
  readonly studied: StudyGoalTopicPeriod | undefined;
  readonly targetMinutes: number;
}) {
  const router = useRouter();
  const headingId = useId();
  const saved = studied?.topics ?? [];
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<DraftRow[]>(() =>
    saved.map(({ topic, sharePercent }) => ({ topic, sharePercent }))
  );
  const [adding, setAdding] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!editing) {
      setRows(
        (studied?.topics ?? []).map(({ topic, sharePercent }) => ({
          topic,
          sharePercent,
        }))
      );
    }
  }, [editing, studied]);

  const total = rows.reduce((sum, row) => sum + row.sharePercent, 0);
  const available = overview.catalog.filter(
    (topic) => !rows.some((row) => row.topic === topic)
  );
  const suggestion = overview.interests.length
    ? overview.interests
    : overview.catalog.slice(0, 3);

  const save = async (next: readonly DraftRow[]) => {
    setPending(true);
    try {
      await saveStudyGoalTopicsAction({ period, topics: [...next] });
      toast.success(
        next.length ? "Divisão por tema salva." : "Divisão por tema removida."
      );
      setEditing(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a divisão."
      );
    } finally {
      setPending(false);
    }
  };

  if (!editing) {
    return (
      <section
        aria-labelledby={headingId}
        className="mt-6 border-[#EEE5E1] border-t pt-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-[#40222F] text-sm" id={headingId}>
            Divisão por tema
          </h3>
          <Button
            className="min-h-10"
            onClick={() => {
              if (saved.length === 0) {
                setRows(splitEvenly(suggestion));
              }
              setEditing(true);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {saved.length ? "Ajustar temas" : "Dividir por tema"}
          </Button>
        </div>
        {saved.length ? (
          <ul className="mt-4 grid gap-3">
            {saved.map((row) => {
              const percent =
                row.targetMinutes > 0
                  ? Math.min(
                      100,
                      Math.round((row.minutesStudied / row.targetMinutes) * 100)
                    )
                  : 0;
              return (
                <li key={row.topic}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 text-[#40222F]">{row.topic}</span>
                    <span className="shrink-0 font-mono text-[#7A5A69] text-xs">
                      {row.minutesStudied}/{row.targetMinutes} min
                    </span>
                  </div>
                  <div
                    aria-label={`${row.topic}: ${percent}% da parte da meta`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={percent}
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F1EBE8]"
                    role="progressbar"
                  >
                    <span
                      className="block h-full rounded-full bg-[#8C1535]"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
            {studied && studied.unassignedMinutes > 0 ? (
              <li className="text-[#7A5A69] text-xs">
                {studied.unassignedMinutes} min em materiais de outros temas ou
                sem tema. Eles contam para a meta total.
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="mt-2 text-[#7A5A69] text-xs leading-relaxed">
            Reserve parte da meta para cada tema de interesse. O tempo conta
            pelo tema do curso, do material da Biblioteca ou da lista de
            exercícios.
          </p>
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className="mt-6 border-[#EEE5E1] border-t pt-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-[#40222F] text-sm" id={headingId}>
          Divisão por tema
        </h3>
        <Button
          className="min-h-10"
          onClick={() =>
            setRows(
              splitEvenly(
                rows.length ? rows.map((row) => row.topic) : suggestion
              )
            )
          }
          size="sm"
          type="button"
          variant="ghost"
        >
          <SparklesIcon aria-hidden="true" className="size-4" />
          Distribuir automaticamente
        </Button>
      </div>
      <p className="mt-1 text-[#7A5A69] text-xs">
        {overview.interests.length
          ? "A sugestão parte dos interesses do seu perfil."
          : "Seu perfil ainda não tem interesses; escolha os temas abaixo."}
      </p>
      <ul className="mt-4 grid gap-2">
        {rows.map((row, index) => (
          <li className="flex items-center gap-2" key={row.topic}>
            <span className="min-w-0 flex-1 text-[#40222F] text-sm">
              {row.topic}
            </span>
            <label className="flex shrink-0 items-center gap-1 text-[#7A5A69] text-xs">
              <span className="sr-only">
                Parte de {row.topic} em porcentagem
              </span>
              <input
                className="h-10 w-16 rounded-md border border-[#E2D6D1] bg-white px-2 text-right text-[#40222F] text-sm"
                inputMode="numeric"
                max={100}
                min={1}
                onChange={(event) => {
                  const value = Math.max(
                    1,
                    Math.min(100, Math.round(Number(event.target.value) || 1))
                  );
                  setRows((current) =>
                    current.map((item, position) =>
                      position === index
                        ? { ...item, sharePercent: value }
                        : item
                    )
                  );
                }}
                type="number"
                value={row.sharePercent}
              />
              %
            </label>
            <span className="w-16 shrink-0 text-right font-mono text-[#7A5A69] text-xs">
              {Math.round((targetMinutes * row.sharePercent) / 100)} min
            </span>
            <Button
              aria-label={`Remover ${row.topic}`}
              className="size-10"
              onClick={() =>
                setRows((current) =>
                  current.filter((_, position) => position !== index)
                )
              }
              size="icon"
              type="button"
              variant="ghost"
            >
              <XIcon aria-hidden="true" className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      {rows.length < MAX_TOPICS && available.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Tema para adicionar</span>
            <select
              className="h-10 w-full rounded-md border border-[#E2D6D1] bg-white px-3 text-[#40222F] text-sm"
              onChange={(event) => setAdding(event.target.value)}
              value={adding}
            >
              <option value="">Adicionar tema…</option>
              {available.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </label>
          <Button
            className="min-h-10"
            disabled={!adding}
            onClick={() => {
              setRows((current) => [
                ...current,
                { topic: adding, sharePercent: 1 },
              ]);
              setAdding("");
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <PlusIcon aria-hidden="true" className="size-4" />
            Adicionar
          </Button>
        </div>
      ) : null}
      <p
        className={`mt-3 text-xs ${total > 100 ? "text-[#B42318]" : "text-[#7A5A69]"}`}
        role={total > 100 ? "alert" : undefined}
      >
        {total > 100
          ? `A soma está em ${total}%. Reduza as partes até 100%.`
          : `Soma das partes: ${total}%. O restante fica livre.`}
      </p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {saved.length ? (
          <Button
            className="mr-auto min-h-10"
            disabled={pending}
            onClick={() => save([])}
            size="sm"
            type="button"
            variant="ghost"
          >
            Remover divisão
          </Button>
        ) : null}
        <Button
          className="min-h-10"
          disabled={pending}
          onClick={() => setEditing(false)}
          size="sm"
          type="button"
          variant="outline"
        >
          Cancelar
        </Button>
        <Button
          className="min-h-10"
          disabled={pending || total > 100 || rows.length === 0}
          onClick={() => save(rows)}
          size="sm"
          type="button"
        >
          {pending ? "Salvando…" : "Salvar divisão"}
        </Button>
      </div>
    </section>
  );
}
