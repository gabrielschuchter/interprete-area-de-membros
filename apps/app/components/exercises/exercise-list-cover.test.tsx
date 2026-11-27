import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ExerciseListCover } from "./exercise-list-cover";

afterEach(cleanup);

const TITLE = "Bioestatística | 10 questões fundamentais";
const NAME = `Capa da lista: ${TITLE}`;

test("mostra a etiqueta da coleção com o volume, em proporção fixa", () => {
  render(
    <ExerciseListCover
      bankTitle="Bioestatística — Fundamentos"
      coverUrl={null}
      listSlug="bioestatistica-fundamentos"
      title={TITLE}
      volume={2}
    />
  );
  const cover = screen.getByRole("img", { name: NAME });
  expect(cover.className).toContain("aspect-[12/5]");
  expect(cover.textContent).toContain("Bioestatística");
  expect(cover.textContent).toContain("Vol. II");
});

test("usa o nome genérico e a cor própria quando o tema não é conhecido", () => {
  render(
    <ExerciseListCover
      bankTitle="Outro banco"
      coverUrl={null}
      listSlug="medidas"
      title="Medidas de associação"
      volume={1}
    />
  );
  const cover = screen.getByRole("img", {
    name: "Capa da lista: Medidas de associação",
  });
  expect(cover.textContent).toContain("Caderno de prática");
  expect(cover.textContent).toContain("Vol. I");
});

test("sem volume mostra só o nome da coleção", () => {
  render(
    <ExerciseListCover
      bankTitle="Epidemiologia"
      coverUrl={null}
      listSlug="coortes"
      title="Coortes"
    />
  );
  const cover = screen.getByRole("img", { name: "Capa da lista: Coortes" });
  expect(cover.textContent).toContain("Epidemiologia");
  expect(cover.textContent).not.toContain("Vol.");
});

test("mantém a capa cadastrada à frente da etiqueta", () => {
  const registeredCover = "https://cdn.example.test/covers/real-list.webp";
  render(
    <ExerciseListCover
      bankTitle="Bioestatística — Fundamentos"
      coverUrl={registeredCover}
      listSlug="bioestatistica-fundamentos"
      title={TITLE}
      volume={1}
    />
  );
  expect(screen.getByRole("img", { name: NAME }).getAttribute("src")).toBe(
    registeredCover
  );
});
