"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createGestaoLibraryItem,
  updateGestaoLibraryItem,
} from "@/app/(authenticated)/biblioteca/actions";
import { FormDirtyIndicator } from "@/app/(authenticated)/gestao/form-dirty-indicator";
import { GestaoCrumbTail } from "@/app/(authenticated)/gestao/gestao-crumbs";
import { GestaoIcon } from "@/app/(authenticated)/gestao/gestao-icon";
import type { getCourseOptions } from "@/lib/admin-learning";
import type { getGestaoLibraryItemForEdit } from "@/lib/gestao-library";
import {
  findGestaoLibraryDuplicate,
  type LibraryDuplicate,
} from "@/lib/gestao-library-actions";
import type { LibraryItemFormState } from "@/lib/gestao-library-form-domain";
import {
  type GestaoLibraryItemKind,
  gestaoLibraryItemKinds,
} from "@/lib/gestao-library-form-options";

type LibraryItem = NonNullable<
  Awaited<ReturnType<typeof getGestaoLibraryItemForEdit>>
>;
type CourseOptions = Awaited<ReturnType<typeof getCourseOptions>>;
type FieldErrors = LibraryItemFormState["fieldErrors"];
type SourceMode = "file" | "link" | "reference";

const kindLabels: Record<GestaoLibraryItemKind, string> = {
  ARTICLE: "Artigo",
  GUIDE: "Guia",
  LINK: "Link",
  PDF: "PDF",
  VIDEO: "Vídeo",
};

const sourceModes: readonly { key: SourceMode; label: string }[] = [
  { key: "link", label: "Link externo" },
  { key: "file", label: "Arquivo" },
  { key: "reference", label: "Referência bibliográfica" },
];

const defaultKinds: Record<SourceMode, GestaoLibraryItemKind> = {
  file: "PDF",
  link: "LINK",
  reference: "ARTICLE",
};

const languageOptions = [
  ["pt", "Português"],
  ["en", "Inglês"],
  ["es", "Espanhol"],
  ["pt,en", "Português e inglês"],
] as const;

const initialState: LibraryItemFormState = { status: "idle" };

const statusNames: Record<string, string> = {
  ARCHIVED: "Arquivado",
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
};

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const authorList = (value: string | null | undefined) =>
  value
    ? value
        .split(";")
        .map((author) => author.trim())
        .filter(Boolean)
    : [];

const Field = ({
  children,
  error,
  htmlFor,
  label,
}: {
  readonly children: ReactNode;
  readonly error?: string;
  readonly htmlFor: string;
  readonly label: string;
}) => (
  <div className="gk-label">
    <label htmlFor={htmlFor}>{label}</label>
    {children}
    {error ? (
      <small className="gk-error" id={`${htmlFor}-error`}>
        {error}
      </small>
    ) : null}
  </div>
);

const SelectShell = ({ children }: { readonly children: ReactNode }) => (
  <span className="gk-field gk-field--full">
    {children}
    <GestaoIcon
      className="gk-select-caret"
      name="chevron-down"
      size={14}
      strokeWidth={1.8}
    />
  </span>
);

const AuthorChips = ({
  authors,
  onChange,
}: {
  readonly authors: readonly string[];
  readonly onChange: (next: readonly string[]) => void;
}) => {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const next = draft.trim().replace(/;/g, ",");
    if (next && !authors.includes(next) && authors.length < 30) {
      onChange([...authors, next]);
    }
    setDraft("");
  };
  return (
    <div className="gk-tags">
      {authors.map((author) => (
        <span className="gk-tag" key={author}>
          {author}
          <button
            aria-label={`Remover autor ${author}`}
            onClick={() => onChange(authors.filter((item) => item !== author))}
            type="button"
          >
            <GestaoIcon name="x" size={11} />
          </button>
        </span>
      ))}
      <input
        aria-label="Adicionar autor"
        id="library-authors"
        maxLength={120}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ";") {
            event.preventDefault();
            commit();
          }
        }}
        placeholder={authors.length ? "Adicionar…" : "Sobrenome, A."}
        value={draft}
      />
      <input name="authors" type="hidden" value={authors.join("; ")} />
    </div>
  );
};

