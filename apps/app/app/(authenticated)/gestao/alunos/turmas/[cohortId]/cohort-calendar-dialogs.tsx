"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useEffect, useRef, useState } from "react";
import type { CohortCalendarItem } from "@/lib/cohort-calendar-domain";
import type { CohortCalendarOccurrenceResult } from "./calendar-occurrence-actions";

// Loaded only when a confirmation or an occurrence adjustment opens, so the
// calendar route keeps these out of its initial JavaScript.
export const CalendarConfirmationDialog = ({
  message,
  onCancel,
  onConfirm,
}: {
  readonly message: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
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
      aria-describedby="gt-calendar-confirmation-copy"
      aria-labelledby="gt-calendar-confirmation-title"
      aria-modal="true"
      className="gt-calendar-confirmation"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      ref={dialogRef}
    >
      <h2 id="gt-calendar-confirmation-title">Confirmar ação</h2>
      <p id="gt-calendar-confirmation-copy">{message}</p>
      <div>
        <Button autoFocus onClick={onCancel} type="button" variant="outline">
          Cancelar
        </Button>
        <Button onClick={onConfirm} type="button">
          Confirmar
        </Button>
      </div>
    </dialog>
  );
};

export type CalendarOccurrenceOperation = "move" | "cancel" | "restore";

export const CalendarOccurrenceDialog = ({
  initialStartsAt,
  item,
  itemLabel,
  onCancel,
  onEditMeeting,
  onSave,
  pending,
  result,
}: {
  readonly initialStartsAt: string;
  readonly item: CohortCalendarItem;
  readonly itemLabel: string;
  readonly onCancel: () => void;
  readonly onEditMeeting: (meetingId: string) => void;
  readonly onSave: (
    operation: CalendarOccurrenceOperation,
    startsAtOverride: string,
    idempotencyKey: string
  ) => void;
  readonly pending: boolean;
  readonly result: CohortCalendarOccurrenceResult | null;
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const [operation, setOperation] =
    useState<CalendarOccurrenceOperation>("move");
  const [startsAtOverride, setStartsAtOverride] = useState(initialStartsAt);
  const saveLabel =
    operation === "restore" ? "Restaurar data" : "Salvar alteração";
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  const submit = () => {
    idempotencyKey.current ??= crypto.randomUUID();
    onSave(operation, startsAtOverride, idempotencyKey.current);
  };

  return (
    <dialog
      aria-describedby="gt-calendar-occurrence-copy"
      aria-labelledby="gt-calendar-occurrence-title"
      aria-modal="true"
      className="gt-calendar-confirmation"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      ref={dialogRef}
    >
      <h2 id="gt-calendar-occurrence-title">Ajustar esta ocorrência</h2>
      <p id="gt-calendar-occurrence-copy">
        {itemLabel}. A mudança vale apenas para esta data.
      </p>
      <fieldset>
        <legend>O que deseja fazer?</legend>
        <label>
          <input
            checked={operation === "move"}
            name="cohort-calendar-occurrence-operation"
            onChange={() => {
              idempotencyKey.current = null;
              setOperation("move");
            }}
            type="radio"
          />
          Remarcar
        </label>
        {operation === "move" ? (
          <label>
            Nova data e horário
            <input
              autoFocus
              onChange={(event) => {
                idempotencyKey.current = null;
                setStartsAtOverride(event.currentTarget.value);
              }}
              required
              type="datetime-local"
              value={startsAtOverride}
            />
          </label>
        ) : null}
        <label>
          <input
            checked={operation === "cancel"}
            name="cohort-calendar-occurrence-operation"
            onChange={() => {
              idempotencyKey.current = null;
              setOperation("cancel");
            }}
            type="radio"
          />
          Cancelar somente esta data
        </label>
        {item.exceptionVersion !== null ? (
          <label>
            <input
              checked={operation === "restore"}
              name="cohort-calendar-occurrence-operation"
              onChange={() => {
                idempotencyKey.current = null;
                setOperation("restore");
              }}
              type="radio"
            />
            Restaurar a ocorrência original
          </label>
        ) : null}
      </fieldset>
      {result?.ok === false ? (
        <div className="gt-error-summary" role="alert">
          <p>{result.message}</p>
          {result.fields ? (
            <ul>
              {Object.entries(result.fields).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div>
        {item.sourceType === "meeting" ? (
          <Button
            disabled={pending}
            onClick={() => onEditMeeting(item.sourceId)}
            type="button"
            variant="outline"
          >
            Editar série
          </Button>
        ) : null}
        <Button
          autoFocus={operation !== "move"}
          disabled={pending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Fechar
        </Button>
        <Button disabled={pending} onClick={submit} type="button">
          {pending ? "Salvando…" : saveLabel}
        </Button>
      </div>
    </dialog>
  );
};
