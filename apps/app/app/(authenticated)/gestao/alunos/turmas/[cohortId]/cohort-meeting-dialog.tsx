"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  type CohortMeetingActionResult,
  type CohortMeetingEditValues,
  createGestaoCohortMeeting,
  getGestaoCohortMeetingForEdit,
  updateGestaoCohortMeeting,
} from "./calendar-actions";

const timezoneOptions = [
  ["America/Sao_Paulo", "Brasília / São Paulo"],
  ["America/Manaus", "Manaus"],
  ["America/Rio_Branco", "Rio Branco"],
  ["Europe/Lisbon", "Lisboa"],
  ["UTC", "UTC"],
] as const;

const dateTimeInputInTimezone = (value: string, timezone: string) => {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    return "";
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
};

const meetingEndDateTimeInput = (
  meeting: CohortMeetingEditValues | null,
  date: string
) => {
  if (!meeting) {
    return `${date}T10:00`;
  }
  if (!meeting.endsAt) {
    return "";
  }
  return dateTimeInputInTimezone(meeting.endsAt, meeting.timezone);
};

const meetingSaveLabel = (
  meeting: CohortMeetingEditValues | null,
  publish: boolean,
  pending: boolean
) => {
  if (pending) {
    return "Salvando…";
  }
  if (meeting?.status === "PUBLISHED") {
    return "Salvar alterações";
  }
  if (publish) {
    return "Publicar encontro";
  }
  return "Salvar rascunho";
};

const meetingSuccessMessage = (
  meetingId: string | undefined,
  meeting: CohortMeetingEditValues | null,
  publish: boolean
) => {
  if (!meetingId) {
    return publish
      ? "Encontro publicado para a turma."
      : "Rascunho salvo. Os alunos ainda não veem este encontro.";
  }
  if (meeting?.status === "DRAFT" && publish) {
    return "Encontro publicado para a turma.";
  }
  return publish
    ? "Alterações salvas. O encontro continua publicado para a turma."
    : "Rascunho atualizado. Os alunos ainda não veem este encontro.";
};

const MeetingFieldError = ({
  fields,
  name,
}: {
  readonly fields: Readonly<Record<string, string>> | undefined;
  readonly name: string;
}) =>
  fields?.[name] ? (
    <p className="gt-field-error" id={`gt-meeting-${name}-error`}>
      {fields[name]}
    </p>
  ) : null;

const meetingFieldProps = (
  fields: Readonly<Record<string, string>> | undefined,
  name: string
) => ({
  "aria-invalid": fields?.[name] ? true : undefined,
  "aria-describedby": fields?.[name] ? `gt-meeting-${name}-error` : undefined,
});

const MeetingRecurrenceFields = ({
  fields,
  meeting,
  onChange,
  recurrence,
}: {
  readonly fields: Readonly<Record<string, string>> | undefined;
  readonly meeting: CohortMeetingEditValues | null;
  readonly onChange: (value: CohortMeetingEditValues["recurrence"]) => void;
  readonly recurrence: CohortMeetingEditValues["recurrence"];
}) => (
  <>
    <label htmlFor="gt-meeting-recurrence">Repetição</label>
    <select
      id="gt-meeting-recurrence"
      onChange={(event) =>
        onChange(
          event.currentTarget.value as CohortMeetingEditValues["recurrence"]
        )
      }
      value={recurrence}
    >
      <option value="NONE">Não repetir</option>
      <option value="DAILY">Diariamente</option>
      <option value="WEEKLY">Semanalmente</option>
      <option value="MONTHLY">Mensalmente</option>
    </select>
    {recurrence !== "NONE" ? (
      <>
        <label htmlFor="gt-meeting-repeat-end">Repetir até (opcional)</label>
        <input
          defaultValue={
            meeting?.recurrenceUntil
              ? dateTimeInputInTimezone(
                  meeting.recurrenceUntil,
                  meeting.timezone
                )
              : ""
          }
          id="gt-meeting-repeat-end"
          name="recurrenceUntil"
          type="datetime-local"
          {...meetingFieldProps(fields, "recurrenceUntil")}
        />
        <MeetingFieldError fields={fields} name="recurrenceUntil" />
      </>
    ) : null}
  </>
);

const MeetingPublicationFields = ({
  fields,
  meeting,
  onPublishChange,
  publish,
}: {
  readonly fields: Readonly<Record<string, string>> | undefined;
  readonly meeting: CohortMeetingEditValues | null;
  readonly onPublishChange: (value: boolean) => void;
  readonly publish: boolean;
}) => {
  if (meeting?.status === "PUBLISHED") {
    return (
      <label className="gt-meeting-checkbox">
        <input checked disabled type="checkbox" />
        Publicado para a turma
      </label>
    );
  }
  return (
    <>
      <label className="gt-meeting-checkbox">
        <input
          checked={publish}
          onChange={(event) => onPublishChange(event.currentTarget.checked)}
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
              {...meetingFieldProps(fields, "confirmed")}
            />
            Confirmo que este encontro ficará visível para os alunos da turma.
          </label>
          <MeetingFieldError fields={fields} name="confirmed" />
        </>
      ) : null}
    </>
  );
};

