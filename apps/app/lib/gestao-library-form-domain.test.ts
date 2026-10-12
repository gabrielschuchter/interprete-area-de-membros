import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
  LibraryItemAccessType: {
    FREE_TO_READ: "FREE_TO_READ",
    FREE_TOOL: "FREE_TOOL",
    OPEN_ACCESS: "OPEN_ACCESS",
  },
  LibraryItemDifficulty: {
    ADVANCED: "ADVANCED",
    INTERMEDIATE: "INTERMEDIATE",
    INTRODUCTORY: "INTRODUCTORY",
  },
  LibraryItemKind: {
    ARTICLE: "ARTICLE",
    GUIDE: "GUIDE",
    LINK: "LINK",
    PDF: "PDF",
    VIDEO: "VIDEO",
  },
}));

import { parseLibraryItemInput } from "./gestao-library-form-domain";

const validForm = () => {
  const form = new FormData();
  form.set("title", "Referência de teste");
  form.set("kind", "ARTICLE");
  form.set("url", "https://example.org/reference");
  form.set("idempotencyKey", "550e8400-e29b-41d4-a716-446655440000");
  return form;
};

const parse = (form: FormData, requireSource = true) =>
  parseLibraryItemInput(form, {
    requireIdempotencyKey: true,
    requireSource,
  });

describe("Gestao library form validation", () => {
  it("returns a field error for a missing title", () => {
    const form = validForm();
    form.delete("title");

    expect(parse(form)).toMatchObject({
      ok: false,
      state: { fieldErrors: { title: expect.any(String) }, status: "error" },
    });
  });

  it("requires either a valid source link or an uploaded file", () => {
    const form = validForm();
    form.delete("url");

    expect(parse(form)).toMatchObject({
      ok: false,
      state: { fieldErrors: { url: expect.any(String) } },
    });
  });

  it("rejects unsafe source and cover URLs", () => {
    const unsafeSource = validForm();
    unsafeSource.set("url", "javascript:alert(1)");
    expect(parse(unsafeSource)).toMatchObject({
      ok: false,
      state: { fieldErrors: { url: expect.any(String) } },
    });

    const unsafeCover = validForm();
    unsafeCover.set("coverUrl", "http://example.org/cover.png");
    expect(parse(unsafeCover)).toMatchObject({
      ok: false,
      state: { fieldErrors: { coverUrl: expect.any(String) } },
    });
  });

  it("rejects invalid year and language metadata", () => {
    const invalidYear = validForm();
    invalidYear.set("year", "999");
    expect(parse(invalidYear)).toMatchObject({
      ok: false,
      state: { fieldErrors: { year: expect.any(String) } },
    });

    const invalidLanguage = validForm();
    invalidLanguage.set("language", "pt,not_a_language");
    expect(parse(invalidLanguage)).toMatchObject({
      ok: false,
      state: { fieldErrors: { language: expect.any(String) } },
    });
  });

  it("requires a well-formed idempotency key on creation", () => {
    const form = validForm();
    form.set("idempotencyKey", "not-a-uuid");

    expect(parse(form)).toMatchObject({
      ok: false,
      state: { fieldErrors: { id: expect.any(String) } },
    });
  });

  it("normalizes language codes, tags, and source URLs", () => {
    const form = validForm();
    form.set("url", "https://example.org/reference");
    form.set("language", "PT / en-us");
    form.set("tags", " Terapia, CLÍNICA, terapia ");

    const result = parse(form);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.language).toBe("pt,en-us");
      expect(result.input.tags).toEqual(["terapia", "clínica"]);
      expect(result.input.url).toBe("https://example.org/reference");
    }
  });
});
