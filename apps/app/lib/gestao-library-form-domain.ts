import {
  LibraryItemAccessType,
  LibraryItemDifficulty,
  LibraryItemKind,
} from "@repo/database";
import { readIdempotencyKey } from "@/lib/mutation-contract";

const languageSeparatorPattern = /[,/]/;
const languageCodePattern = /^[a-z]{2}(-[a-z]{2})?$/;
const libraryFileTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);
const maxLibraryFileBytes = 20 * 1024 * 1024;

export type LibraryItemFormField =
  | "accessType"
  | "category"
  | "coverUrl"
  | "description"
  | "difficulty"
  | "file"
  | "id"
  | "kind"
  | "language"
  | "lessonId"
  | "title"
  | "url"
  | "year";

export interface LibraryItemFormState {
  readonly fieldErrors?: Partial<Record<LibraryItemFormField, string>>;
  readonly message?: string;
  readonly result?: string;
  readonly status: "idle" | "error" | "success";
}

interface ParsedLibraryItemInput {
  readonly accessNote: string | null;
  readonly accessType: LibraryItemAccessType | null;
  readonly authors: string | null;
  readonly category: string | null;
  readonly coverUrl: string | null;
  readonly description: string | null;
  readonly difficulty: LibraryItemDifficulty | null;
  readonly doi: string | null;
  readonly file: File | null;
  readonly idempotencyKey: string | null;
  readonly kind: LibraryItemKind;
  readonly language: string | null;
  readonly lessonId: string;
  readonly pmid: string | null;
  readonly tags: string[];
  readonly title: string;
  readonly url: string | null;
  readonly version: string | null;
  readonly year: number | null;
}

type ParsedLibraryItemInputResult =
  | { readonly input: ParsedLibraryItemInput; readonly ok: true }
  | { readonly ok: false; readonly state: LibraryItemFormState };

const value = (entry: FormDataEntryValue | null) =>
  typeof entry === "string" ? entry.trim() : "";

