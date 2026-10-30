"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useRef } from "react";
import { cohortCalendarEventColors } from "@/lib/cohort-calendar-domain";
import type { CohortCalendarActionResult } from "./calendar-actions";
import type { EventForm } from "./cohort-calendar-editor";

const calendarFieldError = (
  result: CohortCalendarActionResult | null,
  name: "title" | "startsAt" | "endsAt"
) => (result?.ok === false ? result.fields?.[name] : undefined);

const CalendarFieldError = ({
  name,
  result,
}: {
  readonly name: "title" | "startsAt" | "endsAt";
  readonly result: CohortCalendarActionResult | null;
}) => {
  const error = calendarFieldError(result, name);
  return error ? <em className="gt-field-error">{error}</em> : null;
};

const CalendarResultMessages = ({
  onRefresh,
  result,
}: {
  readonly onRefresh: () => void;
  readonly result: CohortCalendarActionResult | null;
}) => {
  if (result?.ok === false) {
    return (
      <>
        <p className="gt-error-summary" role="alert">
          {result.message}
        </p>
        {result.code === "conflict" ? (
          <Button onClick={onRefresh} type="button" variant="outline">
            Atualizar versões e conferir
          </Button>
        ) : null}
      </>
    );
  }
  return result?.ok === true ? (
    <output className="gt-success-message">Alteração salva.</output>
  ) : null;
};

export const CohortCalendarEventForm = ({
  archived,
  eventId,
  eventPublished,
  form,
  onChange,
  onClose,
  onCreate,
  onPublish,
  onRefresh,
  onSaveDraft,
  pending,
  result,
}: {
  readonly archived: boolean;
  readonly eventId: string | null;
  readonly eventPublished: boolean;
  readonly form: EventForm;
  readonly onChange: <K extends keyof EventForm>(
    key: K,
    value: EventForm[K]
  ) => void;
  readonly onClose: () => void;
  readonly onCreate: () => void;
  readonly onPublish: () => void;
  readonly onRefresh: () => void;
  readonly onSaveDraft: () => void;
  readonly pending: boolean;
  readonly result: CohortCalendarActionResult | null;
}) => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const requestPublish = () => {
    if (formRef.current?.reportValidity()) {
      onPublish();
    }
  };
  let saveLabel = "Salvar rascunho";
  if (pending) {
    saveLabel = "Salvando…";
  } else if (eventPublished) {
    saveLabel = "Salvar alterações";
  }

  return (
    <section className="gt-panel">
      <div className="gt-panel-heading">
        <h2>{eventId ? "Editar evento" : "Novo evento da turma"}</h2>
        <div className="gt-calendar-form-heading-actions">
          {eventId ? (
            <Button onClick={onCreate} type="button" variant="ghost">
              Novo
            </Button>
          ) : null}
          <Button onClick={onClose} type="button" variant="ghost">
            Fechar
          </Button>
        </div>
      </div>
      {archived ? (
        <p className="gt-panel-copy">
          A turma está arquivada. O calendário permanece em modo de leitura.
        </p>
      ) : (
        <form
          className="gt-cohort-event-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveDraft();
          }}
          ref={formRef}
        >
          <label className="gt-field">
            <span>Título</span>
            <input
              aria-invalid={Boolean(calendarFieldError(result, "title"))}
              maxLength={140}
              onChange={(event) => onChange("title", event.target.value)}
              required
              value={form.title}
            />
            <CalendarFieldError name="title" result={result} />
          </label>
          <label className="gt-field">
            <span>Início · horário de Brasília</span>
            <input
              aria-invalid={Boolean(calendarFieldError(result, "startsAt"))}
              onChange={(event) => onChange("startsAt", event.target.value)}
              required
              type="datetime-local"
              value={form.startsAt}
            />
            <CalendarFieldError name="startsAt" result={result} />
          </label>
          <label className="gt-field">
            <span>Término · opcional</span>
            <input
              aria-invalid={Boolean(calendarFieldError(result, "endsAt"))}
              onChange={(event) => onChange("endsAt", event.target.value)}
              type="datetime-local"
              value={form.endsAt}
            />
            <CalendarFieldError name="endsAt" result={result} />
          </label>
          <label className="gt-field">
            <span>Repetição</span>
            <select
              onChange={(event) =>
                onChange(
                  "recurrence",
                  event.target.value as EventForm["recurrence"]
                )
              }
              value={form.recurrence}
            >
              <option value="NONE">Não se repete</option>
              <option value="DAILY">Diária</option>
              <option value="WEEKLY">Semanal</option>
              <option value="MONTHLY">Mensal</option>
            </select>
          </label>
          {form.recurrence !== "NONE" ? (
            <label className="gt-field">
              <span>Repetir até · opcional</span>
              <input
                onChange={(event) =>
                  onChange("recurrenceUntil", event.target.value)
                }
                type="datetime-local"
                value={form.recurrenceUntil}
              />
            </label>
          ) : null}
          <label className="gt-cohort-event-checkbox">
            <input
              checked={form.allDay}
              onChange={(event) => onChange("allDay", event.target.checked)}
              type="checkbox"
            />
            <span>Dia inteiro</span>
          </label>
          <label className="gt-field">
            <span>Descrição</span>
            <textarea
              maxLength={4000}
              onChange={(event) => onChange("description", event.target.value)}
              rows={3}
              value={form.description}
            />
          </label>
          <label className="gt-field">
            <span>Cor</span>
            <select
              onChange={(event) => onChange("color", event.target.value)}
              value={form.color}
            >
              {cohortCalendarEventColors.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <div className="gt-cohort-event-actions">
            <Button disabled={pending} type="submit" variant="outline">
              {saveLabel}
            </Button>
            {eventPublished ? null : (
              <Button disabled={pending} onClick={requestPublish} type="button">
                {pending ? "Salvando…" : "Publicar para alunos"}
              </Button>
            )}
          </div>
          <CalendarResultMessages onRefresh={onRefresh} result={result} />
        </form>
      )}
    </section>
  );
};
