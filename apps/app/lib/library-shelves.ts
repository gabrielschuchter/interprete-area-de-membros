import {
  libraryCategoryGroups,
  libraryCategoryGroupsFor,
} from "./library-categories";

/** Material da Biblioteca já reduzido ao que as estantes e o card precisam. */
export interface LibraryShelfItem {
  readonly accessType: string | null;
  readonly authors: string | null;
  readonly category: string | null;
  readonly description: string | null;
  readonly difficulty: string | null;
  readonly id: string;
  readonly isBookmarked: boolean;
  readonly kind: "ARTICLE" | "PDF" | "GUIDE" | "LINK" | "VIDEO";
  readonly language: string | null;
  readonly tags: readonly string[];
  readonly title: string;
  readonly titlePt: string | null;
  readonly version: string | null;
  readonly year: number | string | null;
}

export interface LibraryShelf {
  readonly art: string;
  readonly id: string;
  readonly items: readonly LibraryShelfItem[];
  readonly label: string;
}

const SHELF_ART_BY_GROUP: Readonly<Record<string, string>> = {
  "Bioestatística e interpretação": "/library/shelves/bioestatistica.webp",
  "Busca da evidência": "/library/shelves/busca.webp",
  "Diretrizes e decisão clínica": "/library/shelves/diretrizes.webp",
  "Epidemiologia e desenhos de estudo": "/library/shelves/epidemiologia.webp",
  "Fundamentos da PBE": "/library/shelves/fundamentos.webp",
  "Leitura crítica e certeza da evidência":
    "/library/shelves/leitura-critica.webp",
  "Nutrição baseada em evidências": "/library/shelves/nutricao.webp",
  "Registros de protocolo": "/library/shelves/registros.webp",
  "Relato e ciência aberta": "/library/shelves/relato.webp",
  "Revisões sistemáticas": "/library/shelves/revisoes-busca.webp",
  "Risco de viés": "/library/shelves/risco-de-vies.webp",
};

const FALLBACK_SHELF_ART = "/library/shelves/fundamentos.webp";
const UNCATEGORIZED_LABEL = "Outros materiais";

const slugify = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Agrupa os materiais em estantes, na ordem editorial das categorias. Um
 * material de categoria combinada aparece em cada estante a que pertence.
 */
export const groupLibraryShelves = (
  items: readonly LibraryShelfItem[],
  /** Com um grupo escolhido no filtro, mostra só a estante dele. */
  onlyGroup?: string
): LibraryShelf[] => {
  const categories = items.flatMap(({ category }) =>
    category?.trim() ? [category] : []
  );
  const shelves: LibraryShelf[] = libraryCategoryGroupsFor(categories)
    .filter((label) => !onlyGroup || label === onlyGroup)
    .map((label) => ({
      art: SHELF_ART_BY_GROUP[label] ?? FALLBACK_SHELF_ART,
      id: `estante-${slugify(label)}`,
      items: items.filter(
        ({ category }) =>
          category?.trim() && libraryCategoryGroups(category).includes(label)
      ),
      label,
    }));
  const loose = items.filter(({ category }) => !category?.trim());
  if (loose.length > 0 && !onlyGroup) {
    shelves.push({
      art: FALLBACK_SHELF_ART,
      id: `estante-${slugify(UNCATEGORIZED_LABEL)}`,
      items: loose,
      label: UNCATEGORIZED_LABEL,
    });
  }
  return shelves.filter((shelf) => shelf.items.length > 0);
};

export interface LibraryCoverPalette {
  readonly background: string;
  readonly foreground: string;
  readonly ornament: string;
  readonly spine: string;
}

const COVER_PALETTES: readonly LibraryCoverPalette[] = [
  {
    background: "#7a1232",
    foreground: "#F1EBE8",
    ornament: "#c8ad8d",
    spine: "#5a0c25",
  },
  {
    background: "#cf1a5c",
    foreground: "#F1EBE8",
    ornament: "#F6D9E2",
    spine: "#a5104a",
  },
  {
    background: "#e3b78f",
    foreground: "#5a0c25",
    ornament: "#8C1535",
    spine: "#b8916c",
  },
  {
    background: "#4a0f3a",
    foreground: "#EBD3DF",
    ornament: "#b98a6e",
    spine: "#350a29",
  },
  {
    background: "#efe4da",
    foreground: "#8C1535",
    ornament: "#d6587a",
    spine: "#c9bbb0",
  },
  {
    background: "#b4405a",
    foreground: "#F1EBE8",
    ornament: "#efe4da",
    spine: "#8f2f46",
  },
];

/** Cor estável por material: o mesmo livro tem sempre a mesma capa. */
export const libraryCoverPalette = (id: string): LibraryCoverPalette => {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 9973;
  }
  return COVER_PALETTES[hash % COVER_PALETTES.length] as LibraryCoverPalette;
};

/** Largura útil do título numa capa estreita, em px, e largura média de um caractere em em. */
const COVER_TEXT_WIDTH = 104;
const AVERAGE_CHAR_EM = 0.56;
const MIN_COVER_TITLE_SIZE = 13;
const WHITESPACE = /\s+/;

/**
 * Corpo do título impresso na capa: menor quanto mais longo o título e quanto
 * maior a palavra mais comprida, para nenhuma palavra quebrar no meio.
 */
export const libraryCoverTitleSize = (title: string, large = false) => {
  const text = title.trim();
  let size = 14;
  if (text.length <= 24) {
    size = 22;
  } else if (text.length <= 50) {
    size = 19;
  } else if (text.length <= 80) {
    size = 16;
  }
  const longestWord = Math.max(
    1,
    ...text.split(WHITESPACE).map((word) => word.length)
  );
  const fitting = Math.floor(
    COVER_TEXT_WIDTH / (AVERAGE_CHAR_EM * longestWord)
  );
  size = Math.min(size, Math.max(MIN_COVER_TITLE_SIZE, fitting));
  return large ? Math.round(size * 1.2) : size;
};

/** "Sackett DL; Rosenberg WMC; ..." vira "Sackett DL et al.". */
export const libraryShortAuthors = (authors: string | null) => {
  const names = (authors ?? "")
    .split(";")
    .map((name) => name.trim())
    .filter(Boolean);
  const [first] = names;
  if (!first) {
    return "";
  }
  return names.length > 1 && !first.toLowerCase().includes("et al")
    ? `${first} et al.`
    : first;
};

export const libraryDisplayTitle = (
  item: Pick<LibraryShelfItem, "title" | "titlePt">,
  translateTitles: boolean
) => (translateTitles ? item.titlePt?.trim() : undefined) || item.title;
