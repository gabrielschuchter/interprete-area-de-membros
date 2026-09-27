export const COMMUNITY_POST_KIND_OPTIONS = [
  {
    value: "PUBLICATION",
    label: "Publicação",
  },
  {
    value: "DISCUSSION",
    label: "Discussão",
  },
  {
    value: "QUESTION",
    label: "Pergunta",
  },
  {
    value: "CASE",
    label: "Caso",
  },
  {
    value: "ARTICLE",
    label: "Artigo",
  },
  {
    value: "RESOURCE",
    label: "Recurso",
  },
] as const;

export type CommunityPostKindValue =
  (typeof COMMUNITY_POST_KIND_OPTIONS)[number]["value"];

const communityPostKindLabels = new Map<string, string>(
  COMMUNITY_POST_KIND_OPTIONS.map(({ label, value }) => [value, label])
);

export const communityPostKindLabel = (kind: string) =>
  communityPostKindLabels.get(kind) ?? "Discussão";

export const communityPostKindLowerLabel = (kind: string) =>
  communityPostKindLabel(kind).toLocaleLowerCase("pt-BR");

export const communityPostKindHasSubtitle = (kind: string) =>
  kind !== "DISCUSSION" && kind !== "QUESTION";
