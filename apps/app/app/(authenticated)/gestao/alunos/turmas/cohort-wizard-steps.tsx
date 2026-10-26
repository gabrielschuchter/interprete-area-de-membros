"use client";

import { useState } from "react";
import { GestaoIcon } from "../../gestao-icon";
import {
  type CourseOption,
  initialsOf,
  type LateJoin,
  parseEmails,
  type ReleaseMode,
  type StudentMode,
  type TeacherOption,
  type WizardDraft,
  type WizardErrors,
} from "./cohort-wizard-model";

export const stepLabels = ["Dados", "Conteúdo", "Pessoas"] as const;

type Patch = (change: Partial<WizardDraft>) => void;

const stepState = (index: number, current: number) => {
  if (index < current) {
    return "done";
  }
  return index === current ? "current" : "todo";
};

export const Stepper = ({ current }: { readonly current: number }) => (
  <ol aria-label="Passos" className="gk-steps">
    {stepLabels.map((label, index) => (
      <li
        aria-current={index === current ? "step" : undefined}
        data-state={stepState(index, current)}
        key={label}
      >
        <span className="gk-step-dot">
          {index < current ? (
            <GestaoIcon name="check" size={14} strokeWidth={2} />
          ) : (
            index + 1
          )}
        </span>
        <span className="gk-step-label">{label}</span>
        {index < stepLabels.length - 1 ? (
          <span aria-hidden="true" className="gk-step-line" />
        ) : null}
      </li>
    ))}
  </ol>
);

const Segmented = <T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: T) => void;
  readonly options: readonly (readonly [T, string])[];
  readonly value: T;
}) => (
  <fieldset className="gk-segmented">
    <legend className="sr-only">{label}</legend>
    {options.map(([option, text]) => (
      <button
        aria-pressed={value === option}
        key={option}
        onClick={() => onChange(option)}
        type="button"
      >
        {text}
      </button>
    ))}
  </fieldset>
);

const FieldError = ({ message }: { readonly message?: string }) =>
  message ? <small className="gk-error">{message}</small> : null;

export const DataStep = ({
  draft,
  errors,
  patch,
}: {
  readonly draft: WizardDraft;
  readonly errors: WizardErrors;
  readonly patch: Patch;
}) => (
  <div className="gk-form-stack">
    <label className="gk-label">
      <span>Nome da turma</span>
      <input
        autoComplete="off"
        className="gk-input"
        id="cohort-wizard-first"
        maxLength={120}
        onChange={(event) => patch({ name: event.target.value })}
        placeholder="Ex.: Mentoria de clínica"
        value={draft.name}
      />
      <FieldError message={errors.name} />
    </label>
    <div className="gk-form-grid">
      <label className="gk-label">
        <span>Começa em</span>
        <input
          className="gk-input"
          onChange={(event) => patch({ startsAt: event.target.value })}
          type="date"
          value={draft.startsAt}
        />
        <FieldError message={errors.startsAt} />
      </label>
      <label className="gk-label">
        <span>
          Termina em <em>opcional</em>
        </span>
        <input
          className="gk-input"
          onChange={(event) => patch({ endsAt: event.target.value })}
          type="date"
          value={draft.endsAt}
        />
        <FieldError message={errors.endsAt} />
      </label>
    </div>
  </div>
);

const releaseHints: Record<ReleaseMode, string> = {
  ALL_AT_ONCE: "Todas as aulas ficam disponíveis assim que o aluno entra.",
  SCHEDULE:
    "As aulas são liberadas por data no cronograma, a partir do início da turma.",
};

