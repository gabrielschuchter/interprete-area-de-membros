export interface LibraryPopularitySignals {
  readonly bookmarks: number;
  readonly openCount: number;
  readonly uniqueVisitors: number;
}

export interface LibrarySearchFields {
  readonly authors: string | null;
  readonly description: string | null;
  readonly tags: readonly string[];
  readonly title: string;
}

export const libraryPopularityScore = ({
  bookmarks,
  openCount,
  uniqueVisitors,
}: LibraryPopularitySignals) =>
  uniqueVisitors * 6 + bookmarks * 4 + Math.max(0, openCount - uniqueVisitors);

export const librarySearchScore = (
  fields: LibrarySearchFields,
  query: string
) => {
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  if (!normalized) {
    return 0;
  }
  let score = fields.title.toLocaleLowerCase("pt-BR").includes(normalized)
    ? 6
    : 0;
  if (fields.authors?.toLocaleLowerCase("pt-BR").includes(normalized)) {
    score += 3;
  }
  if (fields.description?.toLocaleLowerCase("pt-BR").includes(normalized)) {
    score += 2;
  }
  if (
    fields.tags.some((tag) =>
      tag.toLocaleLowerCase("pt-BR").includes(normalized)
    )
  ) {
    score += 4;
  }
  return score;
};