const safeUrl = (entry: string) => {
  try {
    const url = new URL(entry);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

const safeCoverUrl = (entry: string) => {
  const url = safeUrl(entry);
  return url?.startsWith("https://") ? url : null;
};

export const normalizeLibraryLanguage = (entry: string) => {
  const languages = entry
    .split(languageSeparatorPattern)
    .map((language) => language.trim().toLowerCase())
    .filter(Boolean);
  if (
    languages.length > 4 ||
    languages.some((language) => !languageCodePattern.test(language))
  ) {
    return null;
  }
  return [...new Set(languages)].slice(0, 4).join(",") || null;
};

export const libraryFormError = (
  field: LibraryItemFormField,
  message: string,
  result?: string
): LibraryItemFormState => ({
  fieldErrors: { [field]: message },
  message,
  result,
  status: "error",
});

export const libraryFormSuccess = (
  result: string,
  message: string
): LibraryItemFormState => ({ message, result, status: "success" });

const validLibraryFile = (entry: FormDataEntryValue | null) =>
  entry instanceof File &&
  libraryFileTypes.has(entry.type) &&
  entry.size > 0 &&
  entry.size <= maxLibraryFileBytes
    ? entry
    : null;

const validateLibraryIdentity = (input: {
  readonly idempotencyKey: string | null;
  readonly kind: string;
  readonly requireIdempotencyKey: boolean;
  readonly title: string;
}) => {
  if (!input.title || input.title.length > 240) {
    return libraryFormError(
      "title",
      "Informe um título com até 240 caracteres."
    );
  }
  if (!Object.values(LibraryItemKind).includes(input.kind as LibraryItemKind)) {
    return libraryFormError("kind", "Escolha um tipo de material válido.");
  }
  if (input.requireIdempotencyKey && !input.idempotencyKey) {
    return libraryFormError(
      "id",
      "A sessão do formulário expirou. Recarregue a página e tente novamente."
    );
  }
  return null;
};

const validateLibrarySources = (input: {
  readonly coverInput: string;
  readonly coverUrl: string | null;
  readonly file: File | null;
  readonly hasUpload: boolean;
  readonly requireSource: boolean;
  readonly url: string | null;
  readonly urlInput: string;
}) => {
  if (input.urlInput && !input.url) {
    return libraryFormError("url", "Informe um endereço HTTP ou HTTPS válido.");
  }
  if (input.coverInput && !input.coverUrl) {
    return libraryFormError(
      "coverUrl",
      "A capa precisa usar um endereço HTTPS válido."
    );
  }
  if (input.hasUpload && !input.file) {
    return libraryFormError(
      "file",
      "Use PDF, JPG, PNG, WebP ou texto simples de até 20 MB."
    );
  }
  if (input.requireSource && !(input.url || input.file)) {
    return libraryFormError(
      "url",
      "Informe um link válido ou envie um arquivo."
    );
  }
  return null;
};

const validateLibraryMetadata = (input: {
  readonly accessTypeInput: string;
  readonly difficultyInput: string;
  readonly language: string | null;
  readonly languageInput: string;
  readonly year: number | null;
  readonly yearInput: string;
}) => {
  if (
    input.yearInput &&
    (!Number.isInteger(input.year) ||
      Number(input.year) < 1000 ||
      Number(input.year) > 2100)
  ) {
    return libraryFormError("year", "Informe um ano entre 1000 e 2100.");
  }
  if (input.languageInput && !input.language) {
    return libraryFormError("language", "Use códigos de idioma como pt ou en.");
  }
  if (
    input.accessTypeInput &&
    !Object.values(LibraryItemAccessType).includes(
      input.accessTypeInput as LibraryItemAccessType
    )
  ) {
    return libraryFormError(
      "accessType",
      "Escolha uma opção de acesso válida."
    );
  }
  if (
    input.difficultyInput &&
    !Object.values(LibraryItemDifficulty).includes(
      input.difficultyInput as LibraryItemDifficulty
    )
  ) {
    return libraryFormError("difficulty", "Escolha um nível válido.");
  }
  return null;
};

export const parseLibraryItemInput = (
  formData: FormData,
  options: {
    readonly requireIdempotencyKey: boolean;
    readonly requireSource: boolean;
  }
): ParsedLibraryItemInputResult => {
  const title = value(formData.get("title"));
  const kind = value(formData.get("kind"));
  const urlInput = value(formData.get("url"));
  const url = safeUrl(urlInput);
  const coverInput = value(formData.get("coverUrl"));
  const coverUrl = safeCoverUrl(coverInput);
  const fileEntry = formData.get("file");
  const hasUpload = fileEntry instanceof File && fileEntry.size > 0;
  const file = validLibraryFile(fileEntry);
  const idempotencyKey = readIdempotencyKey(formData.get("idempotencyKey"));
  const yearInput = value(formData.get("year"));
  const year = yearInput ? Number(yearInput) : null;
  const languageInput = value(formData.get("language"));
  const language = normalizeLibraryLanguage(languageInput);
  const accessTypeInput = value(formData.get("accessType"));
  const difficultyInput = value(formData.get("difficulty"));
  const validationError =
    validateLibraryIdentity({
      idempotencyKey,
      kind,
      requireIdempotencyKey: options.requireIdempotencyKey,
      title,
    }) ??
    validateLibrarySources({
      coverInput,
      coverUrl,
      file,
      hasUpload,
      requireSource: options.requireSource,
      url,
      urlInput,
    }) ??
    validateLibraryMetadata({
      accessTypeInput,
      difficultyInput,
      language,
      languageInput,
      year,
      yearInput,
    });
  if (validationError) {
    return { ok: false, state: validationError };
  }

  const tags = value(formData.get("tags"))
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag, index, allTags) => tag && allTags.indexOf(tag) === index)
    .slice(0, 12);

  return {
    input: {
      accessNote: value(formData.get("accessNote")).slice(0, 1200) || null,
      accessType: Object.values(LibraryItemAccessType).includes(
        accessTypeInput as LibraryItemAccessType
      )
        ? (accessTypeInput as LibraryItemAccessType)
        : null,
      authors: value(formData.get("authors")) || null,
      category: value(formData.get("category")).slice(0, 80) || null,
      coverUrl,
      description: value(formData.get("description")).slice(0, 5000) || null,
      difficulty: Object.values(LibraryItemDifficulty).includes(
        difficultyInput as LibraryItemDifficulty
      )
        ? (difficultyInput as LibraryItemDifficulty)
        : null,
      doi: value(formData.get("doi")) || null,
      file,
      idempotencyKey,
      kind: kind as LibraryItemKind,
      language,
      lessonId: value(formData.get("lessonId")),
      pmid: value(formData.get("pmid")) || null,
      tags,
      title,
      url,
      version: value(formData.get("version")).slice(0, 240) || null,
      year,
    },
    ok: true,
  };
};
