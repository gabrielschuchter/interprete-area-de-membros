import { isAllowedCollectionCoverUrl } from "@/lib/collection-covers";
import { readIdempotencyKey } from "@/lib/mutation-contract";

export type GestaoCollectionStatus = "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type GestaoCollectionPublishMode = "now" | "schedule";

export interface GestaoCollectionFilters {
  readonly page: number;
  readonly query: string;
  readonly status: GestaoCollectionStatus;
}

export type GestaoCollectionField =
  | "title"
  | "description"
  | "coverUrl"
  | "coverFile"
  | "audienceSpaceId"
  | "availableAt"
  | "expiresAt"
  | "idempotencyKey";

export interface GestaoCollectionFormState {
  readonly fieldErrors?: Partial<Record<GestaoCollectionField, string>>;
  readonly id?: string;
  readonly message?: string;
  readonly status: "idle" | "error" | "success";
}

export interface GestaoCollectionWriteInput {
  readonly audienceSpaceId: string | null;
  readonly availableAt: Date | null;
  readonly coverFile: File | null;
  readonly coverUrl: string | null;
  readonly description: string | null;
  readonly expiresAt: Date | null;
  readonly idempotencyKey: string | null;
  readonly publishMode: GestaoCollectionPublishMode;
  readonly title: string;
}

export type GestaoCollectionWriteResult =
  | { readonly input: GestaoCollectionWriteInput; readonly ok: true }
  | { readonly ok: false; readonly state: GestaoCollectionFormState };

const statuses = new Set<GestaoCollectionStatus>([
  "ALL",
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);

const publishModes = new Set<GestaoCollectionPublishMode>(["now", "schedule"]);
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maximumCoverBytes = 5 * 1024 * 1024;
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export const gestaoCollectionsPageSize = 24;
export const gestaoCollectionItemsPageSize = 100;

const value = (entry: FormDataEntryValue | null) =>
  typeof entry === "string" ? entry.trim() : "";

const parseLocalDate = (input: string) => {
  if (!input) {
    return null;
  }
  if (!localDateTimePattern.test(input)) {
    return Number.NaN;
  }
  const [datePart, timePart] = input.split("T");
  const [year, month, day] = (datePart ?? "").split("-").map(Number);
  const [hour, minute] = (timePart ?? "").split(":").map(Number);
  const lastDay = new Date(Date.UTC(year ?? 0, month ?? 0, 0)).getUTCDate();
  if (
    !(
      year &&
      month !== undefined &&
      month >= 1 &&
      month <= 12 &&
      day !== undefined &&
      day >= 1 &&
      day <= lastDay &&
      hour !== undefined &&
      hour >= 0 &&
      hour <= 23 &&
      minute !== undefined &&
      minute >= 0 &&
      minute <= 59
    )
  ) {
    return Number.NaN;
  }
  const date = new Date(`${input}:00-03:00`);
  return Number.isFinite(date.getTime()) ? date : Number.NaN;
};

const formError = (field: GestaoCollectionField, message: string) => ({
  fieldErrors: { [field]: message },
  message: "Revise os campos destacados.",
  status: "error" as const,
});

export const normalizeGestaoCollectionFilters = (input: {
  readonly page?: string;
  readonly query?: string;
  readonly status?: string;
}): GestaoCollectionFilters => {
  const page = Number(input.page);
  return {
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10_000) : 1,
    query: (input.query ?? "").trim().slice(0, 120),
    status: statuses.has(input.status as GestaoCollectionStatus)
      ? (input.status as GestaoCollectionStatus)
      : "ALL",
  };
};

export const buildGestaoCollectionsHref = (
  pathname: string,
  filters: GestaoCollectionFilters,
  overrides: Partial<GestaoCollectionFilters> = {}
) => {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.query) {
    params.set("q", next.query);
  }
  if (next.status !== "ALL") {
    params.set("estado", next.status);
  }
  if (next.page > 1) {
    params.set("pagina", String(next.page));
  }
  const search = params.toString();
  return `${pathname}${search ? `?${search}` : ""}`;
};

interface CollectionWriteDraft {
  readonly audienceSpaceId: string | null;
  readonly availableAt: Date | null | number;
  readonly coverFile: File | null;
  readonly coverFileEntry: FormDataEntryValue | null;
  readonly coverInput: string;
  readonly coverUrl: string | null;
  readonly description: string;
  readonly expiresAt: Date | null | number;
  readonly idempotencyKey: string | null;
  readonly publishMode: GestaoCollectionPublishMode;
  readonly title: string;
}