const SourceModeSwitch = ({
  mode,
  onChange,
}: {
  readonly mode: SourceMode;
  readonly onChange: (next: SourceMode) => void;
}) => (
  <fieldset className="gk-fmt">
    <legend>Como você vai cadastrar?</legend>
    <div>
      {sourceModes.map((option) => (
        <label data-active={mode === option.key} key={option.key}>
          <input
            checked={mode === option.key}
            name="sourceMode"
            onChange={() => onChange(option.key)}
            type="radio"
            value={option.key}
          />
          {option.label}
        </label>
      ))}
    </div>
  </fieldset>
);

const FileSource = ({
  error,
  item,
  onPick,
}: {
  readonly error?: string;
  readonly item: LibraryItem | null;
  readonly onPick: () => void;
}) => {
  const input = useRef<HTMLInputElement | null>(null);
  const [chosen, setChosen] = useState<{
    readonly name: string;
    readonly size: number;
  } | null>(null);
  const current = item?.storagePath
    ? {
        detail: `${item.mimeType ?? "tipo não informado"}${
          item.sizeBytes ? ` · ${formatBytes(Number(item.sizeBytes))}` : ""
        }`,
        name: "Arquivo privado atual",
      }
    : null;
  const shown = chosen
    ? { detail: formatBytes(chosen.size), name: chosen.name }
    : current;
  return (
    <div className="gk-label">
      <label htmlFor="library-file">Arquivo</label>
      <input
        accept="application/pdf,image/jpeg,image/png,image/webp,text/plain"
        aria-describedby={error ? "library-file-error" : undefined}
        className="gk-visually-hidden"
        id="library-file"
        name="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          setChosen(file ? { name: file.name, size: file.size } : null);
          onPick();
        }}
        ref={input}
        type="file"
      />
      <div className="gk-filecard">
        <span aria-hidden="true" className="gk-kindtile">
          <GestaoIcon name="file" size={20} />
        </span>
        <div className="gk-filecard-copy">
          <strong>{shown?.name ?? "Nenhum arquivo escolhido"}</strong>
          <small>
            {shown?.detail ?? "PDF, JPG, PNG, WebP ou texto · até 20 MB"}
          </small>
        </div>
        <button
          className="gk-btn"
          onClick={() => input.current?.click()}
          type="button"
        >
          {shown ? "Substituir" : "Escolher arquivo"}
        </button>
        {chosen ? (
          <button
            aria-label="Remover arquivo escolhido"
            className="gk-icon-btn gk-icon-btn--bare"
            onClick={() => {
              if (input.current) {
                input.current.value = "";
              }
              setChosen(null);
            }}
            type="button"
          >
            <GestaoIcon name="trash" size={16} />
          </button>
        ) : null}
      </div>
      {error ? (
        <small className="gk-error" id="library-file-error">
          {error}
        </small>
      ) : null}
    </div>
  );
};

const CoverField = ({
  error,
  initial,
}: {
  readonly error?: string;
  readonly initial: string;
}) => {
  const [value, setValue] = useState(initial);
  const previewable = value.startsWith("https://");
  return (
    <div className="gk-label">
      <label htmlFor="library-cover">Capa (opcional)</label>
      <div className="gk-dropzone">
        {previewable ? (
          <span
            aria-hidden="true"
            className="gk-dropzone-preview"
            style={{ backgroundImage: `url("${value.replace(/["()]/g, "")}")` }}
          />
        ) : (
          <GestaoIcon name="image" size={22} />
        )}
        <strong>Endereço da imagem de capa</strong>
        <small>JPG, PNG ou WebP hospedado em HTTPS</small>
        <input
          aria-describedby={error ? "library-cover-error" : undefined}
          aria-invalid={Boolean(error)}
          className="gk-input"
          id="library-cover"
          name="coverUrl"
          onChange={(event) => setValue(event.target.value.trim())}
          placeholder="https://…"
          type="url"
          value={value}
        />
      </div>
      {error ? (
        <small className="gk-error" id="library-cover-error">
          {error}
        </small>
      ) : null}
    </div>
  );
};