export const ContentStep = ({
  courses,
  draft,
  patch,
}: {
  readonly courses: readonly CourseOption[];
  readonly draft: WizardDraft;
  readonly patch: Patch;
}) => {
  const toggle = (id: string, checked: boolean) =>
    patch({
      courseIds: checked
        ? [...draft.courseIds, id]
        : draft.courseIds.filter((value) => value !== id),
    });
  return (
    <div className="gk-form-stack">
      <div className="gk-label">
        <span>Cursos liberados para a turma</span>
        {courses.length ? (
          <div className="gk-check-list">
            {courses.map((course) => (
              <label className="gk-check" key={course.id}>
                <input
                  checked={draft.courseIds.includes(course.id)}
                  onChange={(event) => toggle(course.id, event.target.checked)}
                  type="checkbox"
                />
                <span>{course.title}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="gk-hint">
            Ainda não há cursos publicados. Você pode liberar depois, na aba
            Conteúdo da turma.
          </p>
        )}
      </div>
      {draft.courseIds.length > 0 ? (
        <div className="gk-label">
          <span>Como liberar</span>
          <Segmented<ReleaseMode>
            label="Como liberar"
            onChange={(releaseMode) => patch({ releaseMode })}
            options={[
              ["ALL_AT_ONCE", "Tudo de uma vez"],
              ["SCHEDULE", "Por cronograma"],
            ]}
            value={draft.releaseMode}
          />
          <small className="gk-hint">{releaseHints[draft.releaseMode]}</small>
        </div>
      ) : (
        <p className="gk-hint">
          Passo opcional: sem cursos, a turma é criada vazia e você libera o
          conteúdo depois.
        </p>
      )}
    </div>
  );
};

const TeacherPicker = ({
  actorName,
  draft,
  errors,
  isAdmin,
  patch,
  teachers,
}: {
  readonly actorName: string;
  readonly draft: WizardDraft;
  readonly errors: WizardErrors;
  readonly isAdmin: boolean;
  readonly patch: Patch;
  readonly teachers: readonly TeacherOption[];
}) => {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  const suggestions = teachers
    .filter(
      (teacher) =>
        !draft.teacherIds.includes(teacher.id) &&
        `${teacher.displayName ?? ""} ${teacher.email ?? ""}`
          .toLocaleLowerCase("pt-BR")
          .includes(needle)
    )
    .slice(0, 6);
  const nameOf = (id: string) =>
    teachers.find((teacher) => teacher.id === id)?.displayName ?? actorName;
  return (
    <div className="gk-label">
      <span>Professores responsáveis</span>
      <div className="gk-chip-input">
        {draft.teacherIds.map((id) => (
          <span className="gk-person-chip" key={id}>
            <span aria-hidden="true" className="gk-person-dot">
              {initialsOf(nameOf(id))}
            </span>
            {nameOf(id)}
            {isAdmin ? (
              <button
                aria-label={`Remover ${nameOf(id)}`}
                onClick={() =>
                  patch({
                    teacherIds: draft.teacherIds.filter(
                      (value) => value !== id
                    ),
                  })
                }
                type="button"
              >
                <GestaoIcon name="x" size={14} />
              </button>
            ) : null}
          </span>
        ))}
        {isAdmin ? (
          <span className="gk-chip-input-field">
            <input
              aria-label="Adicionar professor"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Adicionar professor…"
              value={query}
            />
            {needle && suggestions.length ? (
              <ul className="gk-suggest">
                {suggestions.map((teacher) => (
                  <li key={teacher.id}>
                    <button
                      onClick={() => {
                        patch({
                          teacherIds: [...draft.teacherIds, teacher.id],
                        });
                        setQuery("");
                      }}
                      type="button"
                    >
                      {teacher.displayName ?? "Professor"}
                      <small>{teacher.email}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </span>
        ) : null}
      </div>
      <small className="gk-hint">
        Só os responsáveis veem e gerenciam esta turma. Administradores veem
        todas.
      </small>
      <FieldError message={errors.teachers} />
    </div>
  );
};

const StudentSource = ({
  draft,
  errors,
  patch,
}: {
  readonly draft: WizardDraft;
  readonly errors: WizardErrors;
  readonly patch: Patch;
}) => {
  const onFile = async (file: File | undefined) => {
    if (!file) {
      patch({ csv: null, csvName: "" });
      return;
    }
    patch({
      csv: parseEmails((await file.text()).slice(0, 1_000_000)),
      csvName: file.name,
    });
  };
  const { csv } = draft;
  return (
    <div className="gk-label">
      <span>Alunos</span>
      <Segmented<StudentMode>
        label="Como adicionar alunos"
        onChange={(studentMode) => patch({ studentMode })}
        options={[
          ["later", "Adicionar depois"],
          ["csv", "Importar planilha"],
          ["invite", "Convidar por link"],
        ]}
        value={draft.studentMode}
      />
      {draft.studentMode === "csv" ? (
        <div className="gk-upload">
          <label className="gk-btn gk-btn--sm gk-btn--plain">
            <GestaoIcon name="upload" size={16} />
            {draft.csvName || "Selecionar arquivo CSV"}
            <input
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => onFile(event.target.files?.[0])}
              type="file"
            />
          </label>
          <small className="gk-hint">
            {csv
              ? `${csv.emails.length} e-mail(s) válido(s) em ${csv.rows} linha(s)${
                  csv.invalid ? `; ${csv.invalid} ignorada(s)` : ""
                }. Entram na hora os e-mails que já têm conta de aluno; os demais você convida por link depois.`
              : "CSV com uma coluna email. O arquivo é lido no navegador."}
          </small>
          <FieldError message={errors.csv} />
        </div>
      ) : null}
      {draft.studentMode === "invite" ? (
        <small className="gk-hint">
          Ao criar, geramos um link válido por 14 dias para até 100 alunos. Você
          o copia na lista de alunos da turma.
        </small>
      ) : null}
    </div>
  );
};

const lateJoinOptions: readonly (readonly [LateJoin, string, string])[] = [
  [
    "ALL_ACTIVE",
    "Recebe tudo que está ativo na turma",
    "Recomendado: o aluno entra e vê o mesmo que os colegas.",
  ],
  [
    "FROM_JOIN",
    "Recebe só o que for publicado a partir da entrada",
    "O que já passou fica fora.",
  ],
];

const LateJoinChoice = ({
  draft,
  patch,
}: {
  readonly draft: WizardDraft;
  readonly patch: Patch;
}) => (
  <fieldset className="gk-label gk-fieldset">
    <legend>Para quem entrar depois</legend>
    <div className="gk-radio-list">
      {lateJoinOptions.map(([value, title, hint]) => (
        <label
          className="gk-radio"
          data-checked={String(draft.lateJoin === value)}
          key={value}
        >
          <input
            checked={draft.lateJoin === value}
            name="lateJoin"
            onChange={() => patch({ lateJoin: value })}
            type="radio"
          />
          <span>
            {title}
            <small>{hint}</small>
          </span>
        </label>
      ))}
    </div>
  </fieldset>
);

export const PeopleStep = ({
  actorName,
  draft,
  errors,
  isAdmin,
  patch,
  teachers,
}: {
  readonly actorName: string;
  readonly draft: WizardDraft;
  readonly errors: WizardErrors;
  readonly isAdmin: boolean;
  readonly patch: Patch;
  readonly teachers: readonly TeacherOption[];
}) => (
  <div className="gk-form-stack">
    <TeacherPicker
      actorName={actorName}
      draft={draft}
      errors={errors}
      isAdmin={isAdmin}
      patch={patch}
      teachers={teachers}
    />
    <StudentSource draft={draft} errors={errors} patch={patch} />
    <LateJoinChoice draft={draft} patch={patch} />
  </div>
);
