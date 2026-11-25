import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LibraryRail } from "./library-rail";

const pauseName = /pausar/i;
const translateX = /translate3d\((-?[\d.]+)px/;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const renderRail = () =>
  render(
    <LibraryRail
      caption="Seleção inicial da curadoria"
      heading={<h2>Materiais mais acessados</h2>}
    >
      <ol className="library-rail__lane">
        <li>faixa</li>
      </ol>
    </LibraryRail>
  );

test("mostra as setas de voltar e avançar e nenhum botão de pausa", () => {
  renderRail();
  expect(screen.getByRole("button", { name: "Voltar materiais" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Avançar materiais" })
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: pauseName })).toBeNull();
});

test("a faixa anda sozinha e a seta de avançar acelera a passagem", () => {
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "performance"] });
  renderRail();
  const track = screen.getByText("faixa").closest(".library-rail__track");
  const position = () =>
    Number(translateX.exec((track as HTMLElement).style.transform)?.[1] ?? 0);

  vi.advanceTimersByTime(1000);
  const drifted = position();
  expect(drifted).toBeLessThan(0);

  fireEvent.click(screen.getByRole("button", { name: "Avançar materiais" }));
  vi.advanceTimersByTime(1000);
  // Um segundo de deriva sozinho anda menos que o passo de uma seta.
  expect(drifted - position()).toBeGreaterThan(150);
});
