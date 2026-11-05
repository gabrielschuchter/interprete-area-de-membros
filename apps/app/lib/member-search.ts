const leadingAt = /^@+/u;
const combiningMarks = /\p{M}/gu;
const whitespaceRun = /\s+/u;

/** Texto digitado na busca de pessoas, sem o "@" inicial. */
export const memberSearchTerm = (query: string) =>
  query.trim().replace(leadingAt, "").trim().slice(0, 80);

/** Minúsculas e sem acentos: "João" e "joao" são a mesma busca. */
export const foldForSearch = (value: string) =>
  value.normalize("NFD").replace(combiningMarks, "").toLowerCase();

interface SearchableProfile {
  readonly displayName?: string | null;
  readonly headline?: string | null;
  readonly interests?: readonly string[];
  readonly username: string;
}

/**
 * Filtra e ordena perfis por nome, @username, título e interesses, ignorando
 * acentos. Cada palavra digitada precisa aparecer em algum desses campos; quem
 * começa pelo texto vem primeiro. A busca roda sobre um conjunto já limitado
 * pelo banco (diretório da comunidade), não sobre a tabela inteira.
 */
export const rankMemberMatches = <T extends SearchableProfile>(
  profiles: readonly T[],
  query: string
): T[] => {
  const term = foldForSearch(memberSearchTerm(query));
  if (!term) {
    return [...profiles];
  }
  const words = term.split(whitespaceRun).filter(Boolean);
  const scored: { readonly profile: T; readonly score: number }[] = [];
  for (const profile of profiles) {
    const name = foldForSearch(profile.displayName ?? "");
    const username = foldForSearch(profile.username);
    const haystack = [
      name,
      username,
      foldForSearch(profile.headline ?? ""),
      ...(profile.interests ?? []).map(foldForSearch),
    ].join(" ");
    if (!words.every((word) => haystack.includes(word))) {
      continue;
    }
    let score = 2;
    if (name.startsWith(term) || username.startsWith(term)) {
      score = 0;
    } else if (name.includes(term) || username.includes(term)) {
      score = 1;
    }
    scored.push({ profile, score });
  }
  return scored
    .sort((left, right) => left.score - right.score)
    .map(({ profile }) => profile);
};
