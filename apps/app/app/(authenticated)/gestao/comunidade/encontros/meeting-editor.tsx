"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  gestaoMeetingDateTime,
  gestaoMeetingKinds,
  gestaoMeetingRecurrenceOptions,
  gestaoMeetingTimezoneOptions,
} from "@/lib/gestao-meetings-domain";
import {
  AudienceStep,
  type CohortOption,
  type StudentOption,
} from "../../alunos/atribuicoes/nova/assignment-wizard-steps";
import { useGestaoDirtyRegistration } from "../../dirty-registry";
import { FormDirtyIndicator } from "../../form-dirty-indicator";
import { GestaoIcon, type GestaoIconName } from "../../gestao-icon";
import {
  archiveGestaoMeeting,
  type GestaoMeetingFormState,
  reopenGestaoMeeting,
  saveGestaoMeeting,
} from "./actions";

const MeetingAttendanceDialog = dynamic(() =>
  import("./meeting-attendance-dialog").then(
    (module) => module.MeetingAttendanceDialog
  )
);

const initial: GestaoMeetingFormState = { error: null };

interface Attendee {
  readonly id: string;
  readonly name: string;
  readonly present: boolean;
}

interface Option {
  readonly id: string;
  readonly title: string;
}

export interface MeetingEditorValues {
  readonly activityId: string;
  readonly attendanceCount: number;
  readonly canRecordAttendance: boolean;
  readonly courseId: string;
  readonly date: string;
  readonly description: string;
  readonly end: string;
  readonly hasRecording: boolean;
  readonly id: string;
  readonly joinUrl: string;
  readonly kind: string;
  readonly libraryItemId: string;
  readonly materialsPublished: boolean;
  readonly publishDate: string;
  readonly publishTime: string;
  readonly recordingUrl: string;
  readonly recurrence: string;
  readonly start: string;
  readonly state: "archived" | "draft" | "published" | "scheduled";
  readonly timezone: string;
  readonly title: string;
  readonly until: string;
}

export interface MeetingEditorProperties {
  readonly activities: readonly Option[];
  readonly attendees: readonly Attendee[];
  readonly cohortIds: readonly string[];
  readonly cohorts: readonly CohortOption[];
  readonly courses: readonly Option[];
  readonly idempotencyKey: string;
  readonly libraryItems: readonly Option[];
  readonly meeting: MeetingEditorValues | null;
  readonly people: readonly StudentOption[];
  readonly presetDate: string;
}

const stateNames = {
  archived: "Arquivado",
  draft: "Rascunho",
  published: "Publicado",
  scheduled: "Agendado",
} as const;

const stateTones = {
  archived: "muted",
  draft: "neutral",
  published: "active",
  scheduled: "warn",
} as const;

const initialSchedule = (
  meeting: MeetingEditorValues | null,
  presetDate: string
): Schedule => ({
  date: meeting?.date ?? presetDate,
  end: meeting?.end ?? "",
  kind: meeting?.kind ?? "OTHER",
  recurrence: meeting?.recurrence ?? "NONE",
  start: meeting?.start ?? "",
  timezone: meeting?.timezone ?? "America/Sao_Paulo",
  until: meeting?.until ?? "",
});

const initialRelated = (meeting: MeetingEditorValues | null): Related => ({
  activityId: meeting?.activityId ?? "",
  courseId: meeting?.courseId ?? "",
  libraryItemId: meeting?.libraryItemId ?? "",
});

const initialPublication = (
  meeting: MeetingEditorValues | null
): Publication => ({
  date: meeting?.publishDate ?? "",
  scheduling: meeting?.state === "scheduled",
  time: meeting?.publishTime ?? "09:00",
});

