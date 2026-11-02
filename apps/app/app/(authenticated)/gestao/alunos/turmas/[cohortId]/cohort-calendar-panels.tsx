"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  type CohortCalendarDateConflict,
  cohortCalendarTimezone,
} from "@/lib/cohort-calendar-domain";
import {
  type CohortCalendarCopyResult,
  copyGestaoCohortCalendarAgenda,
} from "./calendar-copy-actions";
import {
  createGestaoCohortCalendarFeed,
  revokeGestaoCohortCalendarFeed,
} from "./calendar-feed-actions";

interface CalendarCopySource {
  readonly id: string;
  readonly name: string;
}

export const CalendarFeedControls = ({
  archived,
  cohortId,
}: {
  readonly archived: boolean;
  readonly cohortId: string;
}) => {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  let createLabel = "Assinar calendário (.ics)";
  if (pending) {
    createLabel = "Gerando…";
  } else if (url) {
    createLabel = "Gerar novo link";
  }
  const createFeed = () => {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await createGestaoCohortCalendarFeed(cohortId);
      if (result.ok && result.url) {
        setUrl(result.url);
        setMessage(
          "Assinatura criada. Use o link em um aplicativo de calendário."
        );
      } else if (!result.ok) {
        setError(result.message);
      }
    });
  };
  const revokeFeed = () => {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await revokeGestaoCohortCalendarFeed(cohortId);
      if (result.ok) {
        setUrl(null);
        setMessage("Link revogado.");
      } else {
        setError(result.message);
      }
    });
  };
  const copyFeed = async () => {
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(
        new URL(url, window.location.origin).toString()
      );
      setMessage("Endereço copiado.");
    } catch {
      setError("Não foi possível copiar. Abra o link e copie o endereço.");
    }
  };

  return (
    <div className="gt-calendar-feed-controls">
      <div className="gt-cohort-event-actions">
        <Button
          disabled={archived || pending}
          onClick={createFeed}
          type="button"
        >
          {createLabel}
        </Button>
        <Button
          disabled={pending}
          onClick={revokeFeed}
          type="button"
          variant="outline"
        >
          Revogar link
        </Button>
      </div>
      {url ? (
        <div className="gt-cohort-event-actions">
          <a href={url}>Abrir calendário .ics</a>
          <Button onClick={copyFeed} type="button" variant="ghost">
            Copiar endereço
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="gt-error-summary" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <output aria-live="polite">{message}</output> : null}
    </div>
  );
};

const CalendarCopyConfirmation = ({
  onCancel,
  onConfirm,
  pending,
  sourceName,
}: {
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly pending: boolean;
  readonly sourceName: string;
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  return (
    <dialog
      aria-labelledby="gt-calendar-copy-heading"
      className="gt-confirmation-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) {
          onCancel();
        }
      }}
      ref={dialogRef}
    >
      <h2 id="gt-calendar-copy-heading">Copiar agenda</h2>
      <p>
        Copiar os itens de “{sourceName}” para esta turma? Eventos serão criados
        como rascunhos. Encontros e prazos publicados ficarão visíveis para esta
        turma; liberações manterão as datas quando o curso estiver acessível.
        Alunos e convites não serão copiados.
      </p>
      <div className="gt-cohort-event-actions">
        <Button
          disabled={pending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancelar
        </Button>
        <Button disabled={pending} onClick={onConfirm} type="button">
          {pending ? "Copiando…" : "Copiar agenda"}
        </Button>
      </div>
    </dialog>
  );
};