const MaterialCard = ({
  errors,
  item,
  mode,
  onModeChange,
}: {
  readonly errors: FieldErrors;
  readonly item: LibraryItem | null;
  readonly mode: SourceMode;
  readonly onModeChange: (next: SourceMode) => void;
}) => {
  const [kind, setKind] = useState<GestaoLibraryItemKind>(
    (item?.kind as GestaoLibraryItemKind | undefined) ?? defaultKinds[mode]
  );
  return (
    <section className="gk-card gk-card--wide">
      <h2>Material</h2>
      <SourceModeSwitch
        mode={mode}
        onChange={(next) => {
          onModeChange(next);
          if (!item) {
            setKind(defaultKinds[next]);
          }
        }}
      />
      <div className="gk-form-grid">
        <Field error={errors?.title} htmlFor="library-title" label="Título *">
          <input
            aria-invalid={Boolean(errors?.title)}
            className="gk-input"
            defaultValue={item?.title}
            id="library-title"
            maxLength={240}
            name="title"
            required
          />
        </Field>
        <Field error={errors?.kind} htmlFor="library-kind" label="Tipo">
          <SelectShell>
            <select
              className="gk-select"
              id="library-kind"
              name="kind"
              onChange={(event) =>
                setKind(event.target.value as GestaoLibraryItemKind)
              }
              value={kind}
            >
              {gestaoLibraryItemKinds.map((option) => (
                <option key={option} value={option}>
                  {kindLabels[option]}
                </option>
              ))}
            </select>
          </SelectShell>
        </Field>
      </div>
      {mode === "file" ? (
        <FileSource error={errors?.file} item={item} onPick={() => undefined} />
      ) : null}
      {mode === "link" ? (
        <Field error={errors?.url} htmlFor="library-url" label="Endereço (URL)">
          <input
            aria-invalid={Boolean(errors?.url)}
            className="gk-input"
            defaultValue={item?.storagePath ? "" : (item?.url ?? "")}
            id="library-url"
            name="url"
            placeholder="https://…"
            type="url"
          />
        </Field>
      ) : null}
      {mode === "reference" ? (
        <Field
          error={errors?.url}
          htmlFor="library-url"
          label="Link da referência (opcional)"
        >
          <input
            aria-invalid={Boolean(errors?.url)}
            className="gk-input"
            defaultValue={item?.storagePath ? "" : (item?.url ?? "")}
            id="library-url"
            name="url"
            placeholder="Se vazio, usamos o link do DOI"
            type="url"
          />
          <small className="gk-hint">
            Preencha o DOI em Metadados avançados para dispensar o link.
          </small>
        </Field>
      ) : null}
      <Field htmlFor="library-description" label="Descrição">
        <textarea
          className="gk-input gk-textarea"
          defaultValue={item?.description ?? ""}
          id="library-description"
          maxLength={5000}
          name="description"
          rows={4}
        />
      </Field>
      <CoverField error={errors?.coverUrl} initial={item?.coverUrl ?? ""} />
    </section>
  );
};

const LessonOptions = ({ courses }: { readonly courses: CourseOptions }) =>
  courses.flatMap((course) =>
    course.modules.flatMap((module) =>
      module.lessons.map((lesson) => (
        <option key={lesson.id} value={lesson.id}>
          {`${course.title} · ${module.title} · ${lesson.title}`}
        </option>
      ))
    )
  );

