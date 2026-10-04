import {
  libraryCatalog,
  libraryCatalogCategories,
} from "@repo/database/library-catalog";
import { describe, expect, it } from "vitest";

const HTTPS_URL_PATTERN = /^https:\/\//;

describe("curadoria da biblioteca", () => {
  it("mantém URLs HTTPS únicas e metadados de acesso completos", () => {
    const urls = libraryCatalog.map(({ url }) => url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(libraryCatalog.length).toBeGreaterThanOrEqual(100);

    for (const item of libraryCatalog) {
      expect(() => new URL(item.url)).not.toThrow();
      expect(item.url).toMatch(HTTPS_URL_PATTERN);
      expect(item.title.trim()).not.toBe("");
      expect(item.authors.trim()).not.toBe("");
      expect(item.category.trim()).not.toBe("");
      expect(item.description.trim()).not.toBe("");
      expect(item.language.trim()).not.toBe("");
      expect(item.accessNote.trim()).not.toBe("");
      expect(item.tags.length).toBeGreaterThan(0);
      expect(item.linkCheckedAt.getTime()).toBeLessThanOrEqual(Date.now());
    }
  });

  it("não duplica identificadores bibliográficos e inclui referências em português", () => {
    const dois = libraryCatalog.flatMap(({ doi }) =>
      doi ? [doi.toLowerCase()] : []
    );
    const pmids = libraryCatalog.flatMap(({ pmid }) => (pmid ? [pmid] : []));

    expect(new Set(dois).size).toBe(dois.length);
    expect(new Set(pmids).size).toBe(pmids.length);
    expect(libraryCatalog.some(({ language }) => language.includes("pt"))).toBe(
      true
    );
    expect(libraryCatalogCategories.length).toBeGreaterThanOrEqual(12);
  });

  it("usa apenas categorias controladas e cobre os protocolos metodológicos centrais", () => {
    expect(new Set(libraryCatalogCategories).size).toBe(
      libraryCatalogCategories.length
    );

    for (const item of libraryCatalog) {
      expect(libraryCatalogCategories).toContain(item.category);
    }

    const catalogText = libraryCatalog
      .map(({ title, tags }) => `${title} ${tags.join(" ")}`.toLowerCase())
      .join(" ");
    for (const requiredTerm of [
      "pico",
      "pubmed",
      "embase",
      "cochrane",
      "press",
      "rob2",
      "robins-i",
      "quadas-3",
      "amstar 2",
      "grade",
      "prisma",
      "consort 2025",
      "spirit 2025",
      "strobe",
      "nutrition",
    ]) {
      expect(catalogText).toContain(requiredTerm);
    }
  });
});
