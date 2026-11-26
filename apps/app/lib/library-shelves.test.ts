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

  it("com uma categoria escolhida, mostra só a estante dela com todos os livros registrados nela", () => {
    const shelves = groupLibraryShelves(
      [
        item("a", "Revisões sistemáticas e busca"),
        item("b", "Busca da evidência"),
        item("c", "Fundamentos da PBE e busca"),
        item("solto", null),
      ],
      "Busca da evidência"
    );

    expect(shelves.map(({ label }) => label)).toEqual(["Busca da evidência"]);
    expect(shelves[0]?.items.map(({ id }) => id)).toEqual(["a", "b", "c"]);
  });

  it("dá ilustração própria a busca, registros e risco de viés", () => {
    const art = (category: string) =>
      groupLibraryShelves([item("x", category)])[0]?.art;

    expect(art("Busca da evidência")).toBe("/library/shelves/busca.webp");
    expect(art("Registros de protocolo")).toBe(
      "/library/shelves/registros.webp"
    );
    expect(art("Risco de viés")).toBe("/library/shelves/risco-de-vies.webp");
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
    expect(libraryCoverTitleSize("abc ".repeat(10))).toBe(19);
    expect(libraryCoverTitleSize("abc ".repeat(18))).toBe(16);
    expect(libraryCoverTitleSize("abc ".repeat(30))).toBe(14);
    expect(libraryCoverTitleSize("GRADE Handbook", true)).toBeGreaterThan(22);
  });

  it("encolhe o título quando uma palavra é comprida demais para a capa", () => {
    expect(libraryCoverTitleSize("ClinicalTrials.gov")).toBe(13);
    expect(libraryCoverTitleSize("Interpretation")).toBeLessThan(22);
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
