import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolsPicker } from "./tools-picker";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    scroll: _scroll,
    ...props
  }: Record<string, unknown> & { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const METAS = /Metas/;
const CRONOMETRO = /Cronômetro/;

const items = [
  {
    id: "goals",
    illustration: "metas",
    label: "Metas",
    description: "Semana.",
  },
  {
    id: "timer",
    illustration: "cronometro",
    label: "Cronômetro",
    description: "Tempo.",
  },
] as const;

afterEach(cleanup);

describe("ToolsPicker (dock)", () => {
  it("renders one link per tool pointing at its view", () => {
    render(<ToolsPicker activeView="goals" items={items} />);
    expect(screen.getByRole("link", { name: METAS }).getAttribute("href")).toBe(
      "/ferramentas?view=goals"
    );
    expect(
      screen.getByRole("link", { name: CRONOMETRO }).getAttribute("href")
    ).toBe("/ferramentas?view=timer");
  });

  it("marks only the active tool as the current page", () => {
    render(<ToolsPicker activeView="timer" items={items} />);
    expect(
      screen
        .getByRole("link", { name: CRONOMETRO })
        .getAttribute("aria-current")
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: METAS }).getAttribute("aria-current")
    ).toBeNull();
  });

  it("keeps the hook used by the notes editor to hide the switcher", () => {
    const { container } = render(
      <ToolsPicker activeView="goals" items={items} />
    );
    expect(
      container.querySelector("[data-tools-page-switcher]")
    ).not.toBeNull();
  });
});