const AdvancedCard = ({
  courses,
  errors,
  item,
  onDuplicateCheck,
}: {
  readonly courses: CourseOptions;
  readonly errors: FieldErrors;
  readonly item: LibraryItem | null;
  readonly onDuplicateCheck: () => void;
}) => {
  const [open, setOpen] = useState(Boolean(item) || Boolean(errors));
  const [authors, setAuthors] = useState<readonly string[]>(
    authorList(item?.authors)
  );
  const knownLanguage = languageOptions.some(
    ([code]) => code === item?.language
  );
  return (
    <section className="gk-card gk-card--wide">
      <button
        aria-expanded={open}
        className="gk-collapse"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <h2>Metadados avançados</h2>
        <GestaoIcon name={open ? "chevron-up" : "chevron-down"} size={18} />
      </button>
      <div hidden={!open}>
        <div className="gk-stack gk-stack--tight">
          <div className="gk-form-grid gk-form-grid--authors">
            <div className="gk-label">
              <label htmlFor="library-authors">Autores</label>
              <AuthorChips authors={authors} onChange={setAuthors} />
            </div>
            <Field error={errors?.year} htmlFor="library-year" label="Ano">
              <input
                aria-invalid={Boolean(errors?.year)}
                className="gk-input"
                defaultValue={item?.year ?? ""}
                id="library-year"
                max={2100}
                min={1000}
                name="year"
                type="number"
              />
            </Field>
          </div>
          <div className="gk-form-grid">
            <Field htmlFor="library-doi" label="DOI">
              <input
                className="gk-input"
                defaultValue={item?.doi ?? ""}
                id="library-doi"
                name="doi"
                onBlur={onDuplicateCheck}
                placeholder="10.1000/xyz123"
              />
            </Field>
            <Field htmlFor="library-pmid" label="PMID">
              <input
                className="gk-input"
                defaultValue={item?.pmid ?? ""}
                id="library-pmid"
                name="pmid"
                placeholder="Opcional"
              />
            </Field>
          </div>
          <div className="gk-form-grid gk-form-grid--three">
            <Field
              error={errors?.language}
              htmlFor="library-language"
              label="Idioma"
            >
              <SelectShell>
                <select
                  className="gk-select"
                  defaultValue={item?.language ?? "pt"}
                  id="library-language"
                  name="language"
                >
                  {knownLanguage || !item?.language ? null : (
                    <option value={item.language}>{item.language}</option>
                  )}
                  {languageOptions.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </SelectShell>
            </Field>
            <Field
              error={errors?.difficulty}
              htmlFor="library-difficulty"
              label="Nível"
            >
              <SelectShell>
                <select
                  className="gk-select"
                  defaultValue={item?.difficulty ?? "INTERMEDIATE"}
                  id="library-difficulty"
                  name="difficulty"
                >
                  <option value="INTRODUCTORY">Introdutório</option>
                  <option value="INTERMEDIATE">Intermediário</option>
                  <option value="ADVANCED">Avançado</option>
                </select>
              </SelectShell>
            </Field>
            <Field
              error={errors?.accessType}
              htmlFor="library-access"
              label="Acesso"
            >
              <SelectShell>
                <select
                  className="gk-select"
                  defaultValue={item?.accessType ?? "FREE_TO_READ"}
                  id="library-access"
                  name="accessType"
                >
                  <option value="OPEN_ACCESS">Acesso aberto</option>
                  <option value="FREE_TO_READ">Leitura gratuita</option>
                  <option value="FREE_TOOL">Ferramenta gratuita</option>
                </select>
              </SelectShell>
            </Field>
          </div>
          <div className="gk-form-grid">
            <Field htmlFor="library-version" label="Versão ou edição">
              <input
                className="gk-input"
                defaultValue={item?.version ?? ""}
                id="library-version"
                name="version"
                placeholder="Opcional"
              />
            </Field>
            <Field
              error={errors?.lessonId}
              htmlFor="library-lesson"
              label="Aula relacionada"
            >
              <SelectShell>
                <select
                  className="gk-select"
                  defaultValue={item?.lessonId ?? ""}
                  id="library-lesson"
                  name="lessonId"
                >
                  <option value="">Nenhuma aula</option>
                  <LessonOptions courses={courses} />
                </select>
              </SelectShell>
            </Field>
          </div>
          <div className="gk-form-grid">
            <Field htmlFor="library-category" label="Categoria">
              <input
                className="gk-input"
                defaultValue={item?.category ?? ""}
                id="library-category"
                maxLength={80}
                name="category"
                placeholder="Ex.: Revisões sistemáticas"
              />
            </Field>
            <Field htmlFor="library-tags" label="Etiquetas">
              <input
                className="gk-input"
                defaultValue={item?.tags.join(", ") ?? ""}
                id="library-tags"
                name="tags"
                placeholder="pbe, leitura"
              />
            </Field>
          </div>
          <Field htmlFor="library-access-note" label="Condições de acesso">
            <textarea
              className="gk-input gk-textarea"
              defaultValue={item?.accessNote ?? ""}
              id="library-access-note"
              maxLength={1200}
              name="accessNote"
              placeholder="Ex.: cadastro gratuito necessário"
              rows={3}
            />
          </Field>
        </div>
      </div>
    </section>
  );
};

const PublicationCard = ({
  item,
  pending,
}: {
  readonly item: LibraryItem | null;
  readonly pending: boolean;
}) => {
  const status = item?.status ?? "DRAFT";
  const published = status === "PUBLISHED";
  return (
    <aside className="gk-card gk-card--wide">
      <h2>Publicação</h2>
      <div className="gk-statusline">
        <span>Estado</span>
        <span className="gk-chip" data-tone={published ? "active" : "neutral"}>
          {statusNames[status]}
        </span>
      </div>
      <div className="gk-pubactions">
        <button
          className="gk-btn gk-btn--primary"
          disabled={pending}
          name="saveMode"
          type="submit"
          value="publish"
        >
          {published ? "Salvar alterações" : "Publicar"}
        </button>
        <button
          className="gk-btn"
          disabled={pending}
          name="saveMode"
          type="submit"
          value="draft"
        >
          {published ? "Voltar a rascunho" : "Salvar rascunho"}
        </button>
      </div>
      <p className="gk-hint">
        {published
          ? "Material visível aos alunos na Biblioteca."
          : "Nada aparece para os alunos antes de você publicar."}
      </p>
    </aside>
  );
};

const DuplicateNotice = ({
  duplicate,
}: {
  readonly duplicate: LibraryDuplicate;
}) => (
  <aside className="gk-dupe" role="alert">
    <GestaoIcon name="alert-circle" size={20} />
    <strong>Possível duplicata encontrada.</strong>
    <p>
      Já existe “{duplicate.title}” com{" "}
      {duplicate.matchedBy === "doi" ? "o mesmo DOI" : "o mesmo link"}.
    </p>
    <Link
      className="gk-btn"
      href={`/gestao/ensino/biblioteca/${duplicate.id}`}
      prefetch={false}
      rel="noreferrer"
      target="_blank"
    >
      Comparar
    </Link>
  </aside>
);

export const GestaoLibraryItemForm = ({
  courses,
  idempotencyKey,
  item,
}: {
  readonly courses: CourseOptions;
  readonly idempotencyKey?: string;
  readonly item: LibraryItem | null;
}) => {
  const router = useRouter();
  const action = item ? updateGestaoLibraryItem : createGestaoLibraryItem;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [mode, setMode] = useState<SourceMode>(
    item?.storagePath ? "file" : "link"
  );
  const [duplicate, setDuplicate] = useState<LibraryDuplicate | null>(null);
  const form = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (state.status === "success") {
      const result =
        state.result ?? (item ? "material-atualizado" : "material-criado");
      router.replace(`/gestao/ensino/biblioteca?resultado=${result}`);
    }
  }, [item, router, state.result, state.status]);

  const checkDuplicate = async () => {
    const data = new FormData(form.current ?? undefined);
    const found = await findGestaoLibraryDuplicate({
      doi: String(data.get("doi") ?? ""),
      excludeId: item?.id,
      url: String(data.get("url") ?? ""),
    });
    setDuplicate(found);
  };

  return (
    <form
      action={formAction}
      aria-busy={pending}
      encType="multipart/form-data"
      onBlurCapture={(event) => {
        if ((event.target as HTMLElement).id === "library-url") {
          checkDuplicate();
        }
      }}
      ref={form}
    >
      <GestaoCrumbTail
        items={[{ label: item ? item.title : "Novo material" }]}
      />
      <input name="surface" type="hidden" value="gestao" />
      {item ? <input name="id" type="hidden" value={item.id} /> : null}
      {idempotencyKey ? (
        <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      ) : null}
      <header className="gk-head gk-head--editor">
        <div className="gk-head-copy">
          <h1>{item ? "Editar material" : "Novo material"}</h1>
          <p>
            {item
              ? "As alterações ficam registradas no material existente."
              : "Escolha o tipo e preencha só o que for relevante."}
          </p>
        </div>
        <div className="gk-head-actions">
          <FormDirtyIndicator savedLabel={item ? "Tudo salvo" : "Novo"} />
          <Link
            className="gk-btn"
            href="/gestao/ensino/biblioteca"
            prefetch={false}
          >
            Voltar à biblioteca
          </Link>
        </div>
      </header>
      {state.message && state.status === "error" ? (
        <output aria-live="assertive" className="gk-error-box">
          {state.message}
        </output>
      ) : null}
      <div className="gk-cols">
        <div className="gk-stack">
          <MaterialCard
            errors={state.fieldErrors}
            item={item}
            mode={mode}
            onModeChange={setMode}
          />
          <AdvancedCard
            courses={courses}
            errors={state.fieldErrors}
            item={item}
            onDuplicateCheck={checkDuplicate}
          />
        </div>
        <div className="gk-stack">
          <PublicationCard item={item} pending={pending} />
          {duplicate ? <DuplicateNotice duplicate={duplicate} /> : null}
        </div>
      </div>
    </form>
  );
};
