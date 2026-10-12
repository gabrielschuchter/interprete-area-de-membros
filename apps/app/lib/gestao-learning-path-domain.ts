export type GestaoLearningPathField = "title" | "slug" | "description";

export interface GestaoLearningPathFormState {
  readonly fieldErrors?: Partial<Record<GestaoLearningPathField, string>>;
  readonly idempotencyKey?: string;
  readonly message?: string;
  readonly status: "idle" | "error";
}

export interface GestaoLearningPathWriteInput {
  readonly description: string | null;
  readonly slug: string;
  readonly title: string;
}

export type GestaoLearningPathWriteResult =
  | { readonly input: GestaoLearningPathWriteInput; readonly ok: true }
  | {
      readonly fieldErrors: Partial<Record<GestaoLearningPathField, string>>;
      readonly message: string;
      readonly ok: false;
    };

const pathSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const value = (entry: FormDataEntryValue | null) =>
  typeof entry === "string" ? entry.trim() : "";

export const parseGestaoLearningPathWrite = (
  formData: FormData
): GestaoLearningPathWriteResult => {
  const title = value(formData.get("title"));
  const slug = value(formData.get("slug")).toLowerCase();
  const description = value(formData.get("description"));
  const fieldErrors: Partial<Record<GestaoLearningPathField, string>> = {};

  if (title.length < 2 || title.length > 120) {
    fieldErrors.title = "Informe um título entre 2 e 120 caracteres.";
  }
  if (slug.length > 120 || !pathSlugPattern.test(slug)) {
    fieldErrors.slug =
      "Use letras minúsculas, números e hífens, sem hífen no início ou no fim.";
  }
  if (description.length > 5000) {
    fieldErrors.description = "A descrição pode ter até 5.000 caracteres.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      message: "Revise os campos destacados.",
      ok: false,
    };
  }

  return {
    input: {
      description: description || null,
      slug,
      title,
    },
    ok: true,
  };
};

export const isGestaoLearningPathStatusTransitionAllowed = (
  current: "DRAFT" | "PUBLISHED" | "ARCHIVED",
  next: "DRAFT" | "PUBLISHED" | "ARCHIVED"
) => {
  if (current === next) {
    return false;
  }
  if (current === "ARCHIVED") {
    return next === "DRAFT";
  }
  if (current === "PUBLISHED") {
    return next === "DRAFT" || next === "ARCHIVED";
  }
  return next === "PUBLISHED" || next === "ARCHIVED";
};
