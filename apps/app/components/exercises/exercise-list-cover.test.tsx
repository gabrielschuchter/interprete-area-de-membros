import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { exerciseCoverSrc } from "@/lib/exercise-cover";
import { ExerciseListCover } from "./exercise-list-cover";

afterEach(cleanup);

const cases = [
  [
    "Prática Baseada em Evidências | 10 questões",
    "Banco PBE",
    "pbe",
    "/exercises/capas/pbe-sem-volume.webp",
  ],
  [
    "Bioestatística · Vol. II",
    "Bioestatística",
    "bio-2",
    "/exercises/capas/bioestatistica-vol-ii.webp",
  ],
  [
    "Epidemiologia volume 3",
    "Epidemiologia",
    "epi",
    "/exercises/capas/epidemiologia-vol-iii.webp",
  ],
  [
    "Medidas de associação",
    "Outro banco",
    "medidas",
    "/exercises/capas/generico-sem-volume.webp",
  ],
  [
    "Coortes",
    "Epidemiologia",
    "coortes-vol-i",
    "/exercises/capas/epidemiologia-vol-i.webp",
  ],
] as const;

for (const [title, bank, slug, src] of cases) {
  test(`escolhe a capa certa para ${title}`, () => {
    expect(exerciseCoverSrc(title, bank, slug)).toBe(src);
    expect(existsSync(resolve(process.cwd(), `public${src}`))).toBe(true);
  });
}

test("mostra a capa da coleção com proporção fixa", () => {
  render(
    <ExerciseListCover
      bankTitle="Bioestatística — Fundamentos"
      coverUrl={null}
      listSlug="bioestatistica-fundamentos"
      title="Bioestatística | 10 questões fundamentais"
    />
  );
  const image = screen.getByRole("img", {
    name: "Capa da lista: Bioestatística | 10 questões fundamentais",
  });
  expect(image.getAttribute("src")).toBe(
    "/exercises/capas/bioestatistica-sem-volume.webp"
  );
  expect(image.className).toContain("aspect-[12/5]");
});

test("mantém a capa cadastrada à frente da capa da coleção", () => {
  const registeredCover = "https://cdn.example.test/covers/real-list.webp";
  render(
    <ExerciseListCover
      bankTitle="Bioestatística — Fundamentos"
      coverUrl={registeredCover}
      listSlug="bioestatistica-fundamentos"
      title="Bioestatística | 10 questões fundamentais"
    />
  );
  const image = screen.getByRole("img", {
    name: "Capa da lista: Bioestatística | 10 questões fundamentais",
  });
  expect(image.getAttribute("src")).toBe(registeredCover);
});
