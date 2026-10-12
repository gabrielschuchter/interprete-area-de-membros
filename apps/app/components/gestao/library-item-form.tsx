"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import {
  createGestaoLibraryItem,
  updateGestaoLibraryItem,
} from "@/app/(authenticated)/biblioteca/actions";
import type { getCourseOptions } from "@/lib/admin-learning";
import type { getGestaoLibraryItemForEdit } from "@/lib/gestao-library";
import type { LibraryItemFormState } from "@/lib/gestao-library-form-domain";
import {
  type GestaoLibraryItemKind,
  gestaoLibraryItemDifficulties,
  gestaoLibraryItemKinds,
} from "@/lib/gestao-library-form-options";

type LibraryItem = NonNullable<
  Awaited<ReturnType<typeof getGestaoLibraryItemForEdit>>
>;
type CourseOptions = Awaited<ReturnType<typeof getCourseOptions>>;

const kindLabels: Record<GestaoLibraryItemKind, string> = {
  ARTICLE: "Artigo",
  GUIDE: "Guia",
  LINK: "Link",
  PDF: "PDF",
  VIDEO: "Vídeo",
};

const Field = ({
  children,
  error,
  htmlFor,
  label,
}: {
  readonly children: React.ReactNode;
  readonly error?: string;
  readonly htmlFor: string;
  readonly label: string;
}) => (
  <div className="gl-form-field">
    <label htmlFor={htmlFor}>{label}</label>
    {children}
    {error ? (
      <p className="gl-field-error" id={`${htmlFor}-error`}>
        {error}
      </p>
    ) : null}
  </div>
);

const initialState: LibraryItemFormState = { status: "idle" };

const itemStatusLabel = (item: LibraryItem | null) => {
  switch (item?.status) {
    case "PUBLISHED":
      return "Publicado";
    case "ARCHIVED":
      return "Arquivado";
    default:
      return "Rascunho";
  }
};

const submitLabel = (item: LibraryItem | null, pending: boolean) => {
  if (pending) {
    return "Salvando…";
  }
  return item ? "Salvar alterações" : "Salvar como rascunho";
};

const LessonOptions = ({ courses }: { readonly courses: CourseOptions }) => {
  const lessons = courses.flatMap((course) =>
    course.modules.flatMap((module) =>
      module.lessons.map((lesson) => ({
        id: lesson.id,
        label: `${course.title} · ${module.title} · ${lesson.title}`,
      }))
    )
  );

  return lessons.map((lesson) => (
    <option key={lesson.id} value={lesson.id}>
      {lesson.label}
    </option>
  ));
};

const MaterialFields = ({
  errors,
  inputId,
  item,
}: {
  readonly errors: LibraryItemFormState["fieldErrors"];
  readonly inputId: string;
  readonly item: LibraryItem | null;
}) => (
  <section className="gl-form-card">
    <header>
      <h2>Material</h2>
      <p>
        Preencha os dados que ajudam a identificar e encontrar este recurso.
      </p>
    </header>
    <div className="gl-form-grid">
      <Field
        error={errors?.title}
        htmlFor={`gl-title-${inputId}`}
        label="Título *"
      >
        <Input
          aria-describedby={
            errors?.title ? `gl-title-${inputId}-error` : undefined
          }
          aria-invalid={Boolean(errors?.title)}
          defaultValue={item?.title}
          id={`gl-title-${inputId}`}
          maxLength={240}
          name="title"
          required
        />
      </Field>
      <Field error={errors?.kind} htmlFor={`gl-kind-${inputId}`} label="Tipo">
        <select
          aria-describedby={
            errors?.kind ? `gl-kind-${inputId}-error` : undefined
          }
          aria-invalid={Boolean(errors?.kind)}
          defaultValue={item?.kind ?? gestaoLibraryItemKinds[0]}
          id={`gl-kind-${inputId}`}
          name="kind"
        >
          {gestaoLibraryItemKinds.map((kind) => (
            <option key={kind} value={kind}>
              {kindLabels[kind]}
            </option>
          ))}
        </select>
      </Field>
      <Field htmlFor={`gl-description-${inputId}`} label="Descrição">
        <Textarea
          defaultValue={item?.description ?? ""}
          id={`gl-description-${inputId}`}
          maxLength={5000}
          name="description"
          rows={5}
        />
      </Field>
      <Field
        error={errors?.coverUrl}
        htmlFor={`gl-cover-${inputId}`}
        label="Capa por URL HTTPS (opcional)"
      >
        <Input
          aria-describedby={
            errors?.coverUrl ? `gl-cover-${inputId}-error` : undefined
          }
          aria-invalid={Boolean(errors?.coverUrl)}
          defaultValue={item?.coverUrl ?? ""}
          id={`gl-cover-${inputId}`}
          name="coverUrl"
          pattern="https://.*"
          placeholder="https://…"
          type="url"
        />
      </Field>
    </div>
  </section>
);

