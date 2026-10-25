"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useEffect, useMemo, useState } from "react";
import {
  findMissingExerciseExplanationOptionReferences,
  validateExerciseDraft,
} from "@/lib/exercise-engine";
import { saveExerciseQuestion } from "../../../../../../exercicios/actions";
import { GestaoIcon } from "../../../../../gestao-icon";

export type QuestionFormat = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";

export interface EditorOption {
  readonly content: string;
  readonly correct: boolean;
}

export interface EditorReference {
  readonly href: string | null;
  readonly label: string;
}

export interface LibraryChoice {
  readonly id: string;
  readonly title: string;
  readonly url: string;
}

interface Properties {
  readonly categories: readonly string[];
  readonly category: string;
  readonly explanation: string;
  readonly format: QuestionFormat;
  readonly library: readonly LibraryChoice[];
  readonly listId: string;
  readonly options: readonly EditorOption[];
  readonly questionId: string | null;
  readonly references: readonly EditorReference[];
  readonly returnTo: string;
  readonly statement: string;
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | null;
  readonly subtitle: string;
  readonly tags: readonly string[];
  readonly versionBlock: React.ReactNode;
}

const letters = ["A", "B", "C", "D", "E"] as const;
const maxOptions = letters.length;
const trueFalse: readonly EditorOption[] = [
  { content: "Verdadeiro", correct: true },
  { content: "Falso", correct: false },
];
const formatNames: Record<QuestionFormat, string> = {
  MULTIPLE_CHOICE: "Múltipla escolha",
  SINGLE_CHOICE: "Escolha única",
  TRUE_FALSE: "Verdadeiro ou falso",
};
const formatOrder: readonly QuestionFormat[] = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
];
const statusNames = {
  ARCHIVED: "Arquivado",
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
} as const;
const newCategoryValue = "__nova__";

const referenceLine = (reference: EditorReference) =>
  reference.href ? `${reference.label} — ${reference.href}` : reference.label;

const Field = ({
  children,
  hint,
  id,
  label,
}: {
  readonly children: React.ReactNode;
  readonly hint?: string;
  readonly id: string;
  readonly label: string;
}) => (
  <div className="gk-label">
    <label htmlFor={id}>{label}</label>
    {children}
    {hint ? <small className="gk-hint">{hint}</small> : null}
  </div>
);

const OptionsEditor = ({
  format,
  onChange,
  options,
}: {
  readonly format: QuestionFormat;
  readonly onChange: (next: readonly EditorOption[]) => void;
  readonly options: readonly EditorOption[];
}) => {
  const fixed = format === "TRUE_FALSE";
  const multiple = format === "MULTIPLE_CHOICE";
  const update = (index: number, patch: Partial<EditorOption>) =>
    onChange(
      options.map((option, position) => {
        if (position === index) {
          return { ...option, ...patch };
        }
        return multiple || patch.correct === undefined
          ? option
          : { ...option, correct: false };
      })
    );
  return (
    <fieldset className="gk-options">
      <legend>Alternativas e gabarito</legend>
      {options.map((option, index) => (
        <div
          className="gk-option-row"
          data-correct={option.correct}
          key={letters[index]}
        >
          <span className="gk-option-letter">{letters[index]}</span>
          <input
            aria-label={`Texto da alternativa ${letters[index]}`}
            className="gk-input"
            maxLength={8000}
            name={`option-${letters[index]}`}
            onChange={(event) => update(index, { content: event.target.value })}
            readOnly={fixed}
            value={option.content}
          />
          <label className="gk-correct">
            <input
              checked={option.correct}
              name="correctOption"
              onChange={(event) =>
                update(index, { correct: event.target.checked || !multiple })
              }
              type={multiple ? "checkbox" : "radio"}
              value={letters[index]}
            />
            Correta
          </label>
          {fixed ? (
            <span className="gk-option-spacer" />
          ) : (
            <button
              aria-label={`Remover alternativa ${letters[index]}`}
              className="gk-icon-btn gk-icon-btn--bare"
              disabled={options.length <= 2}
              onClick={() =>
                onChange(options.filter((_, position) => position !== index))
              }
              type="button"
            >
              <GestaoIcon name="trash" size={16} />
            </button>
          )}
        </div>
      ))}
      {fixed || options.length >= maxOptions ? null : (
        <button
          className="gk-course-add"
          onClick={() =>
            onChange([...options, { content: "", correct: false }])
          }
          type="button"
        >
          <GestaoIcon name="plus" size={16} /> Adicionar alternativa
        </button>
      )}
    </fieldset>
  );
};

