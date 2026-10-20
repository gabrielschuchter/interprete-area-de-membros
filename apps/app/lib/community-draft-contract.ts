export interface CommunityDraftSnapshot {
  readonly content: string;
  readonly contentJson: unknown;
  readonly coverUrl: string | null;
  readonly spaceId: string | null;
  readonly subtitle: string | null;
  readonly tags: readonly string[];
  readonly title: string;
}

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};

export const hasCommunityDraftContent = (
  snapshot: Pick<
    CommunityDraftSnapshot,
    "content" | "coverUrl" | "subtitle" | "tags" | "title"
  > & { readonly spaceId?: string | null },
  emptyTitle = "Rascunho sem título"
) =>
  Boolean(snapshot.title.trim() && snapshot.title.trim() !== emptyTitle) ||
  Boolean(snapshot.subtitle?.trim()) ||
  Boolean(snapshot.coverUrl?.trim()) ||
  snapshot.tags.some((tag) => tag.trim().length > 0) ||
  Boolean(snapshot.content.trim());

export const communityDraftSnapshotsEqual = (
  left: CommunityDraftSnapshot,
  right: CommunityDraftSnapshot
) =>
  left.content === right.content &&
  stableJson(left.contentJson) === stableJson(right.contentJson) &&
  left.coverUrl === right.coverUrl &&
  left.spaceId === right.spaceId &&
  left.subtitle === right.subtitle &&
  stableJson(left.tags) === stableJson(right.tags) &&
  left.title === right.title;

export const nextCommunityPostVersion = (expected: Date, now = Date.now()) =>
  new Date(Math.max(now, expected.getTime() + 1));
