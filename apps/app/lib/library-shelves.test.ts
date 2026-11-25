import { describe, expect, it } from "vitest";
import {
  groupLibraryShelves,
  type LibraryShelfItem,
  libraryCoverPalette,
  libraryCoverTitleSize,
  libraryDisplayTitle,
  libraryShortAuthors,
} from "./library-shelves";

const item = (
  id: string,
  category: string | null,
  overrides: Partial<LibraryShelfItem> = {}
): LibraryShelfItem => ({
  accessType: null,
  authors: null,
  category,
  coverUrl: null,
  description: null,
  difficulty: null,
  id,
  isBookmarked: false,
  kind: "ARTICLE",
  language: "en",
  tags: [],
  title: `Título ${id}`,
  titlePt: null,
  version: null,
  year: null,
  ...overrides,
});

describe("groupLibraryShelves", () => {
  it("segue a ordem editorial e junta apelidos antigos na mesma estante", () => {
    const shelves = groupLibraryShelves([
      item("nut", "Evidence-Based Nutrition"),
      item("fund", "Fundamentos da PBE"),
      item("nut2", "Nutrição baseada em evidências"),
    ]);

    expect(shelves.map(({ label }) => label)).toEqual([
      "Fundamentos da PBE",
      "Nutrição baseada em evidências",
    ]);
    expect(shelves[1]?.items.map(({ id }) => id)).toEqual(["nut", "nut2"]);
  });

  it("coloca o material de categoria combinada em cada estante dele", () => {
    const shelves = groupLibraryShelves([
      item("a", "Revisões sistemáticas e busca"),
      item("b", "Revisões sistemáticas"),
    ]);
    const byLabel = Object.fromEntries(
      shelves.map(({ label, items }) => [label, items.map(({ id }) => id)])
    );

    expect(byLabel["Revisões sistemáticas"]).toEqual(["a", "b"]);
    expect(byLabel["Busca da evidência"]).toEqual(["a"]);
  });

  it("reúne materiais sem categoria numa estante própria, no fim", () => {
    const shelves = groupLibraryShelves([
      item("solto", null),
      item("fund", "Fundamentos da PBE"),
    ]);

    expect(shelves.at(-1)?.label).toBe("Outros materiais");
    expect(shelves.at(-1)?.items.map(({ id }) => id)).toEqual(["solto"]);
  });

  it("dá arte e id estáveis a cada estante", () => {
    const [shelf] = groupLibraryShelves([item("rob", "Risco de viés")]);

    expect(shelf?.id).toBe("estante-risco-de-vies");
    expect(shelf?.art.startsWith("/library/shelves/")).toBe(true);
    expect(shelf?.art.endsWith(".webp")).toBe(true);
  });

  it("não cria estante vazia", () => {
    expect(groupLibraryShelves([])).toEqual([]);
  });
});

describe("capa com título", () => {
  it("escolhe sempre a mesma paleta para o mesmo material", () => {
    expect(libraryCoverPalette("abc")).toEqual(libraryCoverPalette("abc"));
  });

  it("reduz o corpo do título conforme o tamanho do texto", () => {
    expect(libraryCoverTitleSize("GRADE Handbook")).toBe(22);
    expect(libraryCoverTitleSize("x".repeat(40))).toBe(19);
    expect(libraryCoverTitleSize("x".repeat(70))).toBe(16);
    expect(libraryCoverTitleSize("x".repeat(120))).toBe(14);
    expect(libraryCoverTitleSize("GRADE Handbook", true)).toBeGreaterThan(22);
  });

  it("abrevia os autores", () => {
    expect(libraryShortAuthors("Sackett DL; Rosenberg WMC; Gray JAM")).toBe(
      "Sackett DL et al."
    );
    expect(libraryShortAuthors("Starmer J")).toBe("Starmer J");
    expect(libraryShortAuthors(null)).toBe("");
  });

  it("usa o título em português só quando pedido e cadastrado", () => {
    const material = item("t", null, { titlePt: " Manual GRADE " });

    expect(libraryDisplayTitle(material, true)).toBe("Manual GRADE");
    expect(libraryDisplayTitle(material, false)).toBe("Título t");
    expect(libraryDisplayTitle(item("u", null), true)).toBe("Título u");
  });
});
