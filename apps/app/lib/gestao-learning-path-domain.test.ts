import { describe, expect, it } from "vitest";
import { collectionCoverPresets } from "@/lib/collection-covers";
import {
  isGestaoLearningPathStatusTransitionAllowed,
  parseGestaoLearningPathWrite,
} from "./gestao-learning-path-domain";

const pathForm = (values: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
};

describe("parseGestaoLearningPathWrite", () => {
  it("trims content and normalizes the public slug", () => {
    expect(
      parseGestaoLearningPathWrite(
        pathForm({
          title: "  Fundamentos da PBE  ",
          slug: " Fundamentos-PBE ",
          description: "  Uma jornada.  ",
        })
      )
    ).toEqual({
      input: {
        coverUrl: null,
        description: "Uma jornada.",
        slug: "fundamentos-pbe",
        title: "Fundamentos da PBE",
      },
      ok: true,
    });
  });

  it("returns field errors for invalid title, slug and long descriptions", () => {
    const description = "x".repeat(5001);
    const result = parseGestaoLearningPathWrite(
      pathForm({ title: "x", slug: "-PBE-", description })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected invalid path input");
    }
    expect(result.fieldErrors).toEqual({
      title: "Informe um título entre 2 e 120 caracteres.",
      slug: "Use letras minúsculas, números e hífens, sem hífen no início ou no fim.",
      description: "A descrição pode ter até 5.000 caracteres.",
    });
  });

  it("accepts a controlled cover and rejects an unsafe cover URL", () => {
    const valid = parseGestaoLearningPathWrite(
      pathForm({
        title: "Fundamentos da PBE",
        slug: "fundamentos-pbe",
        description: "",
        coverUrl: collectionCoverPresets[0].value,
      })
    );
    expect(valid).toMatchObject({
      ok: true,
      input: { coverUrl: collectionCoverPresets[0].value },
    });

    const invalid = parseGestaoLearningPathWrite(
      pathForm({
        title: "Fundamentos da PBE",
        slug: "fundamentos-pbe",
        description: "",
        coverUrl: "javascript:alert(1)",
      })
    );
    expect(invalid).toMatchObject({
      ok: false,
      fieldErrors: { coverUrl: "Escolha uma capa válida da biblioteca." },
    });
  });
});

describe("isGestaoLearningPathStatusTransitionAllowed", () => {
  it("requires an explicit publication after a path is archived", () => {
    expect(
      isGestaoLearningPathStatusTransitionAllowed("ARCHIVED", "DRAFT")
    ).toBe(true);
    expect(
      isGestaoLearningPathStatusTransitionAllowed("ARCHIVED", "PUBLISHED")
    ).toBe(false);
  });

  it("does not allow a no-op status transition", () => {
    expect(isGestaoLearningPathStatusTransitionAllowed("DRAFT", "DRAFT")).toBe(
      false
    );
  });
});