const SelectField = ({
  children,
  icon,
  label,
  name,
  onChange,
  value,
}: {
  readonly children: React.ReactNode;
  readonly icon?: GestaoIconName;
  readonly label: string;
  readonly name: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) => (
  <div className="gk-label">
    <label htmlFor={`meeting-${name}`}>{label}</label>
    <span className="gk-field gk-field--full">
      {icon ? <GestaoIcon name={icon} size={16} /> : null}
      <select
        className="gk-select"
        id={`meeting-${name}`}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        style={icon ? { paddingLeft: 36 } : undefined}
        value={value}
      >
        {children}
      </select>
      <GestaoIcon className="gk-select-caret" name="chevron-down" size={14} />
    </span>
  </div>
);

const InputField = ({
  icon,
  label,
  name,
  onChange,
  placeholder,
  required = false,
  type = "text",
  value,
}: {
  readonly icon: GestaoIconName;
  readonly label: string;
  readonly name: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly type?: string;
  readonly value: string;
}) => (
  <div className="gk-label">
    <label htmlFor={`meeting-${name}`}>
      {label}
      {required ? " *" : ""}
    </label>
    <span className="gk-field gk-field--full">
      <GestaoIcon name={icon} size={16} />
      <input
        className="gk-input"
        id={`meeting-${name}`}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </span>
  </div>
);

interface Schedule {
  readonly date: string;
  readonly end: string;
  readonly kind: string;
  readonly recurrence: string;
  readonly start: string;
  readonly timezone: string;
  readonly until: string;
}

const ScheduleFields = ({
  onChange,
  schedule,
}: {
  readonly onChange: (next: Schedule) => void;
  readonly schedule: Schedule;
}) => {
  const set = (patch: Partial<Schedule>) => onChange({ ...schedule, ...patch });
  const repeatLabels = useMemo(() => {
    const anchor =
      gestaoMeetingDateTime(schedule.date, "12:00", schedule.timezone) ??
      new Date();
    return gestaoMeetingRecurrenceOptions(anchor, schedule.timezone);
  }, [schedule.date, schedule.timezone]);
  return (
    <>
      <div className="gk-form-grid gk-form-grid--datetime">
        <InputField
          icon="calendar"
          label="Data"
          name="date"
          onChange={(date) => set({ date })}
          required
          type="date"
          value={schedule.date}
        />
        <InputField
          icon="clock"
          label="Início"
          name="start"
          onChange={(start) => set({ start })}
          required
          type="time"
          value={schedule.start}
        />
        <InputField
          icon="clock"
          label="Fim"
          name="end"
          onChange={(end) => set({ end })}
          type="time"
          value={schedule.end}
        />
      </div>
      <div className="gk-form-grid gk-form-grid--three">
        <SelectField
          label="Tipo"
          name="kind"
          onChange={(kind) => set({ kind })}
          value={schedule.kind}
        >
          {gestaoMeetingKinds.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Fuso horário"
          name="timezone"
          onChange={(timezone) => set({ timezone })}
          value={schedule.timezone}
        >
          {gestaoMeetingTimezoneOptions(schedule.timezone).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            )
          )}
        </SelectField>
        <SelectField
          label="Repetir"
          name="recurrence"
          onChange={(recurrence) => set({ recurrence })}
          value={schedule.recurrence}
        >
          {repeatLabels.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
      </div>
      {schedule.recurrence === "NONE" ? null : (
        <InputField
          icon="calendar"
          label="Repetir até (opcional)"
          name="until"
          onChange={(until) => set({ until })}
          type="date"
          value={schedule.until}
        />
      )}
    </>
  );
};

const MeetingCard = ({
  description,
  joinUrl,
  onChange,
  onDescription,
  onJoinUrl,
  onTitle,
  schedule,
  title,
}: {
  readonly description: string;
  readonly joinUrl: string;
  readonly onChange: (next: Schedule) => void;
  readonly onDescription: (value: string) => void;
  readonly onJoinUrl: (value: string) => void;
  readonly onTitle: (value: string) => void;
  readonly schedule: Schedule;
  readonly title: string;
}) => (
  <section className="gk-card gk-form-card">
    <h2>Encontro</h2>
    <label className="gk-label">
      <span>Título *</span>
      <input
        className="gk-input"
        maxLength={140}
        name="title"
        onChange={(event) => onTitle(event.target.value)}
        required
        value={title}
      />
    </label>
    <label className="gk-label">
      <span>Contexto</span>
      <textarea
        className="gk-input gk-textarea"
        maxLength={4000}
        name="description"
        onChange={(event) => onDescription(event.target.value)}
        placeholder="O que será discutido, o que o aluno deve trazer."
        rows={5}
        value={description}
      />
    </label>
    <ScheduleFields onChange={onChange} schedule={schedule} />
    <InputField
      icon="link"
      label="Link da sala"
      name="joinUrl"
      onChange={onJoinUrl}
      placeholder="https://meet.exemplo.com/sala"
      type="url"
      value={joinUrl}
    />
  </section>
);

interface Related {
  readonly activityId: string;
  readonly courseId: string;
  readonly libraryItemId: string;
}

const RelatedCard = ({
  activities,
  courses,
  libraryItems,
  onChange,
  related,
}: {
  readonly activities: readonly Option[];
  readonly courses: readonly Option[];
  readonly libraryItems: readonly Option[];
  readonly onChange: (next: Related) => void;
  readonly related: Related;
}) => (
  <section className="gk-card gk-form-card">
    <h2>Relacionados</h2>
    <div className="gk-form-grid gk-form-grid--three">
      <SelectField
        icon="book"
        label="Curso"
        name="courseId"
        onChange={(courseId) => onChange({ ...related, courseId })}
        value={related.courseId}
      >
        <option value="">Nenhum curso</option>
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.title}
          </option>
        ))}
      </SelectField>
      <SelectField
        icon="inbox"
        label="Atividade"
        name="relatedActivityId"
        onChange={(activityId) => onChange({ ...related, activityId })}
        value={related.activityId}
      >
        <option value="">Nenhuma atividade</option>
        {activities.map((activity) => (
          <option key={activity.id} value={activity.id}>
            {activity.title}
          </option>
        ))}
      </SelectField>
      <SelectField
        icon="file"
        label="Leitura"
        name="relatedLibraryItemId"
        onChange={(libraryItemId) => onChange({ ...related, libraryItemId })}
        value={related.libraryItemId}
      >
        <option value="">Nenhuma leitura</option>
        {libraryItems.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </SelectField>
    </div>
  </section>
);

