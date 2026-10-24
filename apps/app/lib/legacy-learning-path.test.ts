import { describe, expect, test } from "vitest";
import { legacyLearningPathname } from "./legacy-learning-path";

describe("legacy /aprender redirects", () => {
  test("sends the catalog to /cursos", () => {
    expect(legacyLearningPathname([])).toBe("/cursos");
  });

  test("flattens course and lesson URLs", () => {
    expect(legacyLearningPathname(["cursos"])).toBe("/cursos");
    expect(legacyLearningPathname(["cursos", "metodo"])).toBe("/cursos/metodo");
    expect(legacyLearningPathname(["cursos", "metodo", "aula-1"])).toBe(
      "/cursos/metodo/aula-1"
    );
  });

  test("keeps learning paths and assignments under /cursos", () => {
    expect(legacyLearningPathname(["trilhas", "base"])).toBe(
      "/cursos/trilhas/base"
    );
    expect(legacyLearningPathname(["atribuicoes", "abc"])).toBe(
      "/cursos/atribuicoes/abc"
    );
  });

  test("sends personal recordings to the recordings archive", () => {
    expect(legacyLearningPathname(["minhas-gravacoes"])).toBe(
      "/encontros/gravacoes"
    );
  });

  test("re-encodes decoded segments", () => {
    expect(legacyLearningPathname(["cursos", "a b"])).toBe("/cursos/a%20b");
  });
});