const MeetingEditorForm = ({
  date,
  fields,
  meeting,
  onClose,
  onRecurrenceChange,
  onPublishChange,
  onSubmit,
  pending,
  publish,
  recurrence,
  result,
}: {
  readonly date: string;
  readonly fields: Readonly<Record<string, string>> | undefined;
  readonly meeting: CohortMeetingEditValues | null;
  readonly onClose: () => void;
  readonly onRecurrenceChange: (
    value: CohortMeetingEditValues["recurrence"]
  ) => void;
  readonly onPublishChange: (value: boolean) => void;
  readonly onSubmit: (data: FormData) => void;
  readonly pending: boolean;
  readonly publish: boolean;
  readonly recurrence: CohortMeetingEditValues["recurrence"];
  readonly result: CohortMeetingActionResult | null;
}) => (
  <form
    className="gt-meeting-form"
    onSubmit={(event) => {
      event.preventDefault();
      onSubmit(new FormData(event.currentTarget));
    }}
  >
    <fieldset disabled={pending}>
      <label htmlFor="gt-meeting-title-input">Título</label>
      <input
        autoFocus
        defaultValue={meeting?.title ?? ""}
        id="gt-meeting-title-input"
        maxLength={140}
        name="title"
        required
        {...meetingFieldProps(fields, "title")}
      />
      <MeetingFieldError fields={fields} name="title" />
      <label htmlFor="gt-meeting-description">Descrição</label>
      <textarea
        defaultValue={meeting?.description ?? ""}
        id="gt-meeting-description"
        maxLength={4000}
        name="description"
        rows={3}
      />
      <label htmlFor="gt-meeting-start">Início</label>
      <input
        defaultValue={
          meeting
            ? dateTimeInputInTimezone(meeting.startsAt, meeting.timezone)
            : `${date}T09:00`
        }
        id="gt-meeting-start"
        name="startsAt"
        required
        type="datetime-local"
        {...meetingFieldProps(fields, "startsAt")}
      />
      <MeetingFieldError fields={fields} name="startsAt" />
      <label htmlFor="gt-meeting-end">Término</label>
      <input
        defaultValue={meetingEndDateTimeInput(meeting, date)}
        id="gt-meeting-end"
        name="endsAt"
        required
        type="datetime-local"
        {...meetingFieldProps(fields, "endsAt")}
      />
      <MeetingFieldError fields={fields} name="endsAt" />
      <label htmlFor="gt-meeting-timezone">Fuso horário</label>
      <select
        defaultValue={meeting?.timezone ?? "America/Sao_Paulo"}
        id="gt-meeting-timezone"
        name="timezone"
      >
        {meeting &&
        !timezoneOptions.some(([value]) => value === meeting.timezone) ? (
          <option value={meeting.timezone}>{meeting.timezone}</option>
        ) : null}
        {timezoneOptions.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <label htmlFor="gt-meeting-link">Link do encontro</label>
      <input
        defaultValue={meeting?.joinUrl ?? ""}
        id="gt-meeting-link"
        maxLength={2000}
        name="joinUrl"
        required={publish}
        type="url"
        {...meetingFieldProps(fields, "joinUrl")}
      />
      <MeetingFieldError fields={fields} name="joinUrl" />
      <MeetingRecurrenceFields
        fields={fields}
        meeting={meeting}
        onChange={onRecurrenceChange}
        recurrence={recurrence}
      />
      <MeetingPublicationFields
        fields={fields}
        meeting={meeting}
        onPublishChange={onPublishChange}
        publish={publish}
      />
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
        {meetingSaveLabel(meeting, publish, pending)}
      </Button>
    </div>
  </form>
);

const MeetingDialogContent = ({
  date,
  fields,
  loadError,
  loading,
  meeting,
  meetingId,
  onClose,
  onRecurrenceChange,
  onPublishChange,
  onSubmit,
  pending,
  publish,
  recurrence,
  result,
}: {
  readonly date: string;
  readonly fields: Readonly<Record<string, string>> | undefined;
  readonly loadError: string | null;
  readonly loading: boolean;
  readonly meeting: CohortMeetingEditValues | null;
  readonly meetingId: string | undefined;
  readonly onClose: () => void;
  readonly onRecurrenceChange: (
    value: CohortMeetingEditValues["recurrence"]
  ) => void;
  readonly onPublishChange: (value: boolean) => void;
  readonly onSubmit: (data: FormData) => void;
  readonly pending: boolean;
  readonly publish: boolean;
  readonly recurrence: CohortMeetingEditValues["recurrence"];
  readonly result: CohortMeetingActionResult | null;
}) => {
  if (result?.ok) {
    return (
      <div aria-live="polite">
        <p>{meetingSuccessMessage(meetingId, meeting, publish)}</p>
        <Button autoFocus onClick={onClose} type="button">
          Concluir
        </Button>
      </div>
    );
  }
  if (loading) {
    return (
      <div aria-live="polite">
        <p>Carregando encontro…</p>
        <Button onClick={onClose} type="button" variant="outline">
          Cancelar
        </Button>
      </div>
    );
  }
  if (loadError) {
    return (
      <div role="alert">
        <p>{loadError}</p>
        <Button autoFocus onClick={onClose} type="button">
          Fechar
        </Button>
      </div>
    );
  }
  return (
    <MeetingEditorForm
      date={date}
      fields={fields}
      meeting={meeting}
      onClose={onClose}
      onPublishChange={onPublishChange}
      onRecurrenceChange={onRecurrenceChange}
      onSubmit={onSubmit}
      pending={pending}
      publish={publish}
      recurrence={recurrence}
      result={result}
    />
  );
};

const saveCohortMeeting = (input: {
  readonly cohortId: string;
  readonly data: FormData;
  readonly expectedCohortVersion: number;
  readonly idempotencyKey: string;
  readonly meeting: CohortMeetingEditValues | null;
  readonly publish: boolean;
  readonly recurrence: CohortMeetingEditValues["recurrence"];
}) => {
  const values = {
    cohortId: input.cohortId,
    expectedCohortVersion:
      input.meeting?.cohortVersion ?? input.expectedCohortVersion,
    title: String(input.data.get("title") ?? ""),
    description: String(input.data.get("description") ?? ""),
    startsAt: String(input.data.get("startsAt") ?? ""),
    endsAt: String(input.data.get("endsAt") ?? ""),
    timezone: String(input.data.get("timezone") ?? ""),
    joinUrl: String(input.data.get("joinUrl") ?? ""),
    recurrence: input.recurrence,
    recurrenceUntil: String(input.data.get("recurrenceUntil") ?? ""),
    status: input.publish ? "PUBLISHED" : "DRAFT",
    confirmed:
      input.meeting?.status === "PUBLISHED" ||
      input.data.get("confirmed") === "on",
    idempotencyKey: input.idempotencyKey,
  } as const;
  if (input.meeting) {
    return updateGestaoCohortMeeting({
      ...values,
      meetingId: input.meeting.id,
      expectedMeetingUpdatedAt: input.meeting.updatedAt,
    });
  }
  return createGestaoCohortMeeting(values);
};

export const CohortMeetingDialog = ({
  cohortId,
  cohortName,
  date,
  expectedCohortVersion,
  meetingId,
  onClose,
}: {
  readonly cohortId: string;
  readonly cohortName: string;
  readonly date: string;
  readonly expectedCohortVersion: number;
  readonly meetingId?: string;
  readonly onClose: () => void;
}) => {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const operationKey = useRef<string | null>(null);
  const submitting = useRef(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CohortMeetingActionResult | null>(null);
  const [meeting, setMeeting] = useState<CohortMeetingEditValues | null>(null);
  const [loading, setLoading] = useState(Boolean(meetingId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recurrence, setRecurrence] =
    useState<CohortMeetingEditValues["recurrence"]>("NONE");
  const [publish, setPublish] = useState(false);
  const fields = result && !result.ok ? result.fields : undefined;

  useEffect(() => {
    dialog.current?.showModal();
    if (!meetingId) {
      return;
    }
    let active = true;
    const loadMeeting = async () => {
      try {
        const response = await getGestaoCohortMeetingForEdit({
          cohortId,
          meetingId,
        });
        if (!active) {
          return;
        }
        if (!response.ok) {
          setLoadError(response.message);
          return;
        }
        setMeeting(response.meeting);
        setRecurrence(response.meeting.recurrence);
        setPublish(response.meeting.status === "PUBLISHED");
      } catch {
        if (active) {
          setLoadError("Não foi possível carregar este encontro agora.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    loadMeeting();
    return () => {
      active = false;
    };
  }, [cohortId, meetingId]);

  const save = (data: FormData) => {
    if (submitting.current) {
      return;
    }
    operationKey.current ??= crypto.randomUUID();
    submitting.current = true;
    setResult(null);
    startTransition(async () => {
      try {
        const saved = await saveCohortMeeting({
          cohortId,
          data,
          expectedCohortVersion,
          idempotencyKey: operationKey.current as string,
          meeting,
          publish,
          recurrence,
        });
        setResult(saved);
        if (saved.ok) {
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
      <h2 id="gt-meeting-title">
        {meetingId ? "Editar encontro" : "Novo encontro"}
      </h2>
      <p>{cohortName}</p>
      <MeetingDialogContent
        date={date}
        fields={fields}
        loadError={loadError}
        loading={loading}
        meeting={meeting}
        meetingId={meetingId}
        onClose={onClose}
        onPublishChange={setPublish}
        onRecurrenceChange={setRecurrence}
        onSubmit={save}
        pending={pending}
        publish={publish}
        recurrence={recurrence}
        result={result}
      />
    </dialog>
  );
};
