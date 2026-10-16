export const COMMUNITY_SORT_OPTIONS = [
  { value: "recent", label: "Recentes" },
  { value: "popular", label: "Em alta" },
  { value: "unanswered", label: "Sem resposta" },
] as const;

export type CommunitySort = (typeof COMMUNITY_SORT_OPTIONS)[number]["value"];

const returnUrlSeparatorPattern = /[?#]/;

export const COMMUNITY_KIND_OPTIONS = [
  { value: "DISCUSSION", label: "Discussões" },
  { value: "QUESTION", label: "Perguntas" },
  { value: "CASE", label: "Casos" },
  { value: "ARTICLE", label: "Artigos" },
  { value: "RESOURCE", label: "Recursos" },
  { value: "PUBLICATION", label: "Publicações" },
] as const;

export type CommunityKind = (typeof COMMUNITY_KIND_OPTIONS)[number]["value"];

export const parseCommunityKind = (
  value: string | undefined
): CommunityKind | undefined =>
  COMMUNITY_KIND_OPTIONS.some((option) => option.value === value)
    ? (value as CommunityKind)
    : undefined;

export const parseCommunitySort = (value: string | undefined): CommunitySort =>
  COMMUNITY_SORT_OPTIONS.some((option) => option.value === value)
    ? (value as CommunitySort)
    : "recent";

interface CommunityHrefOptions {
  readonly cursor?: string;
  readonly kind?: CommunityKind;
  readonly page?: number;
  readonly query?: string;
  readonly sort?: CommunitySort;
  readonly spaceSlug?: string;
}

export const communityHref = ({
  cursor,
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
  if (kind) {
    params.set("tipo", kind);
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
  if (cursor) {
    params.set("cursor", cursor);
  }

  const search = params.toString();
  return search ? `/comunidade?${search}` : "/comunidade";
};

export const communitySavedHref = ({
  cursor,
  kind,
  query,
}: {
  readonly cursor?: string;
  readonly kind?: CommunityKind;
  readonly query?: string;
}) => {
  const params = new URLSearchParams();
  const normalizedQuery = query?.trim();
  if (normalizedQuery) {
    params.set("q", normalizedQuery.slice(0, 100));
  }
  if (kind) {
    params.set("tipo", kind);
  }
  if (cursor) {
    params.set("cursor", cursor);
  }
  const search = params.toString();
  return search ? `/comunidade/salvos?${search}` : "/comunidade/salvos";
};

export const parseCommunityReturnTo = (value: string | undefined) => {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return undefined;
  }
  const path = value.split(returnUrlSeparatorPattern, 1)[0];
  return path === "/salvos" ||
    path === "/comunidade" ||
    path?.startsWith("/comunidade/") === true
    ? value
    : undefined;
};

export const communityReturnLabel = (value: string | undefined) => {
  const returnTo = parseCommunityReturnTo(value);
  const path = returnTo?.split(returnUrlSeparatorPattern, 1)[0];

  if (
    path === "/salvos" ||
    path === "/comunidade/salvos" ||
    path?.startsWith("/comunidade/salvos/") === true
  ) {
    return "Salvos";
  }
  if (
    path === "/comunidade/grupos" ||
    path?.startsWith("/comunidade/grupos/") === true
  ) {
    return "Grupos de estudo";
  }
  if (
    path === "/comunidade/encontros" ||
    path?.startsWith("/comunidade/encontros/") === true
  ) {
    return "Encontros";
  }
  if (
    path === "/comunidade/minhas-publicacoes" ||
    path?.startsWith("/comunidade/minhas-publicacoes/") === true
  ) {
    return "Minhas publicações";
  }
  if (path === "/comunidade") {
    return "Explorar";
  }
  return undefined;
};
