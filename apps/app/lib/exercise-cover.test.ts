import { expect, test } from "vitest";
import {
  exerciseCoverTheme,
  exerciseVolumeLabel,
  rankExerciseListVolumes,
  toRoman,
} from "./exercise-cover";

test("reconhece o tema pelo título, banco ou endereço", () => {
  expect(exerciseCoverTheme("Estudos PICO", "Banco", "pico")).toBe("pbe");
  expect(exerciseCoverTheme("Lista", "Bioestatística", "x")).toBe(
    "bioestatistica"
  );
  expect(exerciseCoverTheme("Coortes", "Epidemiologia", "coortes")).toBe(
    "epidemiologia"
  );
  expect(exerciseCoverTheme("Medidas", "Outro", "medidas")).toBe("generico");
});

test("escreve o volume em algarismos romanos", () => {
  expect([1, 2, 3, 4, 9, 14].map(toRoman)).toEqual([
    "I",
    "II",
    "III",
    "IV",
    "IX",
    "XIV",
  ]);
  expect(exerciseVolumeLabel(2)).toBe("Vol. II");
});

test("a primeira lista de cada tema é Vol. I, contando dentro do tema", () => {
  const volumes = rankExerciseListVolumes([
    { slug: "pbe-1", title: "PBE", bankTitle: "Prática baseada em evidências" },
    { slug: "epi-1", title: "Epi", bankTitle: "Epidemiologia" },
    {
      slug: "pbe-2",
      title: "PBE 2",
      bankTitle: "Prática baseada em evidências",
    },
    { slug: "outra", title: "Outra", bankTitle: "Geral" },
    { slug: "epi-2", title: "Epi 2", bankTitle: "Epidemiologia" },
  ]);
  expect(volumes.get("pbe-1")).toBe(1);
  expect(volumes.get("epi-1")).toBe(1);
  expect(volumes.get("pbe-2")).toBe(2);
  expect(volumes.get("epi-2")).toBe(2);
  expect(volumes.get("outra")).toBe(1);
});
