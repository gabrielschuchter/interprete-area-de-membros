"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  type CohortMeetingActionResult,
  createGestaoCohortMeeting,
} from "./calendar-actions";

export const CohortMeetingDialog = ({
  cohortId,
  cohortName,
  date,
  expectedCohortVersion,
  onClose,
}: {
  readonly cohortId: string;
  readonly cohortName: string;
  readonly date: string;
  readonly expectedCohortVersion: number;
  readonly onClose: () => void;
}) => {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const operationKey = useRef<string | null>(null);
  const submitting = useRef(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CohortMeetingActionResult | null>(null);
  const [recurrence, setRecurrence] = useState("NONE");
  const [publish, setPublish] = useState(false);
  const fields = result && !result.ok ? result.fields : undefined;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const save = (data: FormData) => {
    if (submitting.current) {
      return;
    }
    operationKey.current ??= crypto.randomUUID();
    submitting.current = true;
    setResult(null);
    startTransition(async () => {
      try {
        const response = await createGestaoCohortMeeting({
          cohortId,
          expectedCohortVersion,
          title: String(data.get("title") ?? ""),
          description: String(data.get("description") ?? ""),
          startsAt: String(data.get("startsAt") ?? ""),
          endsAt: String(data.get("endsAt") ?? ""),
          timezone: String(data.get("timezone") ?? ""),
          joinUrl: String(data.get("joinUrl") ?? ""),
          recurrence,
          recurrenceUntil: String(data.get("recurrenceUntil") ?? ""),
          status: publish ? "PUBLISHED" : "DRAFT",
          confirmed: data.get("confirmed") === "on",
          idempotencyKey: operationKey.current,
        });
        setResult(response);
        if (response.ok) {
          router.refresh();
        }
      } catch {
        setResult({
          ok: false,
          code: "unavailable",
          message:
            "Não foi possível confirmar o salvamento. Tente novamente com os mesmos dados.",
        });
      } finally {
        submitting.current = false;
      }
    });
  };

  const errorFor = (name: string) =>
    fields?.[name] ? (
      <p className="gt-field-error" id={`gt-meeting-${name}-error`}>
        {fields[name]}
      </p>
    ) : null;
  const fieldProps = (name: string) => ({
    "aria-invalid": fields?.[name] ? true : undefined,
    "aria-describedby": fields?.[name] ? `gt-meeting-${name}-error` : undefined,
  });
  let saveLabel = publish ? "Publicar encontro" : "Salvar rascunho";
  if (pending) {
    saveLabel = "Salvando…";
  }

  return (
    <dialog
      aria-labelledby="gt-meeting-title"
      className="gt-calendar-confirmation gt-meeting-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) {
          onClose();
        }
      }}
      ref={dialog}
    >
      <h2 id="gt-meeting-title">Novo encontro</h2>
      <p>{cohortName}</p>
      {result?.ok ? (
        <div aria-live="polite">
          <p>
            {publish
              ? "Encontro publicado para a turma."
              : "Rascunho salvo. Os alunos ainda não veem este encontro."}
          </p>
          <Button autoFocus onClick={onClose} type="button">
            Concluir
          </Button>
        </div>
      ) : (
        <form
          className="gt-meeting-form"
          onSubmit={(event) => {
            event.preventDefault();
            save(new FormData(event.currentTarget));
          }}
        >
          <fieldset disabled={pending}>
            <label htmlFor="gt-meeting-title-input">Título</label>
            <input
              autoFocus
              id="gt-meeting-title-input"
              maxLength={140}
              name="title"
              required
              {...fieldProps("title")}
            />
            {errorFor("title")}
            <label htmlFor="gt-meeting-description">Descrição</label>
            <textarea
              id="gt-meeting-description"
              maxLength={4000}
              name="description"
              rows={3}
            />
            <label htmlFor="gt-meeting-start">Início</label>
            <input
              defaultValue={`${date}T09:00`}
              id="gt-meeting-start"
              name="startsAt"
              required
              type="datetime-local"
              {...fieldProps("startsAt")}
            />
            {errorFor("startsAt")}
            <label htmlFor="gt-meeting-end">Término</label>
            <input
              defaultValue={`${date}T10:00`}
              id="gt-meeting-end"
              name="endsAt"
              required
              type="datetime-local"
              {...fieldProps("endsAt")}
            />
            {errorFor("endsAt")}
            <label htmlFor="gt-meeting-timezone">Fuso horário</label>
            <select
              defaultValue="America/Sao_Paulo"
              id="gt-meeting-timezone"
              name="timezone"
            >
              <option value="America/Sao_Paulo">Brasília / São Paulo</option>
              <option value="America/Manaus">Manaus</option>
              <option value="America/Rio_Branco">Rio Branco</option>
              <option value="Europe/Lisbon">Lisboa</option>
              <option value="UTC">UTC</option>
            </select>
            <label htmlFor="gt-meeting-link">Link do encontro</label>
            <input
              id="gt-meeting-link"
              maxLength={2000}
              name="joinUrl"
              required={publish}
              type="url"
              {...fieldProps("joinUrl")}
            />
            {errorFor("joinUrl")}
            <label htmlFor="gt-meeting-recurrence">Repetição</label>
            <select
              id="gt-meeting-recurrence"
              onChange={(event) => setRecurrence(event.target.value)}
              value={recurrence}
            >
              <option value="NONE">Não repetir</option>
              <option value="DAILY">Diariamente</option>
              <option value="WEEKLY">Semanalmente</option>
              <option value="MONTHLY">Mensalmente</option>
            </select>
            {recurrence !== "NONE" ? (
              <>
                <label htmlFor="gt-meeting-repeat-end">
                  Repetir até (opcional)
                </label>
                <input
                  id="gt-meeting-repeat-end"
                  name="recurrenceUntil"
                  type="datetime-local"
                  {...fieldProps("recurrenceUntil")}
                />
                {errorFor("recurrenceUntil")}
              </>
            ) : null}
            <label className="gt-meeting-checkbox">
              <input
                checked={publish}
                onChange={(event) => setPublish(event.target.checked)}
                type="checkbox"
              />
              Publicar para a turma
            </label>
            {publish ? (
              <>
                <label className="gt-meeting-checkbox">
                  <input
                    name="confirmed"
                    required
                    type="checkbox"
                    {...fieldProps("confirmed")}
                  />
                  Confirmo que este encontro ficará visível para os alunos da
                  turma.
                </label>
                {errorFor("confirmed")}
              </>
            ) : null}
          </fieldset>
          {result && !result.ok ? <p role="alert">{result.message}</p> : null}
          <div className="gt-meeting-actions">
            <Button
              disabled={pending}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button disabled={pending} type="submit">
              {saveLabel}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
};
