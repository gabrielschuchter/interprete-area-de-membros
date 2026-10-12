import { describe, expect, it } from "vitest";
import {
  buildGestaoCollectionsHref,
  normalizeGestaoCollectionFilters,
  parseGestaoCollectionWriteInput,
} from "./gestao-collections-domain";

const validCollectionForm = () => {
  const form = new FormData();
  form.set("title", "Prática baseada em evidências");
  form.set("description", "Uma curadoria para a próxima conversa.");
  form.set("coverUrl", "/brand/learning/evidence-screen.png");
  form.set("audienceSpaceId", "");
  form.set("availableAt", "");
  form.set("expiresAt", "");
  form.set("publishMode", "now");
  form.set("idempotencyKey", "550e8400-e29b-41d4-a716-446655440000");
  return form;
};

describe("Gestao collection filters", () => {
  it("bounds untrusted search and pagination values", () => {
    expect(
      normalizeGestaoCollectionFilters({
        page: "999999",
        query: ` ${"x".repeat(130)} `,
        status: "DELETED",
      })
    ).toEqual({ page: 10_000, query: "x".repeat(120), status: "ALL" });
  });

  it("preserves active filters while changing page", () => {
    const filters = normalizeGestaoCollectionFilters({
      page: "1",
      query: "avaliação clínica",
      status: "PUBLISHED",
    });
    expect(
      buildGestaoCollectionsHref("/gestao/ensino/colecoes", filters, {
        page: 2,
      })
    ).toBe(
      "/gestao/ensino/colecoes?q=avalia%C3%A7%C3%A3o+cl%C3%ADnica&estado=PUBLISHED&pagina=2"
    );
  });

  it("rejects calendar values JavaScript would otherwise normalize", () => {
    const form = validCollectionForm();
    form.set("availableAt", "2026-02-31T09:00");
    expect(
      parseGestaoCollectionWriteInput(form, {
        creating: true,
        now: new Date("2026-01-01T12:00:00-03:00"),
      })
    ).toMatchObject({
      ok: false,
      state: { fieldErrors: { availableAt: expect.any(String) } },
    });
  });
});

describe("Gestao collection form validation", () => {
  it("requires a title and a valid idempotency key for a new collection", () => {
    const missingTitle = validCollectionForm();
    missingTitle.set("title", " ");
    expect(
      parseGestaoCollectionWriteInput(missingTitle, { creating: true })
    ).toMatchObject({
      ok: false,
      state: { fieldErrors: { title: expect.any(String) } },
    });

    const missingKey = validCollectionForm();
    missingKey.set("idempotencyKey", "invalid");
    expect(
      parseGestaoCollectionWriteInput(missingKey, { creating: true })
    ).toMatchObject({
      ok: false,
      state: { fieldErrors: { idempotencyKey: expect.any(String) } },
    });
  });

  it("rejects unsafe image URLs and invalid date ranges", () => {
    const unsafeCover = validCollectionForm();
    unsafeCover.set("coverUrl", "javascript:alert(1)");
    expect(
      parseGestaoCollectionWriteInput(unsafeCover, { creating: true })
    ).toMatchObject({
      ok: false,
      state: { fieldErrors: { coverUrl: expect.any(String) } },
    });

    const invalidRange = validCollectionForm();
    invalidRange.set("availableAt", "2026-10-20T12:00");
    invalidRange.set("expiresAt", "2026-10-20T11:00");
    expect(
      parseGestaoCollectionWriteInput(invalidRange, {
        creating: true,
        now: new Date("2026-10-12T12:00:00-03:00"),
      })
    ).toMatchObject({
      ok: false,
      state: { fieldErrors: { expiresAt: expect.any(String) } },
    });
  });

  it("requires a future start when the editor is set to schedule", () => {
    const form = validCollectionForm();
    form.set("publishMode", "schedule");
    form.set("availableAt", "2026-10-13T09:00");
    expect(
      parseGestaoCollectionWriteInput(form, {
        creating: true,
        now: new Date("2026-10-12T12:00:00-03:00"),
      })
    ).toMatchObject({ ok: true });

    form.set("availableAt", "2026-10-11T09:00");
    expect(
      parseGestaoCollectionWriteInput(form, {
        creating: true,
        now: new Date("2026-10-12T12:00:00-03:00"),
      })
    ).toMatchObject({
      ok: false,
      state: { fieldErrors: { availableAt: expect.any(String) } },
    });
  });
});