const readCollectionWriteDraft = (formData: FormData): CollectionWriteDraft => {
  const coverFileEntry = formData.get("coverFile");
  const hasCoverUpload =
    coverFileEntry instanceof File && coverFileEntry.size > 0;
  const coverInput = value(formData.get("coverUrl"));
  const modeInput = value(formData.get("publishMode"));
  return {
    audienceSpaceId: value(formData.get("audienceSpaceId")) || null,
    availableAt: parseLocalDate(value(formData.get("availableAt"))),
    coverFile:
      hasCoverUpload && coverFileEntry instanceof File ? coverFileEntry : null,
    coverFileEntry,
    coverInput,
    coverUrl: coverInput || null,
    description: value(formData.get("description")),
    expiresAt: parseLocalDate(value(formData.get("expiresAt"))),
    idempotencyKey: readIdempotencyKey(formData.get("idempotencyKey")),
    publishMode: publishModes.has(modeInput as GestaoCollectionPublishMode)
      ? (modeInput as GestaoCollectionPublishMode)
      : "now",
    title: value(formData.get("title")),
  };
};

const validateTitle = (title: string) =>
  title.length === 0 || title.length > 120
    ? formError("title", "Informe um título de até 120 caracteres.")
    : null;

const validateDescription = (description: string) =>
  description.length > 500
    ? formError("description", "A descrição pode ter até 500 caracteres.")
    : null;

const validateCover = (draft: CollectionWriteDraft) => {
  if (
    draft.coverInput.length > 2000 ||
    !isAllowedCollectionCoverUrl(draft.coverInput)
  ) {
    return formError("coverUrl", "Escolha uma capa válida da biblioteca.");
  }
  if (draft.coverFileEntry && !(draft.coverFileEntry instanceof File)) {
    return formError("coverFile", "O arquivo enviado não é válido.");
  }
  if (
    draft.coverFile &&
    (!imageTypes.has(draft.coverFile.type) ||
      draft.coverFile.size > maximumCoverBytes ||
      draft.coverFile.size <= 0)
  ) {
    return formError("coverFile", "Envie JPG, PNG ou WebP de até 5 MB.");
  }
  return null;
};

const validateAudience = (audienceSpaceId: string | null) =>
  audienceSpaceId && audienceSpaceId.length > 128
    ? formError("audienceSpaceId", "Escolha um público válido.")
    : null;

const validatePeriod = (
  draft: CollectionWriteDraft,
  now: Date
): GestaoCollectionFormState | null => {
  if (Number.isNaN(draft.availableAt)) {
    return formError("availableAt", "Informe uma data e hora válidas.");
  }
  if (Number.isNaN(draft.expiresAt)) {
    return formError("expiresAt", "Informe uma data e hora válidas.");
  }
  if (
    draft.availableAt instanceof Date &&
    draft.expiresAt instanceof Date &&
    draft.expiresAt <= draft.availableAt
  ) {
    return formError(
      "expiresAt",
      "O fim do período deve ser posterior ao início."
    );
  }
  if (
    draft.publishMode === "schedule" &&
    (!(draft.availableAt instanceof Date) || draft.availableAt <= now)
  ) {
    return formError(
      "availableAt",
      "Para agendar, escolha uma data futura no início do período."
    );
  }
  return null;
};

const validateIdempotencyKey = (key: string | null, creating: boolean) =>
  creating && !key
    ? formError(
        "idempotencyKey",
        "Atualize a página antes de salvar uma nova coleção."
      )
    : null;

const validateCollectionWriteDraft = (
  draft: CollectionWriteDraft,
  options: { readonly creating: boolean; readonly now?: Date }
) =>
  validateTitle(draft.title) ??
  validateDescription(draft.description) ??
  validateCover(draft) ??
  validateAudience(draft.audienceSpaceId) ??
  validatePeriod(draft, options.now ?? new Date()) ??
  validateIdempotencyKey(draft.idempotencyKey, options.creating);

export const parseGestaoCollectionWriteInput = (
  formData: FormData,
  options: { readonly creating: boolean; readonly now?: Date }
): GestaoCollectionWriteResult => {
  const draft = readCollectionWriteDraft(formData);
  const validationError = validateCollectionWriteDraft(draft, options);
  if (validationError) {
    return { ok: false, state: validationError };
  }

  return {
    input: {
      audienceSpaceId: draft.audienceSpaceId,
      availableAt: draft.availableAt instanceof Date ? draft.availableAt : null,
      coverFile: draft.coverFile,
      coverUrl: draft.coverUrl,
      description: draft.description || null,
      expiresAt: draft.expiresAt instanceof Date ? draft.expiresAt : null,
      idempotencyKey: draft.idempotencyKey,
      publishMode: draft.publishMode,
      title: draft.title,
    },
    ok: true,
  };
};