interface Audience {
  readonly cohortIds: readonly string[];
  readonly people: readonly StudentOption[];
}

const ParticipantsCard = ({
  audience,
  cohorts,
  onChange,
}: {
  readonly audience: Audience;
  readonly cohorts: readonly CohortOption[];
  readonly onChange: (next: Audience) => void;
}) => {
  const total =
    cohorts
      .filter((cohort) => audience.cohortIds.includes(cohort.id))
      .reduce((sum, cohort) => sum + cohort.students, 0) +
    audience.people.length;
  return (
    <section className="gk-card gk-form-card">
      <h2>Participantes</h2>
      <AudienceStep
        cohorts={cohorts}
        heading={null}
        hideLabel
        hint={
          audience.cohortIds.length + audience.people.length === 0 ? (
            "Escolha turmas ou alunos para limitar quem vê o encontro."
          ) : (
            <>
              <strong>
                {total} {total === 1 ? "destinatário" : "destinatários"}.
              </strong>{" "}
              Quem entrar nessas turmas depois também recebe. Alunos repetidos
              contam uma vez.
            </>
          )
        }
        label="Participantes"
        mode="both"
        onCohorts={(cohortIds) => onChange({ ...audience, cohortIds })}
        onMode={() => undefined}
        onStudents={(people) => onChange({ ...audience, people })}
        placeholder="Adicionar turma ou aluno…"
        selectedCohorts={audience.cohortIds}
        selectedStudents={audience.people}
        showModes={false}
        subject="este encontro"
      />
      <p className="gk-hint">
        Sem participantes definidos, o encontro segue a visibilidade do curso.
      </p>
    </section>
  );
};

