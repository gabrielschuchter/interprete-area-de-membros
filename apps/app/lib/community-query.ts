import type { CommunityPostKindValue } from "./community-post-types";

export const COMMUNITY_SORT_OPTIONS = [
  { value: "recent", label: "Recentes" },
  { value: "popular", label: "Em alta" },
  { value: "unanswered", label: "Sem resposta" },
] as const;

export type CommunitySort = (typeof COMMUNITY_SORT_OPTIONS)[number]["value"];

export const COMMUNITY_KIND_FILTER_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "QUESTION", label: "Perguntas" },
  { value: "DISCUSSION", label: "Discussões" },
  { value: "CASE", label: "Casos" },
  { value: "ARTICLE", label: "Artigos" },
  { value: "RESOURCE", label: "Recursos" },
  { value: "PUBLICATION", label: "Publicações" },
] as const satisfies readonly {
  label: string;
  value: "ALL" | CommunityPostKindValue;
}[];

export const parseCommunitySort = (value: string | undefined): CommunitySort =>
  COMMUNITY_SORT_OPTIONS.some((option) => option.value === value)
    ? (value as CommunitySort)
    : "recent";

export const parseCommunityKind = (
  value: string | undefined
): CommunityPostKindValue | undefined => {
  if (!value || value === "ALL") {
    return undefined;
  }

  return COMMUNITY_KIND_FILTER_OPTIONS.some((option) => option.value === value)
    ? (value as CommunityPostKindValue)
    : undefined;
};

interface CommunityHrefOptions {
  readonly kind?: CommunityPostKindValue;
  readonly page?: number;
  readonly query?: string;
  readonly sort?: CommunitySort;
  readonly spaceSlug?: string;
}

export const communityHref = ({
  kind,
  page,
  query,
  sort = "recent",
  spaceSlug,
}: CommunityHrefOptions = {}) => {
  const params = new URLSearchParams();
  const normalizedQuery = query?.trim();

  if (normalizedQuery) {
    params.set("q", normalizedQuery.slice(0, 100));
  }
  if (sort !== "recent") {
    params.set("sort", sort);
  }
  if (kind) {
    params.set("kind", kind);
  }
  if (spaceSlug) {
    params.set("space", spaceSlug);
  }
  if (page && page > 1) {
    params.set("page", String(page));
  }

  const search = params.toString();
  return search ? `/comunidade?${search}` : "/comunidade";
};
