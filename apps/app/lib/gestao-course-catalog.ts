export type GestaoCourseState =
  | "DRAFT"
  | "SCHEDULED"
  | "PUBLISHED"
  | "ARCHIVED";
export type GestaoCourseStatusFilter = "ALL" | GestaoCourseState;
export type GestaoCourseView = "LIST" | "GRID";

export interface GestaoCourseStateInput {
  readonly publishedAt: Date | null;
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export const resolveGestaoCourseState = (
  course: GestaoCourseStateInput,
  now: Date
): GestaoCourseState => {
  if (course.status === "PUBLISHED" || course.status === "ARCHIVED") {
    return course.status;
  }
  return course.publishedAt && course.publishedAt > now ? "SCHEDULED" : "DRAFT";
};

export const normalizeGestaoCourseFilters = (input: {
  readonly page?: number;
  readonly pathId?: string;
  readonly query?: string;
  readonly status?: string;
  readonly view?: string;
}) => ({
  page: Math.max(1, Math.trunc(input.page ?? 1)),
  pathId: input.pathId?.trim().slice(0, 255) || "ALL",
  query: input.query?.trim().slice(0, 120) ?? "",
  status: (
    ["ALL", "DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const
  ).includes(input.status as GestaoCourseStatusFilter)
    ? (input.status as GestaoCourseStatusFilter)
    : "ALL",
  view: input.view === "GRID" ? "GRID" : "LIST",
});

export const gestaoCourseStatusWhere = (
  status: GestaoCourseStatusFilter,
  now: Date
) => {
  switch (status) {
    case "DRAFT":
      return {
        status: "DRAFT" as const,
        OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
      };
    case "SCHEDULED":
      return { status: "DRAFT" as const, publishedAt: { gt: now } };
    case "PUBLISHED":
      return { status: "PUBLISHED" as const };
    case "ARCHIVED":
      return { status: "ARCHIVED" as const };
    default:
      return {};
  }
};