const SourceFields = ({
  errors,
  inputId,
  item,
}: {
  readonly errors: LibraryItemFormState["fieldErrors"];
  readonly inputId: string;
  readonly item: LibraryItem | null;
}) => (
  <section className="gl-form-card">
    <header>
      <h2>Arquivo ou referência</h2>
      <p>Use um link seguro ou envie um arquivo permitido para a biblioteca.</p>
    </header>
    <div className="gl-form-grid">
      <Field
        error={errors?.url}
        htmlFor={`gl-url-${inputId}`}
        label="Link HTTPS ou HTTP"
      >
        <Input
          aria-describedby={errors?.url ? `gl-url-${inputId}-error` : undefined}
          aria-invalid={Boolean(errors?.url)}
          defaultValue={item?.storagePath ? "" : (item?.url ?? "")}
          id={`gl-url-${inputId}`}
          name="url"
          placeholder="https://…"
          type="url"
        />
      </Field>
      <Field
        error={errors?.file}
        htmlFor={`gl-file-${inputId}`}
        label="Arquivo (opcional)"
      >
        <Input
          accept="application/pdf,image/jpeg,image/png,image/webp,text/plain"
          aria-describedby={
            errors?.file ? `gl-file-${inputId}-error` : undefined
          }
          aria-invalid={Boolean(errors?.file)}
          id={`gl-file-${inputId}`}
          name="file"
          type="file"
        />
      </Field>
      {item?.storagePath ? (
        <p className="gl-file-hint">
          Arquivo privado atual · {item.mimeType ?? "tipo não informado"}
          {item.sizeBytes
            ? ` · ${Math.ceil(Number(item.sizeBytes) / 1024)} KB`
            : ""}
        </p>
      ) : null}
    </div>
  </section>
);