const FormatSwitch = ({
  format,
  onChange,
}: {
  readonly format: QuestionFormat;
  readonly onChange: (next: QuestionFormat) => void;
}) => (
  <fieldset className="gk-fmt">
    <legend>Formato</legend>
    <div>
      {formatOrder.map((key) => (
        <label data-active={format === key} key={key}>
          <input
            checked={format === key}
            name="formatChoice"
            onChange={() => onChange(key)}
            type="radio"
            value={key}
          />
          {formatNames[key]}
        </label>
      ))}
    </div>
  </fieldset>
);

const ReferencePicker = ({
  library,
  onClose,
  onPick,
  taken,
}: {
  readonly library: readonly LibraryChoice[];
  readonly onClose: () => void;
  readonly onPick: (reference: EditorReference) => void;
  readonly taken: ReadonlySet<string>;
}) => {
  const [term, setTerm] = useState("");
  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return library
      .filter((item) => !needle || item.title.toLowerCase().includes(needle))
      .slice(0, 40);
  }, [library, term]);
  return (
    <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
      <DialogContent
        className="gk-modal"
        overlayClassName="gk-modal-overlay"
        showCloseButton={false}
      >
        <div className="gk-modal-head">
          <div>
            <DialogTitle className="gk-modal-title">
              Adicionar referência
            </DialogTitle>
            <DialogDescription className="gk-modal-sub">
              Escolha entre os itens publicados da Biblioteca. O aluno vê o
              título com o link depois de responder.
            </DialogDescription>
          </div>
          <button
            aria-label="Fechar"
            className="gk-modal-close"
            onClick={onClose}
            type="button"
          >
            <GestaoIcon name="x" size={18} />
          </button>
        </div>
        <div className="gk-modal-body">
          <span className="gk-field gk-field--full">
            <GestaoIcon name="search" size={16} />
            <input
              aria-label="Buscar na Biblioteca"
              autoFocus
              className="gk-input"
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Buscar na Biblioteca"
              type="search"
              value={term}
            />
          </span>
        </div>
        <ul className="gk-pick-list gk-pick-list--questions">
          {visible.length === 0 ? (
            <li className="gk-empty-cell">
              Nenhum item publicado corresponde. Cadastre a fonte na Biblioteca
              e volte aqui.
            </li>
          ) : (
            visible.map((item) => (
              <li key={item.id}>
                <button
                  className="gk-pick-row"
                  disabled={taken.has(item.url)}
                  onClick={() => {
                    onPick({ href: item.url, label: item.title });
                    onClose();
                  }}
                  type="button"
                >
                  <strong>{item.title}</strong>
                  <small>
                    {taken.has(item.url) ? "Já adicionada" : item.url}
                  </small>
                </button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
};

const ReferencesCard = ({
  library,
  onChange,
  references,
}: {
  readonly library: readonly LibraryChoice[];
  readonly onChange: (next: readonly EditorReference[]) => void;
  readonly references: readonly EditorReference[];
}) => {
  const [picking, setPicking] = useState(false);
  const taken = useMemo(
    () => new Set(references.flatMap((item) => (item.href ? [item.href] : []))),
    [references]
  );
  return (
    <section className="gk-card gk-card--wide">
      <header className="gk-card-head">
        <h2>Referências</h2>
        <button
          className="gk-edit-link"
          onClick={() => setPicking(true)}
          type="button"
        >
          <GestaoIcon name="plus" size={14} /> Adicionar referência
        </button>
      </header>
      {references.length ? (
        <ul className="gk-chips">
          {references.map((reference) => (
            <li key={referenceLine(reference)}>
              <GestaoIcon name="book" size={13} />
              {reference.label}
              <button
                aria-label={`Remover referência ${reference.label}`}
                onClick={() =>
                  onChange(references.filter((item) => item !== reference))
                }
                type="button"
              >
                <GestaoIcon name="x" size={12} />
              </button>
              <input
                name="reference"
                type="hidden"
                value={referenceLine(reference)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="gk-hint">Nenhuma referência adicionada.</p>
      )}
      <p className="gk-hint">
        Escolha entre as referências já cadastradas na Biblioteca. Para uma
        nova, cadastre-a na Biblioteca e volte aqui.
      </p>
      {picking ? (
        <ReferencePicker
          library={library}
          onClose={() => setPicking(false)}
          onPick={(reference) => onChange([...references, reference])}
          taken={taken}
        />
      ) : null}
    </section>
  );
};

const TagsInput = ({
  onChange,
  tags,
}: {
  readonly onChange: (next: readonly string[]) => void;
  readonly tags: readonly string[];
}) => {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const next = draft.trim().toLowerCase().replace(/,/g, "");
    if (next && !tags.includes(next) && tags.length < 20) {
      onChange([...tags, next]);
    }
    setDraft("");
  };
  return (
    <div className="gk-tags">
      {tags.map((tag) => (
        <span className="gk-tag" key={tag}>
          {tag}
          <button
            aria-label={`Remover etiqueta ${tag}`}
            onClick={() => onChange(tags.filter((item) => item !== tag))}
            type="button"
          >
            <GestaoIcon name="x" size={11} />
          </button>
        </span>
      ))}
      <input
        aria-label="Adicionar etiqueta"
        maxLength={40}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commit();
          }
        }}
        placeholder="Adicionar…"
        value={draft}
      />
      <input name="tags" type="hidden" value={tags.join(",")} />
    </div>
  );
};

const CategoryField = ({
  categories,
  onChange,
  value,
}: {
  readonly categories: readonly string[];
  readonly onChange: (next: string) => void;
  readonly value: string;
}) => {
  const [creating, setCreating] = useState(false);
  const known = categories.includes(value) || !value;
  return (
    <>
      <span className="gk-field gk-field--full">
        <select
          aria-label="Categoria"
          className="gk-select gk-select--plain"
          id="question-category"
          onChange={(event) => {
            const next = event.target.value;
            setCreating(next === newCategoryValue);
            onChange(next === newCategoryValue ? "" : next);
          }}
          value={creating || !known ? newCategoryValue : value}
        >
          <option value="">Sem categoria</option>
          {categories.map((title) => (
            <option key={title} value={title}>
              {title}
            </option>
          ))}
          <option value={newCategoryValue}>Nova categoria…</option>
        </select>
        <GestaoIcon
          className="gk-select-caret"
          name="chevron-down"
          size={14}
          strokeWidth={1.8}
        />
      </span>
      {creating || !known ? (
        <input
          aria-label="Nome da nova categoria"
          autoFocus
          className="gk-input"
          maxLength={100}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Nome da categoria"
          value={value}
        />
      ) : null}
      <input name="categoryTitle" type="hidden" value={value} />
    </>
  );
};

const PreviewDialog = ({
  explanation,
  onClose,
  options,
  references,
  statement,
}: {
  readonly explanation: string;
  readonly onClose: () => void;
  readonly options: readonly EditorOption[];
  readonly references: readonly EditorReference[];
  readonly statement: string;
}) => (
  <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
    <DialogContent
      className="gk-modal"
      overlayClassName="gk-modal-overlay"
      showCloseButton={false}
    >
      <div className="gk-modal-head">
        <div>
          <DialogTitle className="gk-modal-title">Como o aluno vê</DialogTitle>
          <DialogDescription className="gk-modal-sub">
            Prévia do enunciado, das alternativas e da explicação depois da
            resposta. Nada é salvo.
          </DialogDescription>
        </div>
        <button
          aria-label="Fechar"
          className="gk-modal-close"
          onClick={onClose}
          type="button"
        >
          <GestaoIcon name="x" size={18} />
        </button>
      </div>
      <div className="gk-modal-body gk-preview">
        <p className="gk-preview-statement">
          {statement || "O enunciado aparece aqui."}
        </p>
        <ul>
          {options.map((option, index) => (
            <li key={letters[index]}>
              <span>{letters[index]}</span>
              {option.content || "Alternativa em branco"}
            </li>
          ))}
        </ul>
        {explanation || references.length ? (
          <div className="gk-preview-explanation">
            <strong>Explicação</strong>
            {explanation ? <p>{explanation}</p> : null}
            {references.map((reference) => (
              <small key={referenceLine(reference)}>
                Referência: {reference.label}
              </small>
            ))}
          </div>
        ) : null}
      </div>
    </DialogContent>
  </Dialog>
);

export const QuestionEditorForm = (props: Properties) => {
  const [statement, setStatement] = useState(props.statement);
  const [format, setFormat] = useState(props.format);
  const [options, setOptions] = useState(props.options);
  const [explanation, setExplanation] = useState(props.explanation);
  const [references, setReferences] = useState(props.references);
  const [category, setCategory] = useState(props.category);
  const [tags, setTags] = useState(props.tags);
  const [dirty, setDirty] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const touch =
    <T,>(setter: (value: T) => void) =>
    (next: T) => {
      setDirty(true);
      setter(next);
    };
  const changeFormat = (next: QuestionFormat) => {
    setDirty(true);
    setFormat(next);
    if (next === "TRUE_FALSE") {
      setOptions(trueFalse);
      return;
    }
    if (next === "SINGLE_CHOICE") {
      let seen = false;
      setOptions((current) =>
        (format === "TRUE_FALSE" ? blankOptions() : current).map((option) => {
          const keep = option.correct && !seen;
          seen = seen || option.correct;
          return { ...option, correct: keep };
        })
      );
      return;
    }
    setOptions((current) =>
      format === "TRUE_FALSE" ? blankOptions() : current
    );
  };

  const published = props.status === "PUBLISHED";
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Enter em campos de texto não deve publicar a questão
    <form
      action={saveExerciseQuestion}
      className="gk-qeditor"
      onChange={() => setDirty(true)}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          event.target instanceof HTMLInputElement &&
          event.target.type !== "submit"
        ) {
          event.preventDefault();
        }
      }}
      onSubmit={(event) => {
        const reason = checkDraft(format, statement, explanation, options);
        setProblem(reason);
        if (reason) {
          event.preventDefault();
          return;
        }
        setDirty(false);
      }}
    >
      <input name="gestaoReturn" type="hidden" value="GESTAO" />
      <input name="listId" type="hidden" value={props.listId} />
      <input name="returnTo" type="hidden" value={props.returnTo} />
      {props.questionId ? (
        <input name="questionId" type="hidden" value={props.questionId} />
      ) : null}
      <input
        name="questionType"
        type="hidden"
        value={
          format === "MULTIPLE_CHOICE" ? "MULTIPLE_CHOICE" : "SINGLE_CHOICE"
        }
      />
      <header className="gk-head gk-head--editor">
        <div className="gk-head-copy">
          <h1>{props.questionId ? "Editar questão" : "Nova questão"}</h1>
          <p>{props.subtitle}</p>
        </div>
        <div className="gk-head-actions">
          <span className="gk-savestate" data-dirty={dirty}>
            <GestaoIcon name="check" size={14} />
            {dirty ? "Alterações não salvas" : "Tudo salvo"}
          </span>
          <button
            className="gk-btn"
            onClick={() => setPreviewing(true)}
            type="button"
          >
            Pré-visualizar como aluno
          </button>
          <button
            className="gk-btn gk-btn--primary"
            name="saveMode"
            type="submit"
            value="publish"
          >
            Publicar nova versão
          </button>
        </div>
      </header>
      {problem ? (
        <p className="gk-error-box" role="alert">
          {problem}
        </p>
      ) : null}
      <div className="gk-cols gk-cols--editor">
        <div className="gk-stack">
          <section className="gk-card gk-card--wide">
            <h2>Questão</h2>
            <Field id="question-statement" label="Enunciado *">
              <textarea
                className="gk-input gk-textarea"
                id="question-statement"
                maxLength={20_000}
                minLength={5}
                name="statement"
                onChange={(event) => setStatement(event.target.value)}
                required
                rows={6}
                value={statement}
              />
            </Field>
            <FormatSwitch format={format} onChange={changeFormat} />
            <OptionsEditor
              format={format}
              onChange={touch(setOptions)}
              options={options}
            />
            <Field
              hint="Aparece para o aluno depois de responder."
              id="question-explanation"
              label="Explicação (aparece depois da resposta)"
            >
              <textarea
                className="gk-input gk-textarea"
                id="question-explanation"
                maxLength={20_000}
                name="explanation"
                onChange={(event) => setExplanation(event.target.value)}
                rows={5}
                value={explanation}
              />
            </Field>
          </section>
          <ReferencesCard
            library={props.library}
            onChange={touch(setReferences)}
            references={references}
          />
        </div>
        <aside className="gk-stack">
          <section className="gk-card">
            <header className="gk-card-head">
              <h2>Publicação</h2>
              {props.status ? (
                <span
                  className="gk-chip"
                  data-tone={published ? "active" : "neutral"}
                >
                  {statusNames[props.status]}
                </span>
              ) : null}
            </header>
            <p className="gk-hint">
              Alterar uma questão já respondida cria uma{" "}
              <strong>nova versão</strong>. As tentativas antigas continuam
              ligadas à versão em que foram feitas.
            </p>
            <button
              className="gk-btn gk-btn--primary"
              name="saveMode"
              type="submit"
              value="publish"
            >
              Publicar nova versão
            </button>
            <button
              className="gk-btn"
              name="saveMode"
              type="submit"
              value="draft"
            >
              Salvar rascunho
            </button>
            <p className="gk-hint">
              {published
                ? "Salvar como rascunho retira a questão dos alunos até você publicar de novo."
                : "Nada aparece para os alunos antes de você publicar."}
            </p>
          </section>
          <section className="gk-card">
            <h2>Classificação</h2>
            <div className="gk-label">
              <label htmlFor="question-category">Categoria</label>
              <CategoryField
                categories={props.categories}
                onChange={touch(setCategory)}
                value={category}
              />
            </div>
            <div className="gk-label">
              <span>Etiquetas</span>
              <TagsInput onChange={touch(setTags)} tags={tags} />
            </div>
          </section>
          {props.versionBlock}
        </aside>
      </div>
      {previewing ? (
        <PreviewDialog
          explanation={explanation}
          onClose={() => setPreviewing(false)}
          options={options}
          references={references}
          statement={statement}
        />
      ) : null}
    </form>
  );
};

const checkDraft = (
  format: QuestionFormat,
  statement: string,
  explanation: string,
  options: readonly EditorOption[]
) => {
  const drafts = options.flatMap((option, index) =>
    option.content.trim()
      ? [
          {
            content: option.content.trim(),
            correct: option.correct,
            id: letters[index] as string,
          },
        ]
      : []
  );
  const kind = format === "MULTIPLE_CHOICE" ? format : "SINGLE_CHOICE";
  const validation = validateExerciseDraft(kind, statement, drafts);
  if (!validation.valid) {
    return validation.reason;
  }
  const missing = findMissingExerciseExplanationOptionReferences(
    explanation,
    drafts
  );
  return missing.length
    ? `A explicação cita ${missing.join(", ")}, que não tem alternativa preenchida.`
    : null;
};

const blankOptions = (): readonly EditorOption[] =>
  Array.from({ length: 4 }, () => ({ content: "", correct: false }));
