import { expect, test } from "vitest";
import {
  correctionNavigation,
  correctionResultPath,
} from "./gestao-correction-navigation";

test.each([
  "https://example.com/gestao/alunos/correcoes",
  "/gestao/alunos/correcoes-evil",
  "http://[",
  "/gestao/ensino/atividades/id/entregas/extra",
])("rejects unsupported return path %s", (path) => {
  expect(correctionNavigation(path)).toEqual({
    path: "/gestao/alunos/correcoes",
    filters: {},
  });
});
test("keeps activity, cohort and bounded search when choosing the next pending submission", () => {
  const path =
    "/gestao/ensino/atividades/a2/entregas?turma=cohort&q=aluno&pagina=8&estado=ALL&entrega=old";
  expect(correctionNavigation(path).filters).toEqual({
    activityId: "a2",
    cohortId: "cohort",
    query: "aluno",
  });
  const url = new URL(
    correctionResultPath(path, "feedback-enviado", "old", "next"),
    "http://local"
  );
  expect(url.pathname).toBe("/gestao/ensino/atividades/a2/entregas");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    turma: "cohort",
    q: "aluno",
    estado: "PENDING",
    entrega: "next",
    resultado: "feedback-enviado",
  });
});
test("last feedback returns to an empty pending queue without reopening the corrected submission", () => {
  const url = new URL(
    correctionResultPath(
      "/gestao/alunos/correcoes?pagina=9&entrega=old",
      "feedback-enviado",
      "old"
    ),
    "http://local"
  );
  expect(url.searchParams.has("entrega")).toBe(false);
  expect(url.searchParams.has("pagina")).toBe(false);
  expect(url.searchParams.get("estado")).toBe("PENDING");
});
test("saving a draft preserves current selection, status and page", () => {
  const url = new URL(
    correctionResultPath(
      "/gestao/alunos/correcoes?pagina=2&estado=ALL",
      "rascunho-salvo",
      "current"
    ),
    "http://local"
  );
  expect(url.searchParams.get("entrega")).toBe("current");
  expect(url.searchParams.get("pagina")).toBe("2");
  expect(url.searchParams.get("estado")).toBe("ALL");
});