export const CalendarCopyControls = ({
  archived,
  cohortId,
  copySources,
  expectedCohortVersion,
}: {
  readonly archived: boolean;
  readonly cohortId: string;
  readonly copySources: readonly CalendarCopySource[];
  readonly expectedCohortVersion: number;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sourceId, setSourceId] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [result, setResult] = useState<CohortCalendarCopyResult | null>(null);
  const selectedSource = copySources.find((source) => source.id === sourceId);
  const confirmCopy = () => {
    if (!selectedSource) {
      return;
    }
    setResult(null);
    const idempotencyKey = crypto.randomUUID();
    startTransition(async () => {
      const response = await copyGestaoCohortCalendarAgenda({
        sourceCohortId: selectedSource.id,
        destinationCohortId: cohortId,
        expectedDestinationVersion: expectedCohortVersion,
        idempotencyKey,
      });
      setResult(response);
      setConfirmationOpen(false);
      if (response.ok) {
        router.refresh();
      }
    });
  };
  const message = result?.ok
    ? `Agenda copiada: ${result.counts.eventsCreated} eventos em rascunho, ${result.counts.meetingsAdded} encontros, ${result.counts.activitiesAdded} prazos e ${result.counts.releasesCreated + result.counts.releasesUpdated} liberações. ${result.counts.releasesSkipped} liberações não foram copiadas porque o curso não está acessível nesta turma.`
    : null;

  return (
    <>
      <section
        aria-labelledby="gt-calendar-copy-controls-heading"
        className="gt-panel"
      >
        <h2 id="gt-calendar-copy-controls-heading">Copiar outra agenda</h2>
        <p>Use uma turma existente como ponto de partida para esta agenda.</p>
        <label className="gt-field" htmlFor="gt-calendar-copy-source">
          <span>Turma de origem</span>
          <select
            disabled={archived || pending || copySources.length === 0}
            id="gt-calendar-copy-source"
            onChange={(event) => setSourceId(event.target.value)}
            value={sourceId}
          >
            <option value="">Selecione uma turma</option>
            {copySources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          disabled={archived || pending || !selectedSource}
          onClick={() => setConfirmationOpen(true)}
          type="button"
          variant="outline"
        >
          Copiar agenda
        </Button>
        {copySources.length === 0 ? (
          <p>Não há outras turmas disponíveis para copiar.</p>
        ) : null}
        {result?.ok === false ? (
          <p className="gt-error-summary" role="alert">
            {result.message}
            {result.code === "conflict" ? (
              <Button
                onClick={() => router.refresh()}
                type="button"
                variant="link"
              >
                Atualizar turma
              </Button>
            ) : null}
          </p>
        ) : null}
        {message ? <output aria-live="polite">{message}</output> : null}
      </section>
      {confirmationOpen && selectedSource ? (
        <CalendarCopyConfirmation
          onCancel={() => setConfirmationOpen(false)}
          onConfirm={confirmCopy}
          pending={pending}
          sourceName={selectedSource.name}
        />
      ) : null}
    </>
  );
};

const conflictDayLabel = (day: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: cohortCalendarTimezone,
    dateStyle: "full",
  }).format(new Date(`${day}T12:00:00Z`));

const calendarConflictSummary = (conflict: CohortCalendarDateConflict) => {
  const names = {
    event: ["um evento da turma", "eventos da turma"],
    meeting: ["um encontro", "encontros"],
    activity: ["um prazo de atividade", "prazos de atividade"],
    "lesson-release": ["uma liberação de aula", "liberações de aula"],
  } as const;
  const types = ["meeting", "activity", "lesson-release", "event"] as const;
  const parts = types.flatMap((type) => {
    const count = conflict.sourceCounts[type] ?? 0;
    if (count === 0) {
      return [];
    }
    return [count === 1 ? names[type][0] : `${count} ${names[type][1]}`];
  });
  const kinds = parts.join(" e ");
  const capitalizedKinds = kinds
    ? `${kinds.slice(0, 1).toLocaleUpperCase("pt-BR")}${kinds.slice(1)}`
    : "Itens da turma";
  return `${conflict.eventCount} itens no mesmo dia. ${capitalizedKinds}. Não bloqueia.`;
};

export const CalendarConflictPanel = ({
  conflicts,
  limited,
}: {
  readonly conflicts: readonly CohortCalendarDateConflict[];
  readonly limited: boolean;
}) => {
  let content: ReactNode;
  if (limited) {
    content = (
      <p>
        Há muitos eventos publicados neste período para comparar de uma vez.
        Revise a lista completa antes de publicar.
      </p>
    );
  } else if (conflicts.length === 0) {
    content = <p>Não há eventos publicados no mesmo dia neste período.</p>;
  } else {
    content = (
      <>
        <p>
          Estes avisos são informativos e não impedem salvar ou publicar.
          Confira os horários antes de confirmar.
        </p>
        <ul className="gt-calendar-conflict-list">
          {conflicts.map((conflict) => (
            <li key={conflict.day}>
              <strong>{conflictDayLabel(conflict.day)}</strong>
              <span>{calendarConflictSummary(conflict)}</span>
              <small>{conflict.titles.join(" · ")}</small>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <section
      aria-labelledby="gt-calendar-conflicts-heading"
      aria-live="polite"
      className="gt-panel gt-calendar-conflicts"
    >
      <div className="gt-panel-heading">
        <h2 id="gt-calendar-conflicts-heading">Conflitos de data</h2>
      </div>
      {content}
    </section>
  );
};
