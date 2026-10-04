export const COMMUNITY_SORT_OPTIONS = [
  { value: "recent", label: "Recentes" },
  { value: "popular", label: "Em alta" },
  { value: "unanswered", label: "Sem resposta" },
] as const;

export type CommunitySort = (typeof COMMUNITY_SORT_OPTIONS)[number]["value"];

export const parseCommunitySort = (value: string | undefined): CommunitySort =>
  COMMUNITY_SORT_OPTIONS.some((option) => option.value === value)
    ? (value as CommunitySort)
    : "recent";

interface CommunityHrefOptions {
  readonly page?: number;
  readonly query?: string;
  readonly sort?: CommunitySort;
  readonly spaceSlug?: string;
}

export const communityHref = ({
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
  if (spaceSlug) {
    params.set("space", spaceSlug);
  }
  if (page && page > 1) {
    params.set("page", String(page));
  }

  const search = params.toString();
  return search ? `/comunidade?${search}` : "/comunidade";
};
