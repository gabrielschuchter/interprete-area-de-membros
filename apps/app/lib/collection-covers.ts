export const collectionCoverPresets = [
  {
    label: "Evidência e decisões",
    value: "/brand/learning/evidence-screen.png",
  },
  {
    label: "Leitura e prática",
    value: "/brand/learning/reading-notes.png",
  },
  { label: "Estante editorial", value: "/brand/library/study-books.png" },
  { label: "Encontro ao vivo", value: "/brand/meetings/classroom.png" },
] as const;

const bundledCoverPaths = new Set<string>(
  collectionCoverPresets.map((cover) => cover.value)
);

export const isAllowedCollectionCoverUrl = (value: string) => {
  if (!value || bundledCoverPaths.has(value)) {
    return true;
  }

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};
