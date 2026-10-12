export const gestaoLibraryItemKinds = [
  "ARTICLE",
  "PDF",
  "GUIDE",
  "LINK",
  "VIDEO",
] as const;

export type GestaoLibraryItemKind = (typeof gestaoLibraryItemKinds)[number];

export const gestaoLibraryItemDifficulties = [
  "INTRODUCTORY",
  "INTERMEDIATE",
  "ADVANCED",
] as const;

export type GestaoLibraryItemDifficulty =
  (typeof gestaoLibraryItemDifficulties)[number];
