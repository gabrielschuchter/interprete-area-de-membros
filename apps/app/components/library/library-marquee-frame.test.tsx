import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { LibraryMarqueeFrame } from "./library-marquee-frame";

afterEach(() => {
  cleanup();
});

const viewport = () =>
  screen.getByText("faixa").closest(".library-marquee__viewport");

test("a esteira anda por padrão e o botão pausa e retoma", () => {
  render(
    <LibraryMarqueeFrame
      caption="Seleção inicial da curadoria"
      heading={<h2>Materiais mais acessados</h2>}
    >
      <span>faixa</span>
    </LibraryMarqueeFrame>
  );

  expect(viewport()?.getAttribute("data-state")).toBe("playing");
  const button = screen.getByRole("button", { name: "Pausar esteira" });
  expect(button.getAttribute("aria-pressed")).toBe("false");

  fireEvent.click(button);
  expect(viewport()?.getAttribute("data-state")).toBe("paused");
  expect(
    screen
      .getByRole("button", { name: "Movimentar esteira" })
      .getAttribute("aria-pressed")
  ).toBe("true");

  fireEvent.click(screen.getByRole("button", { name: "Movimentar esteira" }));
  expect(viewport()?.getAttribute("data-state")).toBe("playing");
});
