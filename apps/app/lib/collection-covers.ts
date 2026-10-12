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

  if (value.startsWith("/api/member-assets?")) {
    try {
      const url = new URL(value, "https://interprete.local");
      const path = url.searchParams.get("path");
      const hasOnlyPath =
        url.pathname === "/api/member-assets" &&
        url.searchParams.size === 1 &&
        url.searchParams.has("path");
      const isControlledImagePath =
        typeof path === "string" &&
        !path.includes("..") &&
        !path.startsWith("/") &&
        (path.startsWith("community-assets/covers/") ||
          path.startsWith("library-assets/"));
      return (
        hasOnlyPath &&
        isControlledImagePath &&
        value === `/api/member-assets?path=${encodeURIComponent(path)}`
      );
    } catch {
      return false;
    }
  }

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export const collectionCoverStyle = (value: string | null) => {
  if (!(value && isAllowedCollectionCoverUrl(value))) {
    return undefined;
  }
  try {
    let url: string | null = null;
    if (value.startsWith("/")) {
      url = value;
    } else if (new URL(value).protocol === "https:") {
      url = value;
    }
    if (!url) {
      return undefined;
    }
    const safe = url
      .replaceAll('"', "%22")
      .replaceAll("(", "%28")
      .replaceAll(")", "%29");
    return { backgroundImage: `url("${safe}")` };
  } catch {
    return undefined;
  }
};
