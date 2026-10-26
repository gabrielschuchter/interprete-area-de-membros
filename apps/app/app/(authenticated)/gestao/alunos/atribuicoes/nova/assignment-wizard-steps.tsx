"use client";

import { useEffect, useRef, useState } from "react";
import { GestaoIcon } from "../../../gestao-icon";

export interface ContentOption {
  readonly id: string;
  readonly label: string;
  readonly meta: string;
  readonly type: string;
}

export interface CohortOption {
  readonly id: string;
  readonly name: string;
  readonly students: number;
}

export interface StudentOption {
  readonly id: string;
  readonly name: string;
}

export type AudienceMode = "both" | "cohorts" | "students";

export const contentKey = (option: Pick<ContentOption, "id" | "type">) =>
  `${option.type}:${option.id}`;

const typeFilters = [
  ["", "Todos os tipos"],
  ["ACTIVITY", "Atividade"],
  ["COURSE", "Curso"],
  ["LESSON", "Aula"],
  ["LIBRARY_ITEM", "Biblioteca"],
  ["EXERCISE_LIST", "Lista de exercícios"],
] as const;

const whitespace = /\s+/;

const initials = (name: string) =>
  name
    .split(whitespace)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export const ContentStep = ({
  content,
  onSelect,
  selected,
}: {
  readonly content: readonly ContentOption[];
  readonly onSelect: (option: ContentOption) => void;
  readonly selected: string;
}) => {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = content.filter(
    (option) =>
      (!type || option.type === type) &&
      (!needle || option.label.toLowerCase().includes(needle))
  );
  return (
    <div className="gk-form-stack">
      <h2 className="gk-wiz-title">O que você quer atribuir?</h2>
      <div className="gk-toolbar-group">
        <label className="gk-field gk-field--grow">
          <GestaoIcon name="search" size={16} />
          <input
            aria-label="Buscar conteúdo publicado"
            className="gk-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar conteúdo publicado"
            value={query}
          />
        </label>
        <select
          aria-label="Tipo de conteúdo"
          className="gk-select"
          onChange={(event) => setType(event.target.value)}
          value={type}
        >
          {typeFilters.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="gk-contentlist">
        <legend className="sr-only">Conteúdo publicado</legend>
        {visible.length ? (
          visible.slice(0, 120).map((option) => (
            <label
              data-selected={selected === contentKey(option)}
              key={contentKey(option)}
            >
              <input
                checked={selected === contentKey(option)}
                name="content-choice"
                onChange={() => onSelect(option)}
                type="radio"
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.meta}</small>
              </span>
            </label>
          ))
        ) : (
          <p className="gk-hint">
            Nenhum conteúdo publicado corresponde à busca.
          </p>
        )}
      </fieldset>
      {visible.length > 120 ? (
        <p className="gk-hint">
          Mostrando 120 de {visible.length}. Refine a busca para ver os demais.
        </p>
      ) : null}
    </div>
  );
};

const modeOptions: readonly (readonly [AudienceMode, string])[] = [
  ["cohorts", "Turmas"],
  ["students", "Alunos individuais"],
  ["both", "Turmas e individuais"],
];

const placeholders: Record<AudienceMode, string> = {
  both: "Adicionar turma ou aluno…",
  cohorts: "Adicionar turma…",
  students: "Adicionar aluno…",
};

interface SearchItem {
  readonly displayName: string;
  readonly id: string;
}

const useStudentSearch = (query: string, enabled: boolean) => {
  const [items, setItems] = useState<readonly SearchItem[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const term = query.trim();
    if (!enabled || term.length < 2) {
      setItems([]);
      setFailed(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/assignment-recipients?q=${encodeURIComponent(term)}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          setFailed(true);
          return;
        }
        const body = (await response.json()) as {
          items?: readonly SearchItem[];
        };
        setFailed(false);
        setItems(body.items ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setFailed(true);
        }
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, enabled]);
  return { failed, items };
};