interface Publication {
  readonly date: string;
  readonly scheduling: boolean;
  readonly time: string;
}

const PublicationCard = ({
  meeting,
  onChange,
  pending,
  publication,
}: {
  readonly meeting: MeetingEditorValues | null;
  readonly onChange: (next: Publication) => void;
  readonly pending: boolean;
  readonly publication: Publication;
}) => {
  const state = meeting?.state ?? "draft";
  const live = state === "published";
  const archived = state === "archived";
  const { scheduling } = publication;
  return (
    <section className="gk-card gk-form-card">
      <h2>Publicação</h2>
      <div className="gk-statusrow">
        <span>Estado</span>
        <span className="gk-chip" data-tone={stateTones[state]}>
          {stateNames[state]}
        </span>
      </div>
      {live || archived ? null : (
        <div className="gk-label">
          <span>Quando publicar</span>
          <fieldset className="gk-segmented gk-segmented--full">
            <legend className="sr-only">Quando publicar</legend>
            <button
              aria-pressed={!scheduling}
              onClick={() => onChange({ ...publication, scheduling: false })}
              type="button"
            >
              Agora
            </button>
            <button
              aria-pressed={scheduling}
              onClick={() => onChange({ ...publication, scheduling: true })}
              type="button"
            >
              Agendar
            </button>
          </fieldset>
        </div>
      )}
      {scheduling && !live && !archived ? (
        <div className="gk-label">
          <span>Publicar em</span>
          <div className="gk-form-grid">
            <input
              aria-label="Data da publicação"
              className="gk-input"
              name="publishDate"
              onChange={(event) =>
                onChange({ ...publication, date: event.target.value })
              }
              required
              type="date"
              value={publication.date}
            />
            <input
              aria-label="Hora da publicação"
              className="gk-input"
              name="publishTime"
              onChange={(event) =>
                onChange({ ...publication, time: event.target.value })
              }
              required
              type="time"
              value={publication.time}
            />
          </div>
          <small className="gk-hint">
            Continua rascunho até a data. A publicação acontece quando um aluno
            ou a equipe abre a agenda depois do horário, e no processamento
            diário da plataforma.
          </small>
        </div>
      ) : null}
      <div className="gk-form-actions gk-form-actions--start">
        {archived ? (
          <button
            className="gk-btn gk-btn--primary"
            disabled={pending}
            formAction={reopenGestaoMeeting}
            formNoValidate
            type="submit"
          >
            Reabrir como rascunho
          </button>
        ) : null}
        {live || archived ? null : (
          <button
            className="gk-btn gk-btn--primary"
            disabled={pending}
            name="intent"
            type="submit"
            value="publish"
          >
            {scheduling ? "Agendar" : "Publicar"}
          </button>
        )}
        {archived ? null : (
          <button
            className="gk-btn"
            disabled={pending}
            name="intent"
            type="submit"
            value={live ? "save" : "draft"}
          >
            {live ? "Salvar alterações" : "Salvar rascunho"}
          </button>
        )}
      </div>
      {live ? (
        <button
          className="gk-link-btn gk-link-btn--muted"
          disabled={pending}
          formAction={archiveGestaoMeeting}
          formNoValidate
          type="submit"
        >
          Arquivar encontro
        </button>
      ) : null}
      <p className="gk-hint">
        {live
          ? "Alterações valem para os alunos assim que você salvar."
          : "Nada aparece para os alunos antes de você publicar."}
      </p>
      <Link
        className="gk-link-btn"
        href="/gestao/comunidade/encontros"
        prefetch={false}
      >
        ← Voltar aos encontros
      </Link>
    </section>
  );
};

