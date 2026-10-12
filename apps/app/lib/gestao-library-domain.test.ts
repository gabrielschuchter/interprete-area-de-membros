import { describe, expect, it } from "vitest";
import {
  buildGestaoLibraryHref,
  normalizeGestaoLibraryFilters,
} from "./gestao-library-domain";

describe("Gestao library catalog filters", () => {
  it("normalizes untrusted query values and bounds pagination", () => {
    expect(
      normalizeGestaoLibraryFilters({
        page: "999999",
        query: ` ${"x".repeat(130)} `,
        status: "DELETED",
        view: "masonry",
      })
    ).toMatchObject({
      page: 10_000,
      query: "x".repeat(120),
      status: "ALL",
      view: "list",
    });
  });

  it("omits defaults and preserves active filters when changing page or view", () => {
    const filters = normalizeGestaoLibraryFilters({
      category: "Diretrizes",
      page: "1",
      query: "avaliação",
      status: "PUBLISHED",
      view: "list",
    });
    expect(
      buildGestaoLibraryHref("/gestao/ensino/biblioteca", filters, {
        page: 2,
        view: "grid",
      })
    ).toBe(
      "/gestao/ensino/biblioteca?q=avalia%C3%A7%C3%A3o&categoria=Diretrizes&estado=PUBLISHED&modo=grid&pagina=2"
    );
  });
});