const AdvancedFields = ({
  courses,
  errors,
  inputId,
  item,
}: {
  readonly courses: CourseOptions;
  readonly errors: LibraryItemFormState["fieldErrors"];
  readonly inputId: string;
  readonly item: LibraryItem | null;
}) => (
  <section className="gl-form-card">
    <details open>
      <summary>Metadados avançados</summary>
      <div className="gl-form-grid gl-form-grid-three">
        <Field htmlFor={`gl-authors-${inputId}`} label="Autores">
          <Input
            defaultValue={item?.authors ?? ""}
            id={`gl-authors-${inputId}`}
            name="authors"
          />
        </Field>
        <Field error={errors?.year} htmlFor={`gl-year-${inputId}`} label="Ano">
          <Input
            aria-describedby={
              errors?.year ? `gl-year-${inputId}-error` : undefined
            }
            aria-invalid={Boolean(errors?.year)}
            defaultValue={item?.year ?? ""}
            id={`gl-year-${inputId}`}
            max={2100}
            min={1000}
            name="year"
            type="number"
          />
        </Field>
        <Field
          error={errors?.language}
          htmlFor={`gl-language-${inputId}`}
          label="Idioma(s)"
        >
          <Input
            aria-describedby={
              errors?.language ? `gl-language-${inputId}-error` : undefined
            }
            aria-invalid={Boolean(errors?.language)}
            defaultValue={item?.language ?? ""}
            id={`gl-language-${inputId}`}
            name="language"
            placeholder="pt,en"
          />
        </Field>
        <Field htmlFor={`gl-category-${inputId}`} label="Categoria">
          <Input
            defaultValue={item?.category ?? ""}
            id={`gl-category-${inputId}`}
            maxLength={80}
            name="category"
          />
        </Field>
        <Field htmlFor={`gl-tags-${inputId}`} label="Tags">
          <Input
            defaultValue={item?.tags.join(", ") ?? ""}
            id={`gl-tags-${inputId}`}
            name="tags"
            placeholder="pbe, leitura"
          />
        </Field>
        <Field
          error={errors?.difficulty}
          htmlFor={`gl-difficulty-${inputId}`}
          label="Nível"
        >
          <select
            aria-describedby={
              errors?.difficulty ? `gl-difficulty-${inputId}-error` : undefined
            }
            aria-invalid={Boolean(errors?.difficulty)}
            defaultValue={item?.difficulty ?? "INTERMEDIATE"}
            id={`gl-difficulty-${inputId}`}
            name="difficulty"
          >
            <option value={gestaoLibraryItemDifficulties[0]}>
              Introdutório
            </option>
            <option value={gestaoLibraryItemDifficulties[1]}>
              Intermediário
            </option>
            <option value={gestaoLibraryItemDifficulties[2]}>Avançado</option>
          </select>
        </Field>
        <Field
          error={errors?.accessType}
          htmlFor={`gl-access-${inputId}`}
          label="Acesso"
        >
          <select
            aria-describedby={
              errors?.accessType ? `gl-access-${inputId}-error` : undefined
            }
            aria-invalid={Boolean(errors?.accessType)}
            defaultValue={item?.accessType ?? "FREE_TO_READ"}
            id={`gl-access-${inputId}`}
            name="accessType"
          >
            <option value="OPEN_ACCESS">Acesso aberto</option>
            <option value="FREE_TO_READ">Leitura gratuita</option>
            <option value="FREE_TOOL">Ferramenta gratuita</option>
          </select>
        </Field>
        <Field htmlFor={`gl-version-${inputId}`} label="Versão ou edição">
          <Input
            defaultValue={item?.version ?? ""}
            id={`gl-version-${inputId}`}
            name="version"
          />
        </Field>
        <Field htmlFor={`gl-doi-${inputId}`} label="DOI">
          <Input
            defaultValue={item?.doi ?? ""}
            id={`gl-doi-${inputId}`}
            name="doi"
          />
        </Field>
        <Field htmlFor={`gl-pmid-${inputId}`} label="PMID">
          <Input
            defaultValue={item?.pmid ?? ""}
            id={`gl-pmid-${inputId}`}
            name="pmid"
          />
        </Field>
        <Field
          htmlFor={`gl-access-note-${inputId}`}
          label="Condições de acesso"
        >
          <Textarea
            defaultValue={item?.accessNote ?? ""}
            id={`gl-access-note-${inputId}`}
            maxLength={1200}
            name="accessNote"
            rows={3}
          />
        </Field>
        <Field
          error={errors?.lessonId}
          htmlFor={`gl-lesson-${inputId}`}
          label="Aula relacionada"
        >
          <select
            aria-describedby={
              errors?.lessonId ? `gl-lesson-${inputId}-error` : undefined
            }
            aria-invalid={Boolean(errors?.lessonId)}
            defaultValue={item?.lessonId ?? ""}
            id={`gl-lesson-${inputId}`}
            name="lessonId"
          >
            <option value="">Nenhuma aula</option>
            <LessonOptions courses={courses} />
          </select>
        </Field>
      </div>
    </details>
  </section>
);

const PublicationCard = ({
  item,
  pending,
}: {
  readonly item: LibraryItem | null;
  readonly pending: boolean;
}) => (
  <aside className="gl-publication-card">
    <h2>Publicação</h2>
    <p>Estado atual</p>
    <strong>{itemStatusLabel(item)}</strong>
    <p>
      {item
        ? "A alteração será salva no material atual."
        : "Este material começa privado e não aparece aos alunos."}
    </p>
    <Button className="w-full" disabled={pending} type="submit">
      {submitLabel(item, pending)}
    </Button>
    {item ? (
      <Link
        className="gl-back-link"
        href="/gestao/ensino/biblioteca"
        prefetch={false}
      >
        Voltar à biblioteca
      </Link>
    ) : null}
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
  const inputId = item?.id ?? "novo";

  useEffect(() => {
    if (state.status === "success") {
      const result =
        state.result ?? (item ? "material-atualizado" : "material-criado");
      router.replace(`/gestao/ensino/biblioteca?resultado=${result}`);
    }
  }, [item, router, state.result, state.status]);

  return (
    <form
      action={formAction}
      aria-busy={pending}
      className="gl-item-form"
      encType="multipart/form-data"
    >
      <input name="surface" type="hidden" value="gestao" />
      {item ? <input name="id" type="hidden" value={item.id} /> : null}
      {idempotencyKey ? (
        <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      ) : null}
      {state.message && state.status === "error" ? (
        <output aria-live="assertive" className="gl-result is-error">
          {state.message}
        </output>
      ) : null}
      <div className="gl-material-layout">
        <div className="gl-material-main">
          <MaterialFields
            errors={state.fieldErrors}
            inputId={inputId}
            item={item}
          />
          <SourceFields
            errors={state.fieldErrors}
            inputId={inputId}
            item={item}
          />
          <AdvancedFields
            courses={courses}
            errors={state.fieldErrors}
            inputId={inputId}
            item={item}
          />
        </div>
        <PublicationCard item={item} pending={pending} />
      </div>
    </form>
  );
};
