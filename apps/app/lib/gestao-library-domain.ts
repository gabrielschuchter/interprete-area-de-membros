export type GestaoLibraryStatus = "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type GestaoLibraryView = "list" | "grid";

const statuses = new Set<GestaoLibraryStatus>([
  "ALL",
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);
const views = new Set<GestaoLibraryView>(["list", "grid"]);

export interface GestaoLibraryFilters {
  readonly category: string;
  readonly difficulty: string;
  readonly kind: string;
  readonly language: string;
  readonly page: number;
  readonly query: string;
  readonly status: GestaoLibraryStatus;
  readonly view: GestaoLibraryView;
}

export const normalizeGestaoLibraryFilters = (input: {
  readonly category?: string;
  readonly difficulty?: string;
  readonly kind?: string;
  readonly language?: string;
  readonly page?: string;
  readonly query?: string;
  readonly status?: string;
  readonly view?: string;
}): GestaoLibraryFilters => {
  const requestedPage = Number(input.page);
  return {
    category: (input.category ?? "").trim().slice(0, 80),
    difficulty: (input.difficulty ?? "").trim().slice(0, 24),
    kind: (input.kind ?? "").trim().slice(0, 24),
    language: (input.language ?? "").trim().slice(0, 16),
    page:
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? Math.min(requestedPage, 10_000)
        : 1,
    query: (input.query ?? "").trim().slice(0, 120),
    status: statuses.has(input.status as GestaoLibraryStatus)
      ? (input.status as GestaoLibraryStatus)
      : "ALL",
    view: views.has(input.view as GestaoLibraryView)
      ? (input.view as GestaoLibraryView)
      : "list",
  };
};

export const buildGestaoLibraryHref = (
  pathname: string,
  filters: GestaoLibraryFilters,
  overrides: Partial<GestaoLibraryFilters> = {}
) => {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.query) {
    params.set("q", next.query);
  }
  if (next.kind) {
    params.set("tipo", next.kind);
  }
  if (next.category) {
    params.set("categoria", next.category);
  }
  if (next.language) {
    params.set("idioma", next.language);
  }
  if (next.difficulty) {
    params.set("nivel", next.difficulty);
  }
  if (next.status !== "ALL") {
    params.set("estado", next.status);
  }
  if (next.view !== "list") {
    params.set("modo", next.view);
  }
  if (next.page > 1) {
    params.set("pagina", String(next.page));
  }
  const search = params.toString();
  return `${pathname}${search ? `?${search}` : ""}`;
};