const AfterRow = ({
  action,
  done,
  label,
}: {
  readonly action?: React.ReactNode;
  readonly done: boolean;
  readonly label: string;
}) => (
  <div className="gk-afterrow" data-done={done}>
    <GestaoIcon name={done ? "check-circle" : "alert-circle"} size={16} />
    <span>{label}</span>
    {action}
  </div>
);

const AfterCard = ({
  meeting,
  onAttendance,
  onRecording,
  recordingUrl,
}: {
  readonly meeting: MeetingEditorValues | null;
  readonly onAttendance: () => void;
  readonly onRecording: (value: string) => void;
  readonly recordingUrl: string;
}) => (
  <section className="gk-card gk-form-card">
    <h2>Depois do encontro</h2>
    <div className="gk-label">
      <label htmlFor="meeting-recordingUrl">
        Gravação (YouTube, não listado)
      </label>
      <span className="gk-field gk-field--full">
        <GestaoIcon name="link" size={16} />
        <input
          className="gk-input"
          id="meeting-recordingUrl"
          name="recordingUrl"
          onChange={(event) => onRecording(event.target.value)}
          placeholder="https://youtu.be/…"
          value={recordingUrl}
        />
      </span>
      <small className="gk-hint">
        Cole o link do vídeo. A conferência automática de disponibilidade e a
        importação de título e duração dependem da integração do YouTube, que
        ainda não está ligada: por enquanto o link é salvo como está.
      </small>
    </div>
    <AfterRow
      done={Boolean(recordingUrl.trim()) || Boolean(meeting?.hasRecording)}
      label="Gravação associada"
    />
    <AfterRow
      done={Boolean(meeting?.materialsPublished)}
      label="Materiais publicados"
    />
    <AfterRow
      action={
        meeting?.canRecordAttendance ? (
          <button
            className="gk-link-btn gk-afterrow-action"
            onClick={onAttendance}
            type="button"
          >
            {meeting.attendanceCount > 0 ? "Editar" : "Registrar"}
          </button>
        ) : null
      }
      done={(meeting?.attendanceCount ?? 0) > 0}
      label="Presença confirmada"
    />
  </section>
);

const PreviewDialog = ({
  description,
  onClose,
  schedule,
  title,
}: {
  readonly description: string;
  readonly onClose: () => void;
  readonly schedule: Schedule;
  readonly title: string;
}) => (
  <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
    <DialogContent
      className="gk-modal gk-modal--narrow"
      overlayClassName="gk-modal-overlay"
      showCloseButton={false}
    >
      <div className="gk-modal-head">
        <div>
          <DialogTitle className="gk-modal-title">Como o aluno vê</DialogTitle>
          <DialogDescription className="gk-modal-sub">
            Prévia do encontro na área de membros. Nada é publicado por aqui.
          </DialogDescription>
        </div>
      </div>
      <div className="gk-modal-body">
        <article className="gk-notice-preview">
          <GestaoIcon name="calendar" size={18} />
          <div>
            <strong>{title || "Sem título"}</strong>
            <small>
              {schedule.date
                ? `${schedule.date.split("-").reverse().join("/")}, ${schedule.start || "--:--"}${schedule.end ? ` às ${schedule.end}` : ""}`
                : "Data a definir"}
            </small>
            <p>{description || "O contexto aparece aqui."}</p>
          </div>
        </article>
      </div>
      <div className="gk-modal-foot">
        <span className="gk-spacer" />
        <button className="gk-btn" onClick={onClose} type="button">
          Fechar
        </button>
      </div>
    </DialogContent>
  </Dialog>
);

const AudienceFields = ({ audience }: { readonly audience: Audience }) => (
  <>
    {audience.cohortIds.map((id) => (
      <input key={id} name="cohortId" type="hidden" value={id} />
    ))}
    {audience.people.map((person) => (
      <input key={person.id} name="personId" type="hidden" value={person.id} />
    ))}
  </>
);