const AudiencePickMenu = ({
  cohortMatches,
  failed,
  onCohort,
  onStudent,
  query,
  showCohorts,
  showStudents,
  studentMatches,
}: {
  readonly cohortMatches: readonly CohortOption[];
  readonly failed: boolean;
  readonly onCohort: (id: string) => void;
  readonly onStudent: (student: StudentOption) => void;
  readonly query: string;
  readonly showCohorts: boolean;
  readonly showStudents: boolean;
  readonly studentMatches: readonly SearchItem[];
}) => {
  const searched = query.trim().length >= 2;
  return (
    <div className="gk-pickmenu" id="assignment-audience-menu">
      {showCohorts ? (
        <>
          <p className="gk-pickmenu-group">Turmas</p>
          {cohortMatches.length ? (
            cohortMatches.map((cohort) => (
              <button
                className="gk-pickmenu-row"
                key={cohort.id}
                onClick={() => onCohort(cohort.id)}
                type="button"
              >
                <span aria-hidden="true" className="gk-kindtile">
                  <GestaoIcon name="users" size={16} />
                </span>
                <span>{cohort.name}</span>
                <small>
                  {cohort.students} {cohort.students === 1 ? "aluno" : "alunos"}
                </small>
              </button>
            ))
          ) : (
            <p className="gk-pickmenu-empty">Nenhuma turma disponível.</p>
          )}
        </>
      ) : null}
      {showStudents ? (
        <>
          <p className="gk-pickmenu-group">Alunos individuais</p>
          {searched ? null : (
            <p className="gk-pickmenu-empty">
              Digite ao menos 2 letras para buscar um aluno.
            </p>
          )}
          {failed ? (
            <p className="gk-pickmenu-empty" role="alert">
              Não foi possível buscar alunos agora. Tente novamente.
            </p>
          ) : null}
          {studentMatches.map((student) => (
            <button
              className="gk-pickmenu-row"
              key={student.id}
              onClick={() =>
                onStudent({ id: student.id, name: student.displayName })
              }
              type="button"
            >
              <span aria-hidden="true" className="gk-avatar gk-avatar--lg">
                {initials(student.displayName)}
              </span>
              <span>{student.displayName}</span>
            </button>
          ))}
          {searched && !failed && studentMatches.length === 0 ? (
            <p className="gk-pickmenu-empty">
              Nenhum aluno encontrado no seu escopo.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export const AudienceStep = ({
  cohorts,
  heading = "Quem vai receber?",
  mode,
  onCohorts,
  onMode,
  onStudents,
  selectedCohorts,
  selectedStudents,
}: {
  readonly cohorts: readonly CohortOption[];
  readonly heading?: string | null;
  readonly mode: AudienceMode;
  readonly onCohorts: (ids: readonly string[]) => void;
  readonly onMode: (mode: AudienceMode) => void;
  readonly onStudents: (students: readonly StudentOption[]) => void;
  readonly selectedCohorts: readonly string[];
  readonly selectedStudents: readonly StudentOption[];
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const showCohorts = mode !== "students";
  const showStudents = mode !== "cohorts";
  const search = useStudentSearch(query, showStudents && open);
  const needle = query.trim().toLowerCase();
  const cohortMatches = showCohorts
    ? cohorts.filter(
        (cohort) =>
          !selectedCohorts.includes(cohort.id) &&
          (!needle || cohort.name.toLowerCase().includes(needle))
      )
    : [];
  const studentMatches = search.items.filter(
    (item) => !selectedStudents.some((student) => student.id === item.id)
  );
  const cohortTotal = cohorts
    .filter((cohort) => selectedCohorts.includes(cohort.id))
    .reduce((sum, cohort) => sum + cohort.students, 0);
  const total = cohortTotal + selectedStudents.length;

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const changeMode = (next: AudienceMode) => {
    onMode(next);
    if (next === "students") {
      onCohorts([]);
    }
    if (next === "cohorts") {
      onStudents([]);
    }
  };

  return (
    <div className="gk-form-stack">
      {heading ? <h2 className="gk-wiz-title">{heading}</h2> : null}
      <div className="gk-label">
        <span>Para quem</span>
        <fieldset className="gk-segmented gk-segmented--full">
          <legend className="sr-only">Para quem</legend>
          {modeOptions.map(([value, label]) => (
            <button
              aria-pressed={mode === value}
              key={value}
              onClick={() => changeMode(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </fieldset>
      </div>
      <div className="gk-label" ref={box}>
        <label htmlFor="assignment-audience-input">Destinatários</label>
        <div className="gk-pickbox" data-open={open}>
          {cohorts
            .filter((cohort) => selectedCohorts.includes(cohort.id))
            .map((cohort) => (
              <span className="gk-pickchip gk-pickchip--cohort" key={cohort.id}>
                <GestaoIcon name="users" size={13} />
                {cohort.name} · {cohort.students}
                <button
                  aria-label={`Remover ${cohort.name}`}
                  onClick={() =>
                    onCohorts(selectedCohorts.filter((id) => id !== cohort.id))
                  }
                  type="button"
                >
                  <GestaoIcon name="x" size={12} />
                </button>
              </span>
            ))}
          {selectedStudents.map((student) => (
            <span className="gk-pickchip" key={student.id}>
              <span aria-hidden="true" className="gk-pickchip-avatar">
                {initials(student.name)}
              </span>
              {student.name}
              <button
                aria-label={`Remover ${student.name}`}
                onClick={() =>
                  onStudents(
                    selectedStudents.filter((s) => s.id !== student.id)
                  )
                }
                type="button"
              >
                <GestaoIcon name="x" size={12} />
              </button>
            </span>
          ))}
          <input
            aria-autocomplete="list"
            aria-controls="assignment-audience-menu"
            aria-expanded={open}
            autoComplete="off"
            id="assignment-audience-input"
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
              }
              if (event.key === "Enter") {
                event.preventDefault();
              }
            }}
            placeholder={placeholders[mode]}
            role="combobox"
            value={query}
          />
        </div>
        <small className="gk-hint">
          {total === 0 ? (
            "Escolha ao menos uma turma ou um aluno."
          ) : (
            <>
              <strong>
                {total} {total === 1 ? "destinatário" : "destinatários"}.
              </strong>{" "}
              A lista é registrada no envio: quem entrar nas turmas depois não
              recebe esta atribuição. Alunos repetidos contam uma vez.
            </>
          )}
        </small>
        {open ? (
          <AudiencePickMenu
            cohortMatches={cohortMatches}
            failed={search.failed}
            onCohort={(id) => {
              onCohorts([...selectedCohorts, id]);
              setQuery("");
            }}
            onStudent={(student) => {
              onStudents([...selectedStudents, student]);
              setQuery("");
            }}
            query={query}
            showCohorts={showCohorts}
            showStudents={showStudents}
            studentMatches={studentMatches}
          />
        ) : null}
      </div>
    </div>
  );
};

export interface TermsDraft {
  readonly availableAt: string;
  readonly dueAt: string;
  readonly expiresAt: string;
  readonly message: string;
}

export const TermsStep = ({
  draft,
  onChange,
}: {
  readonly draft: TermsDraft;
  readonly onChange: (patch: Partial<TermsDraft>) => void;
}) => (
  <div className="gk-form-stack">
    <h2 className="gk-wiz-title">Orientação e prazos</h2>
    <label className="gk-label">
      <span>
        Orientação <em>opcional</em>
      </span>
      <textarea
        className="gk-input gk-textarea"
        maxLength={1000}
        onChange={(event) => onChange({ message: event.target.value })}
        placeholder="Diga por que este conteúdo é relevante agora."
        rows={4}
        value={draft.message}
      />
      <small className="gk-hint">{draft.message.length}/1000</small>
    </label>
    <div className="gk-form-grid gk-form-grid--three">
      {(
        [
          ["availableAt", "Disponível em"],
          ["dueAt", "Prazo"],
          ["expiresAt", "Acesso até"],
        ] as const
      ).map(([key, label]) => (
        <label className="gk-label" key={key}>
          <span>
            {label} <em>opcional</em>
          </span>
          <input
            className="gk-input"
            onChange={(event) => onChange({ [key]: event.target.value })}
            type="datetime-local"
            value={draft[key]}
          />
        </label>
      ))}
    </div>
    <p className="gk-hint">
      Horários no fuso de Brasília. Sem “Disponível em”, o aluno vê a atribuição
      assim que ela for enviada.
    </p>
  </div>
);
