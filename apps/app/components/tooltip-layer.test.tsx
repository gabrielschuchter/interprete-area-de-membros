import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { TooltipLayer } from "./tooltip-layer";

describe("TooltipLayer", () => {
  afterEach(cleanup);

  test("moves a native title to the platform tooltip before the browser shows it", () => {
    render(
      <>
        <TooltipLayer />
        {/* biome-ignore lint/a11y/useAnchorContent: o teste cobre justamente o link só com ícone. */}
        <a href="https://example.com" title="Grupo de estudos">
          <svg aria-hidden="true" />
        </a>
        <button title="Salvar" type="button">
          Salvar rascunho
        </button>
      </>
    );

    const link = screen.getByRole("link");
    fireEvent.pointerOver(link);
    expect(link.getAttribute("title")).toBeNull();
    expect(link.getAttribute("data-tooltip")).toBe("Grupo de estudos");
    // Sem nome acessível próprio, o texto da dica passa a ser o nome.
    expect(link.getAttribute("aria-label")).toBe("Grupo de estudos");

    const button = screen.getByRole("button");
    fireEvent.pointerOver(button);
    expect(button.getAttribute("title")).toBeNull();
    expect(button.hasAttribute("aria-label")).toBe(false);
  });

  test("keeps an explicit data-tooltip over the native title", () => {
    render(
      <>
        <TooltipLayer />
        <button data-tooltip="Negrito · Ctrl+B" title="Negrito" type="button">
          <svg aria-hidden="true" />
        </button>
      </>
    );
    const button = screen.getByRole("button");
    fireEvent.pointerOver(button);
    expect(button.getAttribute("data-tooltip")).toBe("Negrito · Ctrl+B");
    expect(button.getAttribute("title")).toBeNull();
  });
});