export const MeetingEditor = ({
  activities,
  attendees,
  cohortIds,
  cohorts,
  courses,
  idempotencyKey,
  libraryItems,
  meeting,
  people,
  presetDate,
}: MeetingEditorProperties) => {
  const [state, action, pending] = useActionState(saveGestaoMeeting, initial);
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [description, setDescription] = useState(meeting?.description ?? "");
  const [joinUrl, setJoinUrl] = useState(meeting?.joinUrl ?? "");
  const [recordingUrl, setRecordingUrl] = useState(meeting?.recordingUrl ?? "");
  const [schedule, setSchedule] = useState(() =>
    initialSchedule(meeting, presetDate)
  );
  const [related, setRelated] = useState(() => initialRelated(meeting));
  const [audience, setAudience] = useState<Audience>({ cohortIds, people });
  const [publication, setPublication] = useState(() =>
    initialPublication(meeting)
  );
  const [previewing, setPreviewing] = useState(false);
  const [attending, setAttending] = useState(false);
  const [touched, setTouched] = useState(false);
  useGestaoDirtyRegistration(touched);

  const live = meeting?.state === "published";
  const archived = meeting?.state === "archived";
  const change =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setTouched(true);
    };

  return (
    <>
      <form
        action={action}
        onChange={() => setTouched(true)}
        onSubmit={() => setTouched(false)}
      >
        {meeting ? (
          <input name="id" type="hidden" value={meeting.id} />
        ) : (
          <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
        )}
        <input
          name="when"
          type="hidden"
          value={publication.scheduling ? "schedule" : "now"}
        />
        <AudienceFields audience={audience} />

        <header className="gk-head gk-head--editor">
          <div className="gk-head-copy">
            <h1>{meeting ? "Editar encontro" : "Novo encontro"}</h1>
          </div>
          <div className="gk-head-actions">
            <FormDirtyIndicator savedLabel={meeting ? "Salvo agora" : "Novo"} />
            <button
              className="gk-btn"
              onClick={() => setPreviewing(true)}
              type="button"
            >
              Pré-visualizar como aluno
            </button>
            {archived ? null : (
              <button
                className="gk-btn gk-btn--primary"
                disabled={pending}
                name="intent"
                type="submit"
                value={live ? "save" : "publish"}
              >
                {live ? "Salvar alterações" : "Publicar"}
              </button>
            )}
          </div>
        </header>

        {state.error ? (
          <p className="gk-error-box" role="alert">
            <GestaoIcon name="alert-circle" size={16} /> {state.error}
          </p>
        ) : null}

        <div className="gk-cols gk-cols--editor">
          <div className="gk-stack">
            <MeetingCard
              description={description}
              joinUrl={joinUrl}
              onChange={change(setSchedule)}
              onDescription={change(setDescription)}
              onJoinUrl={change(setJoinUrl)}
              onTitle={change(setTitle)}
              schedule={schedule}
              title={title}
            />
            <RelatedCard
              activities={activities}
              courses={courses}
              libraryItems={libraryItems}
              onChange={change(setRelated)}
              related={related}
            />
            <ParticipantsCard
              audience={audience}
              cohorts={cohorts}
              onChange={change(setAudience)}
            />
          </div>
          <aside className="gk-stack">
            <PublicationCard
              meeting={meeting}
              onChange={change(setPublication)}
              pending={pending}
              publication={publication}
            />
            <AfterCard
              meeting={meeting}
              onAttendance={() => setAttending(true)}
              onRecording={change(setRecordingUrl)}
              recordingUrl={recordingUrl}
            />
          </aside>
        </div>
      </form>
      {previewing ? (
        <PreviewDialog
          description={description}
          onClose={() => setPreviewing(false)}
          schedule={schedule}
          title={title}
        />
      ) : null}
      {attending && meeting ? (
        <MeetingAttendanceDialog
          attendees={attendees}
          meetingId={meeting.id}
          onClose={() => setAttending(false)}
        />
      ) : null}
    </>
  );
};
